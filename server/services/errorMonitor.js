'use strict';

const entries = [];
let sequence = 0;
const redact = (value) => String(value || '')
  .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
  .replace(/(password|token|secret|authorization)\s*[:=]\s*[^,\s]+/gi, '$1=[REDACTED]');

function record(error, source = 'server') {
  const message = redact(error && error.message ? error.message : error).slice(0, 700);
  const stack = redact(error && error.stack ? error.stack : '').slice(0, 2200);
  entries.unshift({ id: ++sequence, at: new Date().toISOString(), source: String(source).slice(0, 80), message, stack });
  if (entries.length > 100) entries.length = 100;
}
function list(limit = 100) {
  return entries.slice(0, Math.max(1, Math.min(100, Number(limit) || 100)));
}
module.exports = { record, list };
