'use strict';
// In-memory request metrics (per process) used by the admin health page and alerting.
const WINDOW_MS = 5 * 60 * 1000;
const samples = []; // { at, ms, status }
const MAX = 5000;

function record(ms, status) {
  samples.push({ at: Date.now(), ms, status });
  if (samples.length > MAX) samples.splice(0, samples.length - MAX);
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function snapshot(now = Date.now(), windowMs = WINDOW_MS) {
  const recent = samples.filter((s) => now - s.at <= windowMs);
  const times = recent.map((s) => s.ms).sort((a, b) => a - b);
  const errors = recent.filter((s) => s.status >= 500).length;
  return {
    windowSeconds: Math.round(windowMs / 1000),
    requests: recent.length,
    errors,
    errorRate: recent.length ? errors / recent.length : 0,
    p50: Math.round(percentile(times, 50)),
    p95: Math.round(percentile(times, 95)),
    max: times.length ? Math.round(times[times.length - 1]) : 0,
  };
}

function middleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => record(Number(process.hrtime.bigint() - start) / 1e6, res.statusCode));
  next();
}

function reset() { samples.length = 0; }

module.exports = { record, snapshot, middleware, reset };
