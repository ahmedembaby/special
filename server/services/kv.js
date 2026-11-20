'use strict';
const redis = require('./redis');
const mem = new Map();

const sweep = () => {
  const now = Date.now();
  for (const [key, entry] of mem) if (entry.exp <= now) mem.delete(key);
};
setInterval(sweep, 60 * 1000).unref();

// Memory storage is acceptable only when Redis was deliberately not configured
// (single-process development). Silently falling back after a configured Redis
// outage splits OTPs, counters and revocation state across server instances.
function useRedis() {
  if (!redis.client) return false;
  if (!redis.isReady()) {
    throw new Error('Redis is configured but unavailable; refusing unsafe in-memory fallback');
  }
  return true;
}

async function set(key, value, ttlSec) {
  const ttl = Math.max(1, Number(ttlSec) || 1);
  if (useRedis()) {
    await redis.client.set(key, String(value), 'EX', ttl);
    mem.delete(key);
    return;
  }
  mem.set(key, { value: String(value), exp: Date.now() + ttl * 1000 });
}
async function get(key) {
  if (useRedis()) return redis.client.get(key);
  const entry = mem.get(key);
  if (!entry) return null;
  if (entry.exp <= Date.now()) { mem.delete(key); return null; }
  return entry.value;
}
async function del(key) {
  if (useRedis()) await redis.client.del(key);
  mem.delete(key);
}
async function incr(key, ttlSec) {
  const ttl = Math.max(1, Number(ttlSec) || 1);
  if (useRedis()) {
    const count = await redis.client.eval(
      "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return n",
      1, key, ttl
    );
    mem.delete(key);
    return count;
  }
  const now = Date.now();
  const current = mem.get(key);
  const valid = current && current.exp > now;
  const count = valid ? (Number(current.value) || 0) + 1 : 1;
  mem.set(key, { value: String(count), exp: valid ? current.exp : now + ttl * 1000 });
  return count;
}
module.exports = { set, get, del, incr };
