const express = require('express');
const pool = require('../db');
const rt = require('../services/realtime');
const kv = require('../services/kv');
const { publicUser } = require('../utils/format');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const wa = require('../services/whatsapp');
const { isAdminUser } = require('../middleware/auth');

const router = express.Router();

// POST /api/safety/block/:id  (toggle)  -> { blocked }
router.post('/block/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id === req.user.id) return res.status(400).json({ message: 'Invalid user' });
    const [u] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    if (!u.length) return res.status(404).json({ message: 'User not found' });
    const [del] = await pool.query('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', [req.user.id, id]);
    if (del.affectedRows) return res.json({ blocked: false });
    await pool.query('INSERT IGNORE INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)', [req.user.id, id]);
    // blocking cuts the follow relationship both ways and pending requests
    await pool.query('DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)', [req.user.id, id, id, req.user.id]);
    await pool.query('DELETE FROM follow_requests WHERE (follower_id = ? AND target_id = ?) OR (follower_id = ? AND target_id = ?)', [req.user.id, id, id, req.user.id]);
    res.json({ blocked: true });
  } catch (err) {
    res.status(500).json({ message: 'Could not update block' });
  }
});

router.get('/blocks', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.username, u.avatar, u.bio, u.status, u.last_seen FROM user_blocks b JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = ? ORDER BY b.created_at DESC`, [req.user.id]);
    res.json(rows.map(publicUser));
  } catch (err) {
    res.status(500).json({ message: 'Could not load blocked users' });
  }
});

// GET /api/safety/blocked/:id -> { blocked_by_me, blocked_me }
router.get('/blocked/:id', async (req, res) => {
  try {
    const [r] = await pool.query('SELECT blocker_id FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)', [req.user.id, req.params.id, req.params.id, req.user.id]);
    res.json({ blocked_by_me: r.some((x) => x.blocker_id === req.user.id), blocked_me: r.some((x) => x.blocker_id !== req.user.id) });
  } catch (err) {
    res.status(500).json({ message: 'Could not check block' });
  }
});

const REASONS = ['spam', 'harassment', 'hate', 'violence', 'nudity', 'scam', 'impersonation', 'other'];
const TABLES = { user: 'users', post: 'posts', comment: 'comments', message: 'messages', story: 'stories' };

// POST /api/safety/report { type, id, reason, details? }
// POST /api/safety/appeals { message, kind? } - contest a moderation decision
router.post('/appeals', async (req, res) => {
  try {
    const message = String(req.body.message || '').trim().slice(0, 1000);
    if (message.length < 10) return res.status(400).json({ message: 'Please explain your appeal (at least 10 characters)' });
    const [open] = await pool.query("SELECT COUNT(*) AS c FROM appeals WHERE user_id = ? AND status = 'pending'", [req.user.id]);
    if (open[0].c >= 3) return res.status(429).json({ message: 'You already have pending appeals' });
    await pool.query("INSERT INTO appeals (user_id, kind, message) VALUES (?, 'content', ?)", [req.user.id, message]);
    res.status(201).json({ success: true });
  } catch { res.status(500).json({ message: 'Could not submit the appeal' }); }
});

router.post('/report', async (req, res) => {
  try {
    const type = String(req.body.type || '');
    const id = Number(req.body.id);
    const reason = REASONS.includes(req.body.reason) ? req.body.reason : 'other';
    if (!TABLES[type] || !Number.isInteger(id)) return res.status(400).json({ message: 'Invalid report' });
    const [t] = await pool.query(`SELECT id FROM ${TABLES[type]} WHERE id = ?`, [id]);
    if (!t.length) return res.status(404).json({ message: 'Content not found' });
    const [dup] = await pool.query("SELECT id FROM reports WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'open'", [req.user.id, type, id]);
    if (!dup.length) {
      await pool.query('INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, type, id, reason, String(req.body.details || '').slice(0, 500) || null]);
    }
    res.status(201).json({ message: 'Thanks, we will review this report' });
  } catch (err) {
    console.error('report:', err.message);
    res.status(500).json({ message: 'Could not send report' });
  }
});

// GET /api/safety/export - everything we hold about the caller (JSON download)
router.get('/export', async (req, res) => {
  try {
    const id = req.user.id;
    const q = async (sql) => (await pool.query(sql, [id]))[0];
    const data = {
      exported_at: new Date().toISOString(),
      profile: (await q('SELECT id, name, email, username, phone, bio, gender, birthday, avatar, is_private, created_at FROM users WHERE id = ?'))[0],
      posts: await q('SELECT id, content, image, created_at FROM posts WHERE user_id = ? ORDER BY id DESC LIMIT 5000'),
      comments: await q('SELECT id, post_id, content, created_at FROM comments WHERE user_id = ? ORDER BY id DESC LIMIT 5000'),
      messages_sent: await q('SELECT id, conversation_id, content, type, created_at FROM messages WHERE sender_id = ? ORDER BY id DESC LIMIT 10000'),
      following: await q('SELECT following_id AS user_id FROM follows WHERE follower_id = ?'),
      followers: await q('SELECT follower_id AS user_id FROM follows WHERE following_id = ?'),
      blocked: await q('SELECT blocked_id AS user_id FROM user_blocks WHERE blocker_id = ?'),
      stories: await q('SELECT id, media_url, caption, created_at FROM stories WHERE user_id = ?'),
      note: 'End-to-end encrypted messages appear as encrypted text; only your device can read them.',
    };
    res.setHeader('Content-Disposition', 'attachment; filename="my-data.json"');
    res.json(data);
  } catch (err) {
    console.error('export:', err.message);
    res.status(500).json({ message: 'Could not export data' });
  }
});

// ---- re-verification before deleting the account ----
// A stolen session or an unlocked phone must not be enough to erase an account. The user proves it is them again with the
// strongest thing they have: authenticator code (2FA on) > account password (if one exists) > a fresh WhatsApp code to their phone.
const DELETE_CODE_TTL = 300;
const DELETE_MAX_ATTEMPTS = 5;
async function reauthMethod(userId) {
  const [rows] = await pool.query('SELECT phone, password, totp_enabled, totp_secret FROM users WHERE id = ?', [userId]);
  const u = rows[0];
  if (!u) return { method: null };
  if (u.totp_enabled && u.totp_secret) return { method: 'totp' };
  if (u.password) return { method: 'password', u };
  if (u.phone) return { method: 'otp', u };
  return { method: null };
}
const reauthRequired = (res, method) => res.status(401).json({
  message: 'Confirm it is you before deleting the account. Update the app to the latest version if you do not see a verification step.',
  reauthRequired: true,
  method,
});

// GET /api/safety/account/reauth -> { method: 'totp' | 'password' | 'otp' | null }
router.get('/account/reauth', async (req, res) => {
  try { res.json({ method: (await reauthMethod(req.user.id)).method }); }
  catch { res.status(500).json({ message: 'Could not check verification' }); }
});

// POST /api/safety/account/code - sends a one-time code to the account's own phone (only used when there is no 2FA/password)
router.post('/account/code', async (req, res) => {
  try {
    const { method, u } = await reauthMethod(req.user.id);
    if (method !== 'otp') return res.status(400).json({ message: 'A code is not needed for this account' });
    if (await kv.get(`delete_cooldown:${req.user.id}`)) return res.status(429).json({ message: 'Please wait 30 seconds before requesting another code' });
    const code = String(crypto.randomInt(1000, 10000));
    await kv.set(`delete_otp:${req.user.id}`, code, DELETE_CODE_TTL);
    await kv.del(`delete_attempts:${req.user.id}`);
    await kv.set(`delete_cooldown:${req.user.id}`, '1', 30);
    const result = await wa.sendOTP(u.phone, code);
    if (!result.success) {
      await kv.del(`delete_otp:${req.user.id}`);
      await kv.del(`delete_cooldown:${req.user.id}`);
      return res.status(503).json({ message: 'Could not deliver the verification code right now. Please try again later.' });
    }
    res.json({ sent: true });
  } catch (err) {
    console.error('delete code:', err.message);
    res.status(500).json({ message: 'Could not send the code' });
  }
});

async function verifyReauth(req, res) {
  const { method, u } = await reauthMethod(req.user.id);
  if (!method) return true; // nothing to verify against (no 2FA, password or phone)
  if (method === 'totp') {
    const code = String(req.body.totp || '').trim();
    if (!code) { reauthRequired(res, method); return false; }
    const gate = await require('./auth').twoFactorGate(req.user.id, code);
    if (gate) { res.status(gate.status).json({ ...gate.body, reauthRequired: true, method }); return false; }
    return true;
  }
  const attemptsKey = `delete_attempts:${req.user.id}`;
  if ((Number(await kv.get(attemptsKey)) || 0) >= DELETE_MAX_ATTEMPTS) {
    res.status(429).json({ message: 'Too many attempts. Try again later.' });
    return false;
  }
  let ok = false;
  if (method === 'password') {
    const pw = String(req.body.password || '');
    if (!pw) { reauthRequired(res, method); return false; }
    ok = await bcrypt.compare(pw, u.password);
  } else {
    const code = String(req.body.code || '').trim();
    if (!code) { reauthRequired(res, method); return false; }
    const stored = await kv.get(`delete_otp:${req.user.id}`);
    ok = !!stored && stored.length === code.length && crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(code));
    if (ok) await kv.del(`delete_otp:${req.user.id}`);
  }
  if (!ok) {
    await kv.incr(attemptsKey, 900);
    res.status(401).json({ message: 'Invalid or expired code', reauthRequired: true, method });
    return false;
  }
  await kv.del(attemptsKey);
  return true;
}

// DELETE /api/safety/account { confirm: 'DELETE', totp | password | code } - permanently removes the account
router.delete('/account', async (req, res) => {
  try {
    if (req.body.confirm !== 'DELETE') return res.status(400).json({ message: 'Type DELETE to confirm' });
    if (isAdminUser(req.user)) return res.status(403).json({ message: 'Admin accounts cannot be deleted from the app' });
    if (!(await verifyReauth(req, res))) return;
    const id = req.user.id;
    try {
      await pool.query('DELETE FROM users WHERE id = ?', [id]);
    } catch (e) {
      // a foreign key blocks hard deletion: anonymise and lock the account instead
      await pool.query("UPDATE users SET name = 'Deleted user', username = CONCAT('deleted_', id), email = NULL, phone = NULL, avatar = NULL, bio = NULL, public_key = NULL, banned = 1 WHERE id = ?", [id]);
    }
    try { await kv.set(`blacklist:${req.user.token}`, '1', 60 * 60 * 24 * 30); } catch { /* optional */ }
    rt.emitToUser(id, 'account_deleted', {});
    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('delete account:', err.message);
    res.status(500).json({ message: 'Could not delete the account' });
  }
});

module.exports = router;
