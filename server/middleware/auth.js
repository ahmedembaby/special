const jwt = require('jsonwebtoken');
const pool = require('../db');
const kv = require('../services/kv');
const { JWT_SECRET, ADMIN_IDS, ADMIN_PHONES } = require('../config');

const getToken = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

// Verifies a session token and returns the (non banned) user row, or null.
async function authenticateToken(token) {
  if (!token) return null;
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
  if (decoded.purpose) return null; // registration tokens are not session tokens
  if (await kv.get(`blacklist:${token}`)) return null;
  const [rows] = await pool.query('SELECT id, name, username, avatar, phone, banned FROM users WHERE id = ?', [decoded.id]);
  if (!rows.length || rows[0].banned) return null;
  return { id: rows[0].id, name: rows[0].name, username: rows[0].username, avatar: rows[0].avatar, phone: rows[0].phone, token };
}

const authMiddleware = async (req, res, next) => {
  try {
    const user = await authenticateToken(getToken(req));
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
