// Run with: npm test   (no database needed)
const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const path = require('path');
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
    if (/SELECT ds\.id, ds\.device_name/.test(sql)) { // authenticateToken (session JWT lookup)
      const [jti, uid] = params;
      const sx = state.sessions.find((x) => x.id === jti && x.user_id === uid && !x.revoked);
      return [sx ? [{ id: jti, device_name: 'Phone', stale: 0, user_id: uid, name: 'N', username: 'u', avatar: null, phone: '+2010', banned: state.users[uid].banned ? 1 : 0 }] : []];
    }
    if (/SELECT totp_secret, totp_enabled, totp_last_step FROM users/.test(sql)) { const u = state.users[params[0]]; return [[{ totp_secret: u.totp_secret, totp_enabled: u.totp_enabled, totp_last_step: u.totp_last_step ?? null }]]; }
    if (/UPDATE users SET totp_last_step/.test(sql)) {
      const [step, , uid] = params; const u = state.users[uid];
      if (u.totp_last_step != null && u.totp_last_step >= step) return [{ affectedRows: 0 }];
      u.totp_last_step = step; return [{ affectedRows: 1 }];
    }
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

const totpLib = require('../utils/totp');

test('delete account: 2FA users must give a valid authenticator code, replay is refused', async () => {
  state.deleted = [];
  const secret = totpLib.generateSecret();
  state.users[11] = { phone: '+201222222222', password: await bcrypt.hash('pw', 4), totp_enabled: 1, totp_secret: secret };
  const del = route('delete', '/account'); const user = { id: 11, token: 't' };
  let r = await call(del, { user, body: { confirm: 'DELETE' } });
  assert.strictEqual(r.status, 401); assert.strictEqual(r.body.method, 'totp'); assert.strictEqual(r.body.reauthRequired, true);
  r = await call(del, { user, body: { confirm: 'DELETE', password: 'pw' } });
  assert.strictEqual(r.status, 401, 'a password is not enough when 2FA is on'); assert.deepStrictEqual(state.deleted, []);
  r = await call(del, { user, body: { confirm: 'DELETE', totp: '000000' === totpLib.totp(secret) ? '111111' : '000000' } });
  assert.strictEqual(r.status, 401); assert.deepStrictEqual(state.deleted, []);
  r = await call(del, { user, body: { confirm: 'DELETE', totp: totpLib.totp(secret) } });
  assert.strictEqual(r.status, 200); assert.deepStrictEqual(state.deleted, [11]);
  state.deleted = [];
  r = await call(del, { user, body: { confirm: 'DELETE', totp: totpLib.totp(secret) } });
  assert.strictEqual(r.status, 401, 'the same code cannot be used twice'); assert.deepStrictEqual(state.deleted, []);
});

test('delete account: old app (no proof), missing confirm, attempt limit, and no-credential accounts fail closed', async () => {
  state.deleted = [];
  const del = route('delete', '/account');
  state.users[12] = { phone: null, password: await bcrypt.hash('pw12', 4), totp_enabled: 0, totp_secret: null };
  const user = { id: 12, token: 't' };
  let r = await call(del, { user, body: {} });
  assert.strictEqual(r.status, 400, 'confirm is still required');
  r = await call(del, { user, body: { confirm: 'DELETE' } }); // what an old app sends
  assert.strictEqual(r.status, 401); assert.match(r.body.message, /Update the app/); assert.deepStrictEqual(state.deleted, []);
  for (let i = 0; i < 5; i++) assert.strictEqual((await call(del, { user, body: { confirm: 'DELETE', password: 'bad' } })).status, 401);
  r = await call(del, { user, body: { confirm: 'DELETE', password: 'pw12' } });
  assert.strictEqual(r.status, 429, 'locked after 5 wrong attempts even with the right password'); assert.deepStrictEqual(state.deleted, []);
  // an account with nothing to verify against (not reachable through signup or phone login) fails closed
  state.users[13] = { phone: null, password: null, totp_enabled: 0, totp_secret: null };
  r = await call(del, { user: { id: 13, token: 't' }, body: { confirm: 'DELETE' } });
  assert.strictEqual(r.status, 403); assert.deepStrictEqual(state.deleted, []);
});

test('media token: cannot be re-pointed at another user or session', async () => {
  state.users[7] = { banned: 0 }; state.users[8] = { banned: 0 };
  state.sessions = [{ id: 'sess-1', user_id: 7 }, { id: 'sess-2', user_id: 8 }];
  assert.strictEqual(await authenticateMediaToken(signMediaToken(8, 'sess-1')), null, 'user 8 with user 7 session');
  assert.deepStrictEqual(await authenticateMediaToken(signMediaToken(8, 'sess-2')), { id: 8, sessionId: 'sess-2', media: true });
  assert.strictEqual(await authenticateMediaToken(undefined), null);
  assert.strictEqual(await authenticateMediaToken('garbage'), null);
});

const { makePrivateUploadAuth } = require('../middleware/privateUpload');
const { getToken } = require('../middleware/auth');

function uploadHarness(access = () => true) {
  const mw = makePrivateUploadAuth({
    authenticateToken, authenticateMediaToken, getToken,
    canAccessChatMedia: async (f, uid) => access('chat', f, uid),
    canAccessStoryMedia: async (f, uid) => access('stories', f, uid),
    uploadsDir: '/srv/uploads',
  });
  return async (kind, { path: p = '/pic.jpg', query = {}, headers = {} } = {}) => {
    const out = { status: null, sent: null, ended: false };
    const res = {
      status(c) { out.status = c; return this; }, end() { out.ended = true; return this; },
      sendFile(file, opts, cb) { out.sent = { file, headers: opts.headers }; out.status = 200; if (cb) cb(null); },
      headersSent: false,
    };
    let nexted = false;
    await mw(kind)({ path: p, query, headers }, res, () => { nexted = true; });
    return { ...out, nexted };
  };
}

test('private uploads: media token, legacy session JWT in ?t=, Bearer header, and refusals', async () => {
  state.users[7] = { banned: 0 }; state.users[8] = { banned: 0 };
  state.sessions = [{ id: 'sess-1', user_id: 7 }, { id: 'sess-2', user_id: 8 }];
  kvStore.clear();
  const seen = [];
  const get = uploadHarness((kind, f, uid) => { seen.push([kind, f, uid]); return uid === 7; });
  const media = signMediaToken(7, 'sess-1');
  const legacy = jwt.sign({ id: 7, jti: 'sess-1' }, JWT_SECRET, { expiresIn: '1h' }); // what an older app puts in ?t=

  let r = await get('chat', { query: { t: media } });
  assert.strictEqual(r.status, 200, 'new app: media token'); assert.strictEqual(r.sent.file, path.join('/srv/uploads', 'chat', 'pic.jpg'));
  assert.strictEqual(r.sent.headers['Cache-Control'], 'private, no-store');
  r = await get('stories', { query: { t: legacy } });
  assert.strictEqual(r.status, 200, 'old app: session JWT in ?t= still works');
  r = await get('chat', { headers: { authorization: 'Bearer ' + legacy } });
  assert.strictEqual(r.status, 200, 'session JWT in the Authorization header still works');
  r = await get('chat', { query: { t: 'garbage' } }); assert.strictEqual(r.status, 401);
  r = await get('chat', {}); assert.strictEqual(r.status, 401, 'no token');
  r = await get('chat', { query: { t: signMediaToken(8, 'sess-2') } });
  assert.strictEqual(r.status, 404, 'a valid token still needs access to that file');
  r = await get('chat', { query: { t: media }, path: '/../secret.txt' }); assert.strictEqual(r.status, 404, 'path traversal');
  r = await get('chat', { query: { t: media }, path: '/a/b.jpg' }); assert.strictEqual(r.status, 404, 'nested path');
  state.sessions[0].revoked = true;
  r = await get('chat', { query: { t: media } }); assert.strictEqual(r.status, 401, 'media token dies with the session');
  r = await get('chat', { query: { t: legacy } }); assert.strictEqual(r.status, 401, 'session JWT dies with the session too');
  assert.ok(seen.every(([, f]) => f === 'pic.jpg'));
});
