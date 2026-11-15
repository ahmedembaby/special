// Run with: npm test   (no database needed)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

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
