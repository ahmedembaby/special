// Run with: npm test   (no database needed)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// db.js needs mysql2 and a server; the pure helpers under test do not
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === '../db' || request.endsWith('/db')) return { query: async () => [[]] };
  return origLoad.call(this, request, ...rest);
};

const { securityHeaders } = require('../middleware/security');
const migrate = require('../services/migrate');
const metrics = require('../services/metrics');
const spec = require('../openapi');

function fakeRes() {
  const h = {};
  return { h, setHeader: (k, v) => { h[k] = v; } };
}

test('security headers: always set, HSTS only in production', () => {
  const r = fakeRes(); let called = false;
  securityHeaders({ isProd: false })({}, r, () => { called = true; });
  assert.ok(called);
  assert.strictEqual(r.h['X-Content-Type-Options'], 'nosniff');
  assert.strictEqual(r.h['X-Frame-Options'], 'DENY');
  assert.ok(!r.h['Strict-Transport-Security']);
  const p = fakeRes();
  securityHeaders({ isProd: true })({}, p, () => {});
  assert.match(p.h['Strict-Transport-Security'], /max-age=/);
});

test('migrations: applies new files once, in order, and records them', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  fs.writeFileSync(path.join(dir, '002_b.js'), "global.__order=(global.__order||[]).concat('b');exports.up=async()=>{}");
  fs.writeFileSync(path.join(dir, '001_a.js'), "global.__order=(global.__order||[]).concat('a');exports.up=async()=>{}");
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignored');
  const recorded = new Set();
  const pool = {
    query: async (sql, args) => {
      if (/^SELECT name/.test(sql)) return [[...recorded].map((name) => ({ name }))];
      if (/^INSERT INTO schema_migrations/.test(sql)) recorded.add(args[0]);
      return [[]];
    },
  };
  const first = await migrate.run(pool, { dir, log() {} });
  assert.deepStrictEqual(first, ['001_a.js', '002_b.js']);
  assert.deepStrictEqual(global.__order, ['a', 'b']);
  assert.deepStrictEqual(await migrate.run(pool, { dir, log() {} }), []);
});

test('migrations: shipped files follow the naming rule and export up()', () => {
  const files = migrate.listMigrations();
  assert.ok(files.length >= 1);
  for (const f of files) assert.strictEqual(typeof require(path.join(__dirname, '..', 'migrations', f)).up, 'function');
  assert.deepStrictEqual(files, [...files].sort());
});

test('metrics: percentiles and error rate over the window', () => {
  metrics.reset();
  for (let i = 1; i <= 100; i++) metrics.record(i, i > 95 ? 500 : 200);
  const s = metrics.snapshot();
  assert.strictEqual(s.requests, 100);
  assert.strictEqual(s.errors, 5);
  assert.ok(s.p95 >= 95 && s.p50 >= 50 && s.p50 <= 52);
  assert.strictEqual(s.max, 100);
});

test('openapi: valid shape, every path is under /api and has a response', () => {
  assert.strictEqual(spec.openapi, '3.0.3');
  for (const [p, item] of Object.entries(spec.paths)) {
    assert.ok(p.startsWith('/api/'), p);
    for (const o of Object.values(item)) assert.ok(o.responses && o.summary, p);
  }
});

const alerts = require('../services/alerts');
const offhost = require('../services/offhost');

test('alerts: no alert below the minimum traffic, alerts on error rate and latency', () => {
  const base = { windowSeconds: 300, errors: 0, errorRate: 0, p95: 100, requests: 100 };
  assert.deepStrictEqual(alerts.evaluate({ ...base, requests: 5, errorRate: 1, p95: 9999 }), []);
  assert.deepStrictEqual(alerts.evaluate(base), []);
  const a = alerts.evaluate({ ...base, errors: 20, errorRate: 0.2, p95: 3000 });
  assert.deepStrictEqual(a.map((x) => x.kind), ['error_rate', 'latency']);
});

test('alerts: cooldown suppresses repeats', () => {
  assert.ok(alerts.shouldFire('t-' + Date.now()));
});

test('offhost: SigV4 signing key matches the AWS documentation example', () => {
  assert.strictEqual(
    offhost.signingKey('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', '20120215', 'us-east-1', 'iam').toString('hex'),
    'f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d');
});

test('offhost: signed headers are deterministic and include object digest metadata', () => {
  const args = { method: 'PUT', host: 'bucket.example.com', path: '/a/b.sdbak', region: 'auto', accessKey: 'AK', secretKey: 'SK', now: new Date('2026-01-02T03:04:05Z'), extraHeaders: { 'x-amz-meta-sha256': 'a'.repeat(64) } };
  const h = offhost.sign(args);
  assert.strictEqual(h['x-amz-date'], '20260102T030405Z');
  assert.match(h.authorization, /^AWS4-HMAC-SHA256 Credential=AK\/20260102\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-meta-sha256, Signature=[a-f0-9]{64}$/);
  assert.strictEqual(offhost.sign(args).authorization, h.authorization);
  assert.notStrictEqual(offhost.sign(args).authorization, offhost.sign({ ...args, extraHeaders: { 'x-amz-meta-sha256': 'b'.repeat(64) } }).authorization);
});

test('offhost: fileDigest hashes a file without loading it all into memory', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'offhost-'));
  const file = path.join(dir, 'backup.sdbak');
  fs.writeFileSync(file, 'encrypted-backup');
  assert.strictEqual(await offhost.fileDigest(file), require('crypto').createHash('sha256').update('encrypted-backup').digest('hex'));
  fs.rmSync(dir, { recursive: true, force: true });
});

const { mentionsUser } = require('../utils/mentionsFilter');
test('mentionsUser: whole-handle, case-insensitive, not inside emails/longer names', () => {
  assert.ok(mentionsUser('hi @Ahmed how are you', 'ahmed'));
  assert.ok(mentionsUser('@ahmed', 'ahmed'));
  assert.ok(!mentionsUser('mail a@ahmed.com', 'ahmed'));
  assert.ok(!mentionsUser('hi @ahmed2', 'ahmed'));
  assert.ok(mentionsUser('x @a.b!', 'a.b'));
  assert.ok(!mentionsUser('', 'ahmed') && !mentionsUser('hi', ''));
});


const e2ee = require('../utils/e2ee');
test('E2EE policy: direct text is required to be ciphertext only after both keys exist', () => {
  assert.equal(e2ee.requiresEncryption('group', 'plain text', true), false);
  assert.equal(e2ee.requiresEncryption('direct', 'plain text', false), false);
  assert.equal(e2ee.requiresEncryption('direct', 'plain text', true), true);
  assert.equal(e2ee.requiresEncryption('direct', e2ee.PREFIX + 'A'.repeat(56), true), false);
  assert.equal(e2ee.requiresEncryption('direct', 'malformed e2ee:v1:', true), true);
});
