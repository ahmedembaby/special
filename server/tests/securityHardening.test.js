// Run with: npm test   (no database needed)
const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// in-memory stand-ins for the database, kv store and WhatsApp
const state = { sessions: [], users: {}, deleted: [], otpSent: [] };
const fakePool = {
  query: async (sql, params = []) => {
    if (/FROM device_sessions ds JOIN users u/.test(sql)) {
      const [jti, uid] = params;
      const s = state.sessions.find((x) => x.id === jti && x.user_id === uid && !x.revoked);
      return [s ? [{ id: uid, banned: state.users[uid].banned ? 1 : 0 }] : []];
    }
    if (/SELECT phone, password, totp_enabled, totp_secret FROM users/.test(sql)) return [[state.users[params[0]]]];
    if (/DELETE FROM users/.test(sql)) { state.deleted.push(params[0]); return [{ affectedRows: 1 }]; }
    return [[]];
  },
};
const kvStore = new Map();
const fakeKv = {
  get: async (k) => kvStore.get(k) ?? null,
  set: async (k, v) => { kvStore.set(k, String(v)); },
  del: async (k) => { kvStore.delete(k); },
  incr: async (k) => { const n = (Number(kvStore.get(k)) || 0) + 1; kvStore.set(k, String(n)); return n; },
};
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === '../db' || request === './db') return fakePool;
  if (request === '../services/kv' || request === './services/kv') return fakeKv;
  if (request === '../services/whatsapp') return { sendOTP: async (phone, code) => { state.otpSent.push({ phone, code }); return { success: true }; } };
  if (request === '../services/realtime') return { emitToUser: () => {} };
  return origLoad.call(this, request, ...rest);
};

const { authenticateMediaToken, authenticateToken, signMediaToken } = require('../middleware/auth');
const { JWT_SECRET } = require('../config');

test('media token: deterministic, opens media only while the session is active', async () => {
  state.users[7] = { banned: 0 };
  state.sessions = [{ id: 'sess-1', user_id: 7 }];
  const a = signMediaToken(7, 'sess-1');
  assert.strictEqual(a, signMediaToken(7, 'sess-1'), 'same URL every time so the image cache keeps working');
  assert.ok(!jwt.decode(a).exp && !jwt.decode(a).iat);
  assert.deepStrictEqual(await authenticateMediaToken(a), { id: 7, sessionId: 'sess-1', media: true });
  assert.strictEqual(await authenticateToken(a), null, 'a media token is not an API/socket token');
  state.sessions[0].revoked = true;
  assert.strictEqual(await authenticateMediaToken(a), null, 'dies with the session');
  state.sessions[0].revoked = false;
  state.users[7].banned = 1;
  assert.strictEqual(await authenticateMediaToken(a), null, 'banned user');
  state.users[7].banned = 0;
  const session = jwt.sign({ id: 7, jti: 'sess-1' }, JWT_SECRET, { expiresIn: '1h' });
  assert.strictEqual(await authenticateMediaToken(session), null, 'a session token is not a media token');
  assert.strictEqual(await authenticateMediaToken(jwt.sign({ id: 7, jti: 'sess-1', purpose: 'media' }, 'other-secret')), null);
});

const safety = require('../routes/safety');
const route = (method, path) => safety.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]).route.stack.slice(-1)[0].handle;
const call = async (handler, req) => {
  const out = { status: 200, body: null };
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; }, setHeader() {} };
  await handler({ body: {}, ...req }, res);
  return out;
};

test('delete account: password users must re-enter the password', async () => {
  state.users[9] = { phone: '+201000000000', password: await bcrypt.hash('hunter22', 4), totp_enabled: 0, totp_secret: null };
  const del = route('delete', '/account');
  const user = { id: 9, token: 't' };
  let r = await call(del, { user, body: { confirm: 'DELETE' } });
  assert.strictEqual(r.status, 401); assert.strictEqual(r.body.reauthRequired, true); assert.strictEqual(r.body.method, 'password');
  r = await call(del, { user, body: { confirm: 'DELETE', password: 'wrong' } });
  assert.strictEqual(r.status, 401); assert.deepStrictEqual(state.deleted, []);
  r = await call(del, { user, body: { confirm: 'DELETE', password: 'hunter22' } });
  assert.strictEqual(r.status, 200); assert.deepStrictEqual(state.deleted, [9]);
});

test('delete account: phone-only users need a fresh WhatsApp code, single use, limited attempts', async () => {
  state.deleted = [];
  state.users[10] = { phone: '+201111111111', password: null, totp_enabled: 0, totp_secret: null };
  const del = route('delete', '/account'); const code = route('post', '/account/code');
  const user = { id: 10, token: 't' };
  let r = await call(del, { user, body: { confirm: 'DELETE' } });
  assert.strictEqual(r.body.method, 'otp'); assert.strictEqual(r.status, 401);
  r = await call(code, { user });
  assert.strictEqual(r.body.sent, true); assert.strictEqual(state.otpSent.length, 1);
  assert.strictEqual(state.otpSent[0].phone, '+201111111111');
  r = await call(del, { user, body: { confirm: 'DELETE', code: '0000' === state.otpSent[0].code ? '1111' : '0000' } });
  assert.strictEqual(r.status, 401); assert.deepStrictEqual(state.deleted, []);
  r = await call(del, { user, body: { confirm: 'DELETE', code: state.otpSent[0].code } });
  assert.strictEqual(r.status, 200); assert.deepStrictEqual(state.deleted, [10]);
  r = await call(del, { user, body: { confirm: 'DELETE', code: state.otpSent[0].code } });
  assert.strictEqual(r.status, 401, 'code is single use');
});
