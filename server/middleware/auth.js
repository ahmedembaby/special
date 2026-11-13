const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');
const kv = require('../services/kv');
const { JWT_SECRET, ADMIN_IDS, ADMIN_PHONES } = require('../config');

const getToken = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

// Verifies a session token and returns the (non banned) user row, or null.
async function authenticateToken(token, device = {}) {
  if (!token) return null;
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
  if (decoded.purpose) return null; // registration tokens are not session tokens
  if (await kv.get(`blacklist:${token}`)) return null;
  let sessionId = decoded.jti || null;
  if (decoded.jti) {
    const [active] = await pool.query('SELECT id FROM device_sessions WHERE id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1', [decoded.jti, decoded.id]);
    if (!active.length) return null;
  } else {
    // Adopt pre-feature JWTs on first use so existing users do not have to sign in again.
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    let [active] = await pool.query('SELECT id FROM device_sessions WHERE token_hash = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1', [tokenHash, decoded.id]);
    if (!active.length) {
      const id = crypto.randomUUID();
      const exp = decoded.exp ? new Date(decoded.exp * 1000).toISOString().slice(0, 19).replace('T', ' ') : new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace('T', ' ');
      const name = String(device.name || 'Previously signed-in device').slice(0, 120);
      const platform = ['ios', 'android', 'web'].includes(device.platform) ? device.platform : 'unknown';
      await pool.query('INSERT IGNORE INTO device_sessions (id, token_hash, user_id, device_name, platform, expires_at) VALUES (?, ?, ?, ?, ?, ?)', [id, tokenHash, decoded.id, name, platform, exp]);
      [active] = await pool.query('SELECT id FROM device_sessions WHERE token_hash = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1', [tokenHash, decoded.id]);
    }
    if (!active.length) return null;
    sessionId = active[0].id;
  }
  const deviceName = String(device.name || '').trim().slice(0, 120);
  const platform = ['ios', 'android', 'web'].includes(device.platform) ? device.platform : null;
  if (deviceName) await pool.query("UPDATE device_sessions SET device_name = ?, platform = COALESCE(?, platform) WHERE id = ? AND device_name = 'Previously signed-in device'", [deviceName, platform, sessionId]);
  await pool.query('UPDATE device_sessions SET last_active_at = NOW() WHERE id = ? AND last_active_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)', [sessionId]);
  const [rows] = await pool.query('SELECT id, name, username, avatar, phone, banned FROM users WHERE id = ?', [decoded.id]);
  if (!rows.length || rows[0].banned) return null;
  return { id: rows[0].id, name: rows[0].name, username: rows[0].username, avatar: rows[0].avatar, phone: rows[0].phone, token, sessionId };
}

const authMiddleware = async (req, res, next) => {
  try {
    const user = await authenticateToken(getToken(req), { name: req.get('x-device-name'), platform: req.get('x-device-platform') });
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    req.user = user;
    req.token = user.token;
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(500).json({ message: 'Authentication failed' });
  }
};

// user: any row/object with id and/or phone
const isAdminUser = (u) => !!u && (ADMIN_IDS.includes(Number(u.id)) || (!!u.phone && ADMIN_PHONES.includes(u.phone)));
const isAdminId = async (id) => {
  const [rows] = await pool.query('SELECT id, phone FROM users WHERE id = ?', [id]);
  return rows.length ? isAdminUser(rows[0]) : false;
};

const adminMiddleware = (req, res, next) => {
  if (!req.user || !isAdminUser(req.user)) return res.status(403).json({ message: 'Admin access required' });
  next();
};

module.exports = { authMiddleware, adminMiddleware, authenticateToken, isAdminId, isAdminUser, getToken };
