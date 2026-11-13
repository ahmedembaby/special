// Small key/value store with TTL: Redis when available, in-memory otherwise.
const redis = require('./redis');

const mem = new Map();

const sweep = () => {
  const now = Date.now();
  for (const [k, v] of mem) if (v.exp <= now) mem.delete(k);
};
setInterval(sweep, 60 * 1000).unref();

async function set(key, value, ttlSec) {
  if (redis.isReady()) {
    try { await redis.client.set(key, String(value), 'EX', ttlSec); return; } catch { /* fall through */ }
  }
  mem.set(key, { value: String(value), exp: Date.now() + ttlSec * 1000 });
}

async function get(key) {
  if (redis.isReady()) {
    try { const v = await redis.client.get(key); if (v !== null) return v; } catch { /* fall through */ }
  }
  const e = mem.get(key);
  if (!e) return null;
  if (e.exp <= Date.now()) { mem.delete(key); return null; }
  return e.value;
}

async function del(key) {
  if (redis.isReady()) { try { await redis.client.del(key); } catch { /* ignore */ } }
  mem.delete(key);
}

async function incr(key, ttlSec) {
  const cur = Number(await get(key)) || 0;
  await set(key, cur + 1, ttlSec);
  return cur + 1;
}

module.exports = { set, get, del, incr };
