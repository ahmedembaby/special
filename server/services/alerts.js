'use strict';
// Automatic alerts on error-rate / latency spikes and backup failures.
// Delivery: in-app notice + push to every admin, optional webhook (ALERT_WEBHOOK_URL).
const pool = require('../db');
const metrics = require('./metrics');

const thresholds = () => ({
  minRequests: Number(process.env.ALERT_MIN_REQUESTS) || 20,
  errorRate: Number(process.env.ALERT_ERROR_RATE) || 0.1,
  p95Ms: Number(process.env.ALERT_P95_MS) || 2000,
});

// Pure: decide which alerts a metrics snapshot triggers.
function evaluate(snap, t = thresholds()) {
  const out = [];
  if (snap.requests < t.minRequests) return out;
  if (snap.errorRate >= t.errorRate) out.push({ kind: 'error_rate', value: snap.errorRate, message: `نسبة أخطاء الخادم ${(snap.errorRate * 100).toFixed(1)}% خلال آخر ${Math.round(snap.windowSeconds / 60)} دقائق (${snap.errors} من ${snap.requests} طلب)` });
  if (snap.p95 >= t.p95Ms) out.push({ kind: 'latency', value: snap.p95, message: `زمن الاستجابة p95 وصل إلى ${snap.p95}ms (الحد ${t.p95Ms}ms)` });
  return out;
}

const COOLDOWN_MS = 30 * 60 * 1000;
const lastFired = new Map();
const shouldFire = (kind, now = Date.now()) => !lastFired.has(kind) || now - lastFired.get(kind) >= COOLDOWN_MS;

async function adminIds() {
  const config = require('../config');
  const [rows] = await pool.query("SELECT user_id FROM admin_roles WHERE role IN ('owner','admin')");
  return [...new Set([...config.ADMIN_IDS, ...rows.map((r) => Number(r.user_id))])];
}

async function fire(alert) {
  lastFired.set(alert.kind, Date.now());
  try { await pool.query('INSERT INTO admin_alerts (kind, message, value) VALUES (?, ?, ?)', [alert.kind, alert.message.slice(0, 300), alert.value]); } catch { /* table missing */ }
  try {
    const { systemNotice } = require('./notify');
    for (const id of await adminIds()) await systemNotice(id, '⚠️ تنبيه تشغيلي', alert.message, { adminAlert: alert.kind });
  } catch { /* ignore */ }
  if (process.env.ALERT_WEBHOOK_URL) {
    fetch(process.env.ALERT_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `[Special] ${alert.message}`, ...alert }), signal: AbortSignal.timeout(8000) }).catch(() => {});
  }
}

async function tick() {
  for (const a of evaluate(metrics.snapshot())) if (shouldFire(a.kind)) await fire(a);
}
let timer = null;
function start() {
  if (timer) return;
  timer = setInterval(() => tick().catch(() => {}), 60 * 1000);
  timer.unref();
}

module.exports = { evaluate, shouldFire, fire, start, thresholds };
