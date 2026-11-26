const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const kv = require('../services/kv');
const rt = require('../services/realtime');
const { pushToUsers } = require('../services/push');
const { adminMiddleware, isAdminId, isAdminUser } = require('../middleware/auth');
const { participantIds } = require('../services/chat');
const adminBackups = require('../services/adminBackups');
const errorMonitor = require('../services/errorMonitor');

const router = express.Router();
router.use(adminMiddleware); // mounted behind authMiddleware in index.js

const permissionRoles = (req) => {
  const p = String(req.path || '/').toLowerCase();
  const write = req.method !== 'GET';
  if (p === '/me') return ['support', 'moderator', 'admin', 'owner'];
  if (p.startsWith('/admins') || p.startsWith('/backups')) return ['owner'];
  if (p.startsWith('/verifications') || p.startsWith('/appeals')) return ['owner', 'admin', 'moderator'];
  if (p.startsWith('/reports') || p.startsWith('/posts') || p.startsWith('/groups') || p.startsWith('/stories') || p.startsWith('/banned-words')) return ['owner', 'admin', 'moderator'];
  // Message content is private: only admin/owner may read a conversation's messages
  if (/^\/conversations\/\d+\/messages/.test(p)) return ['admin', 'owner'];
  if (['/stats', '/system', '/health', '/errors', '/release', '/users', '/sessions', '/conversations'].some((prefix) => p === prefix || p.startsWith(prefix + '/'))) {
    if (!write && ['support', 'moderator', 'admin', 'owner'].includes(req.adminRole)) return ['support', 'moderator', 'admin', 'owner'];
    return ['admin', 'owner'];
  }
  if (p.startsWith('/audit')) return ['admin', 'owner'];
  return ['admin', 'owner'];
};
router.use((req, res, next) => {
  const allowed = permissionRoles(req);
  if (!allowed.includes(req.adminRole)) return res.status(403).json({ message: 'Your admin role cannot perform this action' });
  next();
});

// audit log: every successful change made from the dashboard is recorded
router.use((req, res, next) => {
  if (req.method !== 'GET') {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      const body = { ...req.body };
      for (const key of ['password', 'body', 'token', 'otp', 'secret', 'authorization']) delete body[key];
      const details = Object.keys(body).length ? JSON.stringify(body).slice(0, 500) : null;
      pool.query('INSERT INTO admin_audit (admin_id, method, path, details) VALUES (?, ?, ?, ?)',
        [req.user.id, req.method, req.originalUrl.slice(0, 200), details]).catch(() => {});
    });
  }
  next();
});

router.get('/admins', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT ar.user_id, ar.role, ar.created_at, ar.updated_at, u.name, u.username, u.phone FROM admin_roles ar JOIN users u ON u.id = ar.user_id ORDER BY ar.created_at DESC'
    );
    res.json({ admins: rows });
  } catch { res.status(500).json({ message: 'Could not load admin roles' }); }
});
router.post('/admins', async (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const role = String(req.body.role || '');
    if (!Number.isInteger(userId) || userId <= 0 || !['admin', 'moderator', 'support'].includes(role)) {
      return res.status(400).json({ message: 'Choose a valid user and role' });
    }
    const [users] = await pool.query('SELECT id, phone FROM users WHERE id = ? AND banned = 0', [userId]);
    if (!users.length) return res.status(404).json({ message: 'User not found' });
    if (isAdminUser(users[0])) return res.status(409).json({ message: 'Bootstrap owners cannot be changed here' });
    await pool.query(
      'INSERT INTO admin_roles (user_id, role, granted_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role), granted_by = VALUES(granted_by)',
      [userId, role, req.user.id]
    );
    res.status(201).json({ success: true, userId, role });
  } catch { res.status(500).json({ message: 'Could not assign admin role' }); }
});
router.delete('/admins/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0 || userId === Number(req.user.id)) return res.status(400).json({ message: 'Invalid admin account' });
    await pool.query('DELETE FROM admin_roles WHERE user_id = ?', [userId]);
    res.json({ success: true });
  } catch { res.status(500).json({ message: 'Could not remove admin role' }); }
});

router.get('/errors', (req, res) => {
  res.json(errorMonitor.list(req.query.limit));
});

router.get('/release', async (req, res) => {
  try {
    const serverPackage = require('../package.json');
    const mobilePackage = require('../../mobile/package.json');
    const mobileApp = require('../../mobile/app.json');
    res.json({
      serverVersion: serverPackage.version || 'unknown',
      mobileVersion: mobilePackage.version || 'unknown',
      appVersion: mobileApp.expo?.version || 'unknown',
      commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || process.env.SOURCE_VERSION || null,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      checkedAt: new Date().toISOString(),
    });
  } catch { res.status(500).json({ message: 'Could not load release information' }); }
});

// ---- helpers -------------------------------------------------------------
const pageParams = (req, def = 50, max = 200) => ({
  limit: Math.min(Math.max(Number(req.query.limit) || def, 1), max),
  offset: Math.max(Number(req.query.offset) || 0, 0),
  q: String(req.query.q || '').trim().slice(0, 100),
});
// Lists stay plain arrays (existing clients); the total goes in a header
const sendList = (res, rows, total) => { res.set('X-Total-Count', String(total)); res.json(rows); };
const like = (q) => `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;

// Pages each role may open (the dashboard hides the rest)
const PAGE_ROLES = {
  overview: ['support', 'moderator', 'admin', 'owner'], users: ['support', 'moderator', 'admin', 'owner'],
  posts: ['moderator', 'admin', 'owner'], stories: ['moderator', 'admin', 'owner'], reports: ['moderator', 'admin', 'owner'],
  groups: ['moderator', 'admin', 'owner'], conversations: ['support', 'moderator', 'admin', 'owner'], sessions: ['support', 'moderator', 'admin', 'owner'],
  broadcast: ['admin', 'owner'], campaigns: ['admin', 'owner'], backups: ['owner'], words: ['moderator', 'admin', 'owner'],
  audit: ['admin', 'owner'], otp: ['admin', 'owner'], settings: ['admin', 'owner'], admins: ['owner'], errors: ['support', 'moderator', 'admin', 'owner'], verifications: ['moderator', 'admin', 'owner'], rlog: ['moderator', 'admin', 'owner'], appeals: ['moderator', 'admin', 'owner'], alerts: ['admin', 'owner'], ai: ['admin', 'owner'], release: ['support', 'moderator', 'admin', 'owner'],
};
router.get('/me', (req, res) => {
  res.json({
    id: req.user.id, name: req.user.name, username: req.user.username, role: req.adminRole,
    pages: Object.keys(PAGE_ROLES).filter((page) => PAGE_ROLES[page].includes(req.adminRole)),
    canWrite: ['admin', 'owner'].includes(req.adminRole),
  });
});

router.get('/audit', async (req, res) => {
  try {
    const { limit, offset, q } = pageParams(req, 50, 200);
    const method = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(req.query.method || '').toUpperCase()) ? String(req.query.method).toUpperCase() : '';
    const where = []; const args = [];
    if (q) { where.push('(u.name LIKE ? OR a.path LIKE ? OR a.details LIKE ?)'); args.push(like(q), like(q), like(q)); }
    if (method) { where.push('a.method = ?'); args.push(method); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[t]] = await pool.query(`SELECT COUNT(*) AS c FROM admin_audit a JOIN users u ON u.id = a.admin_id ${w}`, args);
    const [rows] = await pool.query(`SELECT a.*, u.name AS admin_name FROM admin_audit a JOIN users u ON u.id = a.admin_id ${w} ORDER BY a.id DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
    sendList(res, rows, t.c);
  } catch { res.status(500).json({ message: 'Could not load the audit log' }); }
});

// story moderation
router.get('/stories', async (req, res) => {
  try {
    const { limit, offset, q } = pageParams(req, 50, 200);
    const w = q ? 'WHERE (u.name LIKE ? OR u.username LIKE ? OR s.caption LIKE ? OR s.text_content LIKE ?)' : '';
    const args = q ? Array(4).fill(like(q)) : [];
    const [[t]] = await pool.query(`SELECT COUNT(*) AS c FROM stories s JOIN users u ON u.id = s.user_id ${w}`, args);
    const [rows] = await pool.query(
      `SELECT s.id, s.user_id, u.name AS user_name, u.username, s.media_type, s.media_url, s.caption,
              s.text_content, s.audience, s.created_at, s.expires_at,
              (SELECT COUNT(*) FROM story_views v WHERE v.story_id = s.id) AS views_count
       FROM stories s JOIN users u ON u.id = s.user_id ${w}
       ORDER BY s.created_at DESC LIMIT ? OFFSET ?`, [...args, limit, offset]
    );
    sendList(res, rows, t.c);
  } catch { res.status(500).json({ message: 'Could not load stories' }); }
});
router.delete('/stories/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT media_url FROM stories WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Story not found' });
    await pool.query('DELETE FROM stories WHERE id = ?', [req.params.id]);
    const mediaUrl = String(rows[0].media_url || '');
    if (mediaUrl.startsWith('/uploads/stories/')) {
      const fs = require('fs/promises');
      const path = require('path');
      await fs.unlink(path.join(__dirname, '..', 'uploads', 'stories', path.basename(mediaUrl))).catch(() => {});
    }
    res.json({ success: true });
  } catch { res.status(500).json({ message: 'Could not delete story' }); }
});

// banned words (rejected in posts and comments)
router.get('/banned-words', async (req, res) => {
  try { res.json((await pool.query('SELECT word FROM banned_words ORDER BY word'))[0].map((r) => r.word)); }
  catch { res.status(500).json({ message: 'Could not load words' }); }
});
router.post('/banned-words', async (req, res) => {
  try {
    const word = String(req.body.word || '').trim().toLowerCase().slice(0, 60);
    if (word.length < 2) return res.status(400).json({ message: 'Word is too short' });
    await pool.query('INSERT IGNORE INTO banned_words (word) VALUES (?)', [word]);
    require('../services/wordfilter').refresh();
    res.status(201).json({ word });
  } catch { res.status(500).json({ message: 'Could not add word' }); }
});
router.delete('/banned-words/:word', async (req, res) => {
  try {
    await pool.query('DELETE FROM banned_words WHERE word = ?', [req.params.word]);
    require('../services/wordfilter').refresh();
    res.json({ ok: true });
  } catch { res.status(500).json({ message: 'Could not remove word' }); }
});

router.get('/stats', async (req, res) => {
  try {
    const days = [7, 14, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 7;
    const [[u]] = await pool.query('SELECT COUNT(*) AS c FROM users');
    const [[c]] = await pool.query('SELECT COUNT(*) AS c FROM conversations');
    const [[m]] = await pool.query('SELECT COUNT(*) AS c FROM messages');
    const [[p]] = await pool.query('SELECT COUNT(*) AS c FROM posts');
    const [[g]] = await pool.query('SELECT COUNT(*) AS c FROM `groups`');
    const [[bn]] = await pool.query('SELECT COUNT(*) AS c FROM users WHERE banned = 1');
    const [[nt]] = await pool.query('SELECT COUNT(*) AS c FROM users WHERE created_at >= CURDATE()');
    const [[mt]] = await pool.query('SELECT COUNT(*) AS c FROM messages WHERE created_at >= CURDATE()');
    const [[or]] = await pool.query("SELECT COUNT(*) AS c FROM reports WHERE status = 'open'");
    const [[dau]] = await pool.query('SELECT COUNT(*) AS c FROM users WHERE last_seen >= DATE_SUB(NOW(), INTERVAL 1 DAY)');
    const [[wau]] = await pool.query('SELECT COUNT(*) AS c FROM users WHERE last_seen >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    const [[mau]] = await pool.query('SELECT COUNT(*) AS c FROM users WHERE last_seen >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    const [[callsToday], [groupCallsToday]] = await Promise.all([
      pool.query('SELECT COUNT(*) AS c FROM calls WHERE created_at >= CURDATE()'),
      pool.query('SELECT COUNT(*) AS c FROM group_calls WHERE started_at >= CURDATE()')
    ]);
    const [[media]] = await pool.query('SELECT COUNT(*) AS files, COALESCE(SUM(file_size), 0) AS bytes FROM messages WHERE file_url IS NOT NULL');
    const series = async (table) => {
      const [rows] = await pool.query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS c FROM ${table}
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ${days - 1} DAY) GROUP BY d`
      );
      const map = new Map(rows.map((r) => [r.d, Number(r.c)]));
      const out = [];
      for (let i = days - 1; i >= 0; i--) {
        const dt = new Date(Date.now() - i * 86400000);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        out.push({ date: key, count: map.get(key) || 0 });
      }
      return out;
    };
    res.json({
      bannedUsers: bn.c,
      newUsersToday: nt.c,
      messagesToday: mt.c,
      openReports: or.c,
      activeUsers: { daily: Number(dau.c), weekly: Number(wau.c), monthly: Number(mau.c) },
      callsToday: Number(callsToday.c) + Number(groupCallsToday.c),
      media: { files: Number(media.files), bytes: Number(media.bytes) },
      days,
      activity: { users: await series('users'), messages: await series('messages'), posts: await series('posts') },
      totalUsers: u.c,
      totalConversations: c.c,
      totalMessages: m.c,
      totalPosts: p.c,
      totalGroups: g.c,
      onlineUsers: [...rt.online.values()].filter((n) => n > 0).length,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not load stats' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = String(req.query.filter || 'all');
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const where = [];
    const args = [];
    if (q) {
      where.push('(name LIKE ? OR username LIKE ? OR email LIKE ? OR phone LIKE ?)');
      args.push(...Array(4).fill(`%${q}%`));
    }
    if (filter === 'banned') where.push('banned = 1');
    if (filter === 'online') where.push("status = 'online'");
    if (filter === 'new') where.push('created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    if (filter === 'inactive') where.push('(last_seen IS NULL OR last_seen < DATE_SUB(NOW(), INTERVAL 30 DAY))');
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[t]] = await pool.query(`SELECT COUNT(*) AS c FROM users ${w}`, args);
    const [users] = await pool.query(
      `SELECT id, name, username, email, phone, avatar, status, banned, banned_until, last_seen, created_at FROM users ${w}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...args, limit, offset]
    );
    res.json({ total: t.c, users: users.map((u) => ({ ...u, banned: !!u.banned, is_admin: isAdminUser(u) })) });
  } catch (err) {
    res.status(500).json({ message: 'Could not load users' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      'SELECT id, name, username, email, phone, avatar, bio, status, banned, banned_until, verified, last_seen, created_at FROM users WHERE id = ?', [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    const one = async (sql) => (await pool.query(sql, [id]))[0][0].c;
    res.json({
      ...rows[0],
      banned: !!rows[0].banned,
      is_admin: isAdminUser(rows[0]),
      stats: {
        posts: await one('SELECT COUNT(*) AS c FROM posts WHERE user_id = ?'),
        messages: await one('SELECT COUNT(*) AS c FROM messages WHERE sender_id = ?'),
        followers: await one('SELECT COUNT(*) AS c FROM follows WHERE following_id = ?'),
        following: await one('SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?'),
        reportsAgainst: await one("SELECT COUNT(*) AS c FROM reports WHERE target_type = 'user' AND target_id = ?"),
        activeSessions: await one('SELECT COUNT(*) AS c FROM device_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > NOW()'),
      },
      recentPosts: (await pool.query('SELECT id, content, created_at FROM posts WHERE user_id = ? ORDER BY id DESC LIMIT 5', [id]))[0],
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not load user' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (await isAdminId(id)) return res.status(400).json({ message: 'Admins cannot be deleted' });
    rt.disconnectUser(id);
    const [r] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('admin delete user:', err.message);
    res.status(500).json({ message: 'Could not delete user' });
  }
});

router.get('/posts', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const w = q ? 'WHERE p.content LIKE ? OR u.name LIKE ? OR u.username LIKE ?' : '';
    const args = q ? Array(3).fill(`%${q}%`) : [];
    const [rows] = await pool.query(
      `SELECT p.id, p.content, p.image_url AS image, (SELECT COUNT(*) FROM post_images pi WHERE pi.post_id = p.id) AS image_count, p.created_at, u.id AS user_id, u.name AS user_name, u.username,
              (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS likes_count,
              (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id) AS comments_count
       FROM posts p JOIN users u ON u.id = p.user_id ${w}
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [...args, limit, offset]
    );
    // Attach every image URL so the dashboard can show previews (older posts only have image_url).
    if (rows.length) {
      const [imgs] = await pool.query('SELECT post_id, url FROM post_images WHERE post_id IN (?) ORDER BY post_id, position, id', [rows.map((r) => r.id)]);
      const byPost = {};
      for (const i of imgs) (byPost[i.post_id] ||= []).push(i.url);
      for (const r of rows) r.images = byPost[r.id] || (r.image ? [r.image] : []);
    }
    const [[t]] = await pool.query(`SELECT COUNT(*) AS c FROM posts p JOIN users u ON u.id = p.user_id ${w}`, args);
    sendList(res, rows, t.c);
  } catch (err) {
    res.status(500).json({ message: 'Could not load posts' });
  }
});

router.delete('/posts/:id', async (req, res) => {
  try {
    const [r] = await pool.query('DELETE FROM posts WHERE id = ?', [Number(req.params.id)]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Post not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete post' });
  }
});

router.get('/groups', async (req, res) => {
  try {
    const { limit, offset, q } = pageParams(req, 50, 200);
    const w = q ? 'WHERE (g.name LIKE ? OR u.name LIKE ?)' : '';
    const args = q ? [like(q), like(q)] : [];
    const [[t]] = await pool.query(`SELECT COUNT(*) AS c FROM \`groups\` g LEFT JOIN users u ON u.id = g.created_by ${w}`, args);
    const [rows] = await pool.query(
      `SELECT g.id, g.name, g.type, g.created_at, u.name AS owner_name,
              (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id AND m.status = 'active') AS member_count
       FROM \`groups\` g LEFT JOIN users u ON u.id = g.created_by ${w} ORDER BY g.created_at DESC LIMIT ? OFFSET ?`, [...args, limit, offset]
    );
    sendList(res, rows, t.c);
  } catch (err) {
    res.status(500).json({ message: 'Could not load groups' });
  }
});

router.delete('/groups/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [convs] = await pool.query('SELECT id FROM conversations WHERE group_id = ?', [id]);
    for (const c of convs) rt.emitToUsers(await participantIds(c.id), 'conversation_removed', { group_id: id, conversation_id: c.id });
    await pool.query('DELETE FROM conversations WHERE group_id = ?', [id]);
    const [r] = await pool.query('DELETE FROM `groups` WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Group not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('admin delete group:', err.message);
    res.status(500).json({ message: 'Could not delete group' });
  }
});

router.get('/conversations', async (req, res) => {
  try {
    const { limit, offset, q } = pageParams(req, 50, 200);
    const type = ['direct', 'group'].includes(String(req.query.type)) ? String(req.query.type) : '';
    const where = []; const args = [];
    if (q) { where.push('c.name LIKE ?'); args.push(like(q)); }
    if (type) { where.push('c.type = ?'); args.push(type); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[t]] = await pool.query(`SELECT COUNT(*) AS c FROM conversations c ${w}`, args);
    const [convs] = await pool.query(
      `SELECT c.id, c.name, c.type, c.created_at, COUNT(cp.user_id) AS participant_count,
              (SELECT MAX(created_at) FROM messages m WHERE m.conversation_id = c.id) AS last_message_at,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
       FROM conversations c LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id ${w}
       GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?`, [...args, limit, offset]
    );
    sendList(res, convs, t.c);
  } catch (err) {
    res.status(500).json({ message: 'Could not load conversations' });
  }
});

// Message history of one conversation. Admin/owner only (see permissionRoles): private content.
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid conversation id' });
    const { limit, offset } = pageParams(req, 50, 200);
    const [[conv]] = await pool.query('SELECT id, name, type FROM conversations WHERE id = ?', [id]);
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    const [[t]] = await pool.query('SELECT COUNT(*) AS c FROM messages WHERE conversation_id = ?', [id]);
    const [rows] = await pool.query(
      `SELECT m.id, m.type, m.content, m.file_name, m.created_at, u.id AS sender_id, u.name AS sender_name, u.username
       FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.conversation_id = ? ORDER BY m.id DESC LIMIT ? OFFSET ?`,
      [id, limit, offset]
    );
    res.set('X-Total-Count', String(t.c));
    res.json({ conversation: conv, items: rows });
  } catch { res.status(500).json({ message: 'Could not load messages' }); }
});

router.delete('/conversations/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [found] = await pool.query('SELECT group_id FROM conversations WHERE id = ?', [id]);
    if (found[0] && found[0].group_id) return res.status(400).json({ message: 'Delete the group instead' });
    rt.emitToUsers(await participantIds(id), 'conversation_removed', { conversation_id: id });
    const [r] = await pool.query('DELETE FROM conversations WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ message: 'Conversation not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete conversation' });
  }
});

// Who an announcement reaches: everyone, recently active users, or specific user ids
async function audienceIds(audience, userIds) {
  if (audience === 'users') {
    const wanted = [...new Set((Array.isArray(userIds) ? userIds : []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0))].slice(0, 500);
    if (!wanted.length) return null;
    const [rows] = await pool.query('SELECT id FROM users WHERE banned = 0 AND id IN (?)', [wanted]);
    return rows.length ? rows.map((u) => Number(u.id)) : null;
  }
  const days = audience === 'active7' ? 7 : audience === 'active30' ? 30 : 0;
  const [rows] = days
    ? await pool.query('SELECT id FROM users WHERE banned = 0 AND last_seen >= DATE_SUB(NOW(), INTERVAL ? DAY)', [days])
    : await pool.query('SELECT id FROM users WHERE banned = 0');
  return rows.map((u) => Number(u.id));
}
router.get('/broadcast/audience', async (req, res) => {
  try {
    const days = req.query.audience === 'active7' ? 7 : req.query.audience === 'active30' ? 30 : 0;
    const [[row]] = days
      ? await pool.query('SELECT COUNT(*) AS c FROM users WHERE banned = 0 AND last_seen >= DATE_SUB(NOW(), INTERVAL ? DAY)', [days])
      : await pool.query('SELECT COUNT(*) AS c FROM users WHERE banned = 0');
    res.json({ count: Number(row.c) });
  } catch { res.status(500).json({ message: 'Could not count the audience' }); }
});
router.post('/broadcast', async (req, res) => {
  const title = String(req.body.title || '').trim();
  const body = String(req.body.body || '').trim();
  if (!title || !body) return res.status(400).json({ message: 'Title and body are required' });
  if (title.length > 120) return res.status(400).json({ message: 'Title must be 120 characters or fewer' });
  if (body.length > 1500) return res.status(400).json({ message: 'Body must be 1500 characters or fewer' });
  try {
    // Idempotent: the console sends a requestId per form; a retry/double click returns the first result.
    const requestId = String(req.body.requestId || '').slice(0, 64);
    if (requestId) {
      const prior = await kv.get('broadcast_req:' + requestId);
      if (prior) return res.json({ ...JSON.parse(prior), duplicate: true });
    }
    const ids = await audienceIds(req.body.audience, req.body.userIds);
    if (ids === null) return res.status(400).json({ message: 'Choose at least one valid user for a targeted announcement' });
    if (ids.length) {
      const broadcastId = crypto.randomUUID();
      for (let offset = 0; offset < ids.length; offset += 500) {
        const batch = ids.slice(offset, offset + 500);
        const values = batch.map((userId) => [userId, 'broadcast', title, body, broadcastId, null]);
        await pool.query(
          'INSERT INTO notifications (user_id, type, title, body, broadcast_id, from_user_id) VALUES ?',
          [values]
        );
        // Read back the actual auto-increment IDs; never assume a bulk insert is consecutive.
        const [created] = await pool.query(
          'SELECT id, user_id, created_at FROM notifications WHERE broadcast_id = ? AND user_id IN (?) ORDER BY id ASC',
          [broadcastId, batch]
        );
        const byUser = new Map(created.map((row) => [Number(row.user_id), row]));
        for (const userId of batch) {
          const row = byUser.get(userId);
          if (!row) continue;
          const notification = {
            id: String(row.id),
            type: 'broadcast',
            title,
            body,
            from: { id: 'system', name: 'Special', username: 'special', avatar: null },
            createdAt: row.created_at,
            read: false,
          };
          rt.emitToUser(userId, 'notification', notification);
          rt.emitToUser(userId, 'broadcast', { title, body, notificationId: notification.id });
        }
      }
      await pushToUsers(ids, {
        title,
        body,
        data: { type: 'notification', notificationType: 'broadcast', broadcastId },
      });
    }
    const result = { success: true, message: `Broadcast sent to ${ids.length} users`, count: ids.length };
    if (requestId) await kv.set('broadcast_req:' + requestId, JSON.stringify(result), 600);
    res.json(result);
  } catch (err) {
    console.error('admin broadcast:', err.message);
    res.status(500).json({ message: 'Broadcast failed' });
  }
});

// Past announcements (one row per broadcast), newest first
router.get('/broadcasts', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT n.broadcast_id, MAX(n.title) AS title, MAX(n.body) AS body, COUNT(*) AS recipients,
              SUM(n.read_at IS NOT NULL) AS read_count, SUM(u.push_token IS NOT NULL) AS push_capable, MIN(n.created_at) AS created_at
       FROM notifications n LEFT JOIN users u ON u.id = n.user_id WHERE n.broadcast_id IS NOT NULL
       GROUP BY n.broadcast_id ORDER BY created_at DESC LIMIT 30`
    );
    res.json(rows.map((r) => ({ ...r, recipients: Number(r.recipients), read_count: Number(r.read_count || 0), push_capable: Number(r.push_capable || 0) })));
  } catch (err) {
    console.error('admin broadcasts:', err.message);
    res.status(500).json({ message: 'Could not load announcements' });
  }
});

// How many accounts can actually receive a mobile push
router.get('/push/stats', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT COUNT(*) AS total, SUM(push_token IS NOT NULL) AS with_token FROM users WHERE banned = 0'
    );
    const [[me]] = await pool.query('SELECT push_token IS NOT NULL AS has_token FROM users WHERE id = ?', [req.user.id]);
    res.json({ total: Number(row.total || 0), withToken: Number(row.with_token || 0), adminHasToken: !!(me && me.has_token) });
  } catch (err) {
    res.status(500).json({ message: 'Could not load push stats' });
  }
});

// Sends a test push to the signed-in admin's own device
router.post('/push/test', async (req, res) => {
  try {
    const [[me]] = await pool.query('SELECT push_token FROM users WHERE id = ?', [req.user.id]);
    if (!me || !me.push_token) return res.status(409).json({ message: 'لا يوجد جهاز مسجّل لحسابك. افتح التطبيق على هاتفك وسجّل الدخول أولاً.' });
    await pushToUsers([req.user.id], { title: 'Special', body: 'اختبار الإشعارات يعمل بنجاح ✅', data: { type: 'notification', notificationType: 'broadcast', test: true } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Could not send test push' });
  }
});

// ---------- Report decision log + appeals ----------
router.get('/reports-log', async (req, res) => {
  try {
    const { limit, offset } = pageParams(req, 30);
    const reportId = Number(req.query.report) || null;
    const where = reportId ? 'WHERE d.report_id = ?' : '';
    const params = reportId ? [reportId] : [];
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM report_decisions d ${where}`, params);
    const [rows] = await pool.query(
      `SELECT d.id, d.report_id, d.decision, d.action, d.note, d.created_at, a.name AS admin_name, a.username AS admin_username,
              r.target_type, r.target_id, r.reason
       FROM report_decisions d LEFT JOIN users a ON a.id = d.admin_id LEFT JOIN reports r ON r.id = d.report_id
       ${where} ORDER BY d.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    sendList(res, rows, total);
  } catch { res.status(500).json({ message: 'Could not load the decision log' }); }
});

router.get('/appeals', async (req, res) => {
  try {
    const { limit, offset } = pageParams(req, 30);
    const status = ['pending', 'accepted', 'denied'].includes(req.query.status) ? req.query.status : 'pending';
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM appeals WHERE status = ?', [status]);
    const [rows] = await pool.query(
      `SELECT a.id, a.user_id, a.kind, a.message, a.status, a.review_note, a.created_at, a.reviewed_at, a.decision_id,
              u.name, u.username, u.banned
       FROM appeals a JOIN users u ON u.id = a.user_id WHERE a.status = ? ORDER BY a.created_at DESC LIMIT ? OFFSET ?`, [status, limit, offset]);
    sendList(res, rows.map((r) => ({ ...r, banned: !!r.banned })), total);
  } catch { res.status(500).json({ message: 'Could not load appeals' }); }
});

router.post('/appeals/:id/decide', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const accept = req.body.accept === true;
    const note = String(req.body.note || '').trim().slice(0, 300);
    const [rows] = await pool.query("SELECT id, user_id, kind FROM appeals WHERE id = ? AND status = 'pending'", [id]);
    if (!rows.length) return res.status(404).json({ message: 'Pending appeal not found' });
    const a = rows[0];
    if (accept && a.kind === 'account') await pool.query('UPDATE users SET banned = 0 WHERE id = ?', [a.user_id]);
    await pool.query('UPDATE appeals SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = NOW() WHERE id = ?', [accept ? 'accepted' : 'denied', req.user.id, note || null, id]);
    require('../services/notify').systemNotice(a.user_id,
      accept ? 'تم قبول اعتراضك' : 'تم رفض اعتراضك',
      note || (accept ? 'راجعنا القرار وتم تعديله لصالحك.' : 'راجعنا القرار وبقي كما هو.'), { appeal: accept ? 'accepted' : 'denied' });
    res.json({ success: true });
  } catch { res.status(500).json({ message: 'Could not save the appeal decision' }); }
});

// ---------- Alerts ----------
router.get('/alerts', async (req, res) => {
  try {
    const alerts = require('../services/alerts');
    const [rows] = await pool.query('SELECT id, kind, message, value, created_at FROM admin_alerts ORDER BY id DESC LIMIT 50');
    res.json({ metrics: require('../services/metrics').snapshot(), thresholds: alerts.thresholds(), webhook: !!process.env.ALERT_WEBHOOK_URL, items: rows });
  } catch { res.status(500).json({ message: 'Could not load alerts' }); }
});

// OTP delivery monitor: event log (codes are never stored) + live WhatsApp connection state.
router.get('/otp-events', async (req, res) => {
  try {
    const { limit, offset, q } = pageParams(req, 50, 200);
    const event = ['sent', 'send_failed', 'verified', 'rejected', 'blocked'].includes(req.query.event) ? req.query.event : '';
    const where = []; const args = [];
    if (q) { where.push('phone LIKE ?'); args.push(like(q)); }
    if (event) { where.push('event = ?'); args.push(event); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[t]] = await pool.query(`SELECT COUNT(*) AS c FROM otp_events ${w}`, args);
    const [rows] = await pool.query(`SELECT id, phone, event, detail, created_at FROM otp_events ${w} ORDER BY id DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
    const [[today]] = await pool.query("SELECT COUNT(*) AS total, SUM(event = 'sent') AS sent, SUM(event = 'send_failed') AS failed, SUM(event = 'verified') AS verified FROM otp_events WHERE created_at >= CURDATE()");
    const wa = require('../services/whatsapp');
    const st = typeof wa.getState === 'function' ? await wa.getState().catch(() => null) : null;
    res.set('X-Total-Count', String(t.c));
    res.json({
      items: rows,
      today: { total: Number(today.total || 0), sent: Number(today.sent || 0), failed: Number(today.failed || 0), verified: Number(today.verified || 0) },
      whatsapp: st ? { status: st.status, ready: !!st.ready, account: st.account || null, error: st.error || null } : { status: 'unknown', ready: false },
    });
  } catch { res.status(500).json({ message: 'Could not load OTP events' }); }
});

// --- reports from users ---
router.get('/reports', async (req, res) => {
  try {
    const status = ['open', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
    const type = ['user', 'post', 'comment', 'message', 'story'].includes(req.query.type) ? req.query.type : '';
    const { limit, offset } = pageParams(req, 30, 100);
    const where = ['r.status = ?']; const args = [status];
    if (type) { where.push('r.target_type = ?'); args.push(type); }
    const w = `WHERE ${where.join(' AND ')}`;
    const [[t]] = await pool.query(`SELECT COUNT(*) AS c FROM reports r ${w}`, args);
    const [rows] = await pool.query(
      `SELECT r.*, u.name AS reporter_name, u.username AS reporter_username,
              (SELECT COUNT(*) FROM reports x WHERE x.target_type = r.target_type AND x.target_id = r.target_id) AS reports_on_target
       FROM reports r JOIN users u ON u.id = r.reporter_id ${w} ORDER BY r.id DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
    // Preview what was reported. Private message text is never shown: admins only see who sent it and what kind it is.
    const ids = (kind) => [...new Set(rows.filter((r) => r.target_type === kind).map((r) => r.target_id))];
    const fetchMap = async (kind, sql) => {
      const list = ids(kind);
      if (!list.length) return new Map();
      const [found] = await pool.query(sql, [list]);
      return new Map(found.map((x) => [Number(x.id), x]));
    };
    const [users, posts, comments, messages, stories] = await Promise.all([
      fetchMap('user', 'SELECT id, name, username, banned FROM users WHERE id IN (?)'),
      fetchMap('post', 'SELECT p.id, p.content, p.user_id, u.name AS author FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id IN (?)'),
      fetchMap('comment', 'SELECT c.id, c.content, c.user_id, u.name AS author FROM post_comments c JOIN users u ON u.id = c.user_id WHERE c.id IN (?)'),
      fetchMap('message', 'SELECT m.id, m.type, m.sender_id AS user_id, u.name AS author FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id IN (?)'),
      fetchMap('story', 'SELECT s.id, COALESCE(s.caption, s.text_content) AS content, s.user_id, u.name AS author FROM stories s JOIN users u ON u.id = s.user_id WHERE s.id IN (?)'),
    ]);
    const maps = { user: users, post: posts, comment: comments, message: messages, story: stories };
    sendList(res, rows.map((r) => {
      const hit = maps[r.target_type].get(Number(r.target_id));
      const preview = hit ? {
        author: hit.author || hit.name || null,
        authorId: hit.user_id || (r.target_type === 'user' ? hit.id : null),
        text: r.target_type === 'message' ? null : String(hit.content || '').slice(0, 300) || null,
        kind: hit.type || null,
        banned: hit.banned ? true : undefined,
      } : null;
      return { ...r, reports_on_target: Number(r.reports_on_target), target_missing: !hit, preview };
    }), t.c);
  } catch (err) {
    res.status(500).json({ message: 'Could not load reports' });
  }
});

// { status: 'resolved' | 'dismissed', delete_content?: true }
router.post('/reports/:id/resolve', async (req, res) => {
  try {
    const reportId = Number(req.params.id);
    if (!Number.isSafeInteger(reportId) || reportId < 1) return res.status(400).json({ message: 'Invalid report id' });
    const [rows] = await pool.query('SELECT * FROM reports WHERE id = ?', [reportId]);
    if (!rows.length) return res.status(404).json({ message: 'Report not found' });
    const r = rows[0];
    if (req.body.delete_content === true) {
      const t = { post: 'posts', message: 'messages', story: 'stories' }[r.target_type];
      if (r.target_type === 'comment') {
        // Replies have no parent_id foreign key; remove them explicitly with the parent.
        await pool.query('DELETE FROM post_comments WHERE id = ? OR parent_id = ?', [r.target_id, r.target_id]);
      } else if (t) {
        await pool.query(`DELETE FROM ${t} WHERE id = ?`, [r.target_id]);
      }
    }
    const decision = req.body.status === 'dismissed' ? 'dismissed' : 'resolved';
    await pool.query('UPDATE reports SET status = ? WHERE id = ?', [decision, r.id]);
    const action = req.body.delete_content === true ? 'deleted_content' : (req.body.banned_user ? 'banned_user' : 'none');
    pool.query('INSERT INTO report_decisions (report_id, admin_id, decision, action, note) VALUES (?, ?, ?, ?, ?)',
      [r.id, req.user.id, decision, action, String(req.body.note || '').trim().slice(0, 300) || null]).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Could not update report' });
  }
});

// Signs the user out of every device (e.g. a compromised account)
router.post('/users/:id/sessions/revoke', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid user id' });
    if (id === req.user.id) return res.status(400).json({ message: 'Use the app to sign out of your own devices' });
    const [r] = await pool.query('UPDATE device_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [id]);
    rt.disconnectUser(id);
    res.json({ success: true, revoked: r.affectedRows });
  } catch (err) {
    res.status(500).json({ message: 'Could not end the sessions' });
  }
});

// Toggles the ban state (or sets it with { banned: true|false })
// ---------- Verification (blue check) ----------
router.get('/verifications', async (req, res) => {
  try {
    const { limit, offset } = pageParams(req, 30);
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : null;
    const where = status ? 'WHERE v.status = ?' : '';
    const params = status ? [status] : [];
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM verification_requests v ${where}`, params);
    const [rows] = await pool.query(
      `SELECT v.id, v.user_id, v.category, v.reason, v.link, v.status, v.review_note, v.created_at, v.reviewed_at,
              u.name, u.username, u.avatar, u.verified,
              (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) AS followers,
              (SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id) AS posts
       FROM verification_requests v JOIN users u ON u.id = v.user_id ${where}
       ORDER BY (v.status = 'pending') DESC, v.created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    sendList(res, rows, total);
  } catch { res.status(500).json({ message: 'Could not load verification requests' }); }
});

async function setVerified(userId, value, adminId, note, requestId) {
  await pool.query('UPDATE users SET verified = ?, verified_at = ? WHERE id = ?', [value ? 1 : 0, value ? new Date() : null, userId]);
  require('../services/verified').set(userId, value);
  if (requestId) {
    await pool.query('UPDATE verification_requests SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = NOW() WHERE id = ?',
      [value ? 'approved' : 'rejected', adminId, note || null, requestId]);
  }
}

router.post('/verifications/:id/decide', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const approve = req.body.approve === true;
    const note = String(req.body.note || '').trim().slice(0, 250);
    const [rows] = await pool.query("SELECT id, user_id FROM verification_requests WHERE id = ? AND status = 'pending'", [id]);
    if (!rows.length) return res.status(404).json({ message: 'Pending request not found' });
    const userId = rows[0].user_id;
    if (approve) await setVerified(userId, true, req.user.id, note, id);
    else {
      await pool.query("UPDATE verification_requests SET status = 'rejected', reviewed_by = ?, review_note = ?, reviewed_at = NOW() WHERE id = ?", [req.user.id, note || null, id]);
    }
    require('../services/notify').systemNotice(userId,
      approve ? 'تم توثيق حسابك' : 'تعذر توثيق حسابك',
      approve ? 'تهانينا! أصبح حسابك يحمل علامة التحقق.' : (note || 'لم نتمكن من الموافقة على طلب التوثيق هذه المرة.'),
      { verification: approve ? 'approved' : 'rejected' });
    res.json({ success: true });
  } catch { res.status(500).json({ message: 'Could not save the decision' }); }
});

// Grant or remove the badge directly (no request needed)
router.post('/verifications/user/:userId', async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const value = req.body.verified === true;
    const [u] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!u.length) return res.status(404).json({ message: 'User not found' });
    await setVerified(userId, value, req.user.id, null, null);
    res.json({ success: true, verified: value });
  } catch { res.status(500).json({ message: 'Could not update verification' }); }
});

router.get('/ai/usage', async (req, res) => {
  try {
    const quota = require('../services/aiQuota');
    const [daily] = await pool.query('SELECT day, SUM(requests) AS requests, SUM(tokens) AS tokens, COUNT(*) AS users FROM ai_usage WHERE day >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY day ORDER BY day');
    const [top] = await pool.query(
      `SELECT a.user_id, u.name, u.username, SUM(a.requests) AS requests, SUM(a.tokens) AS tokens
       FROM ai_usage a JOIN users u ON u.id = a.user_id WHERE a.day >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY a.user_id, u.name, u.username ORDER BY tokens DESC, requests DESC LIMIT 10`);
    const tokens = daily.reduce((n, d) => n + Number(d.tokens), 0);
    res.json({
      limits: quota.limits(), configured: !!(process.env.AI_API_KEY && process.env.AI_MODEL),
      totals: { requests: daily.reduce((n, d) => n + Number(d.requests), 0), tokens, estimatedCost: quota.estimateCost(tokens), costPer1k: quota.costPer1k() },
      daily: daily.map((d) => ({ day: d.day, requests: Number(d.requests), tokens: Number(d.tokens), users: Number(d.users) })),
      top,
    });
  } catch { res.status(500).json({ message: 'Could not load AI usage' }); }
});

router.post('/users/:id/warn', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const message = String(req.body.message || '').trim().slice(0, 500);
    if (!Number.isInteger(id) || id <= 0 || !message) return res.status(400).json({ message: 'A user and warning message are required' });
    const [users] = await pool.query('SELECT id FROM users WHERE id = ? AND banned = 0', [id]);
    if (!users.length) return res.status(404).json({ message: 'Active user not found' });
    const title = 'تنبيه إداري من Special';
    const [created] = await pool.query(
      "INSERT INTO notifications (user_id, type, title, body, from_user_id) VALUES (?, 'broadcast', ?, ?, NULL)",
      [id, title, message]
    );
    const notification = { id: String(created.insertId), type: 'broadcast', title, body: message, from: { id: 'system', name: 'Special', username: 'special', avatar: null }, createdAt: new Date().toISOString(), read: false };
    rt.emitToUser(id, 'notification', notification);
    pushToUsers([id], { title, body: message, data: { type: 'notification', notificationType: 'broadcast', notificationId: notification.id, adminWarning: true } }).catch(() => {});
    res.status(201).json({ success: true });
  } catch { res.status(500).json({ message: 'Could not send user warning' }); }
});

router.post('/users/:id/ban', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (await isAdminId(id)) return res.status(400).json({ message: 'Admins cannot be banned' });
    const [rows] = await pool.query('SELECT banned FROM users WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    const banned = typeof req.body.banned === 'boolean' ? req.body.banned : !rows[0].banned;
    let until = null;
    if (banned && req.body.until) {
      until = new Date(req.body.until);
      const max = new Date(Date.now() + 365 * 864e5);
      if (Number.isNaN(until.getTime()) || until <= new Date() || until > max) {
        return res.status(400).json({ message: 'Invalid ban duration' });
      }
    }
    await pool.query('UPDATE users SET banned = ?, banned_until = ?, push_token = IF(?, NULL, push_token) WHERE id = ?', [banned ? 1 : 0, until, banned ? 1 : 0, id]);
    if (banned) rt.disconnectUser(id);
    res.json({ success: true, banned, until });
  } catch (err) {
    res.status(500).json({ message: 'Could not update user' });
  }
});


 // Runtime health without exposing environment values or secrets.
router.get('/system', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    const memory = process.memoryUsage();
    res.json({
      status: 'ok',
      database: 'connected',
      redis: require('../services/redis').client ? (require('../services/redis').isReady() ? 'connected' : 'connecting') : 'not_configured',
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      memory: { rss: Math.round(memory.rss / 1024 / 1024), heapUsed: Math.round(memory.heapUsed / 1024 / 1024), heapTotal: Math.round(memory.heapTotal / 1024 / 1024) },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});

 // Active device sessions across the service. Tokens and token hashes are never exposed.
router.get('/sessions', async (req, res) => {
  try {
    const { limit, offset, q } = pageParams(req, 50, 200);
    const w = q ? 'AND (u.name LIKE ? OR u.username LIKE ? OR u.phone LIKE ? OR ds.device_name LIKE ?)' : '';
    const args = q ? Array(4).fill(like(q)) : [];
    const base = `FROM device_sessions ds JOIN users u ON u.id = ds.user_id WHERE ds.revoked_at IS NULL AND ds.expires_at > NOW() ${w}`;
    const [[t]] = await pool.query(`SELECT COUNT(*) AS c ${base}`, args);
    const [rows] = await pool.query(
      `SELECT ds.id, ds.user_id, ds.device_name, ds.platform, ds.ip, ds.user_agent, ds.created_at,
              ds.last_active_at, ds.expires_at, u.name AS user_name, u.username, u.phone, u.banned
       ${base} ORDER BY ds.last_active_at DESC LIMIT ? OFFSET ?`, [...args, limit, offset]
    );
    sendList(res, rows.map((row) => ({ ...row, banned: !!row.banned, is_current: row.id === req.user.sessionId })), t.c);
  } catch (err) {
    res.status(500).json({ message: 'Could not load sessions' });
  }
});

router.delete('/sessions/:id', async (req, res) => {
  try {
    const sessionId = String(req.params.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return res.status(400).json({ message: 'Invalid session id' });
    if (sessionId === req.user.sessionId) return res.status(400).json({ message: 'You cannot revoke the session currently used by this dashboard' });
    const [result] = await pool.query(
      'UPDATE device_sessions SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL',
      [sessionId]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Session not found or already revoked' });
    rt.disconnectSession(sessionId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Could not revoke session' });
  }
});

// Non-secret configuration status for the settings page: booleans and labels only, never values.
router.get('/settings', async (req, res) => {
  try {
    const wa = require('../services/whatsapp');
    const st = typeof wa.getState === 'function' ? await wa.getState().catch(() => null) : null;
    let backupsConfigured = false;
    try { require('../services/adminBackups').config(); backupsConfigured = true; } catch { /* not configured */ }
    res.json({
      environment: process.env.NODE_ENV || 'development',
      otpDevMode: !!require('../config').OTP_DEV_MODE,
      whatsapp: st ? { status: st.status, ready: !!st.ready, account: st.account || null } : { status: 'unknown', ready: false },
      backups: { configured: backupsConfigured, offhost: require('../services/offhost').isConfigured(), autoHours: Number(process.env.BACKUP_AUTO_HOURS) || 0 },
      alertWebhook: !!process.env.ALERT_WEBHOOK_URL,
      ai: { configured: !!(process.env.AI_API_KEY && process.env.AI_MODEL) },
      redis: require('../services/redis').client ? 'configured' : 'not_configured',
    });
  } catch { res.status(500).json({ message: 'Could not load settings' }); }
});

// Advertising campaign management; mobile placements are a separate rollout.
router.get('/campaigns', async (req, res) => {
  try { const [rows] = await pool.query('SELECT * FROM ad_campaigns ORDER BY created_at DESC LIMIT 200'); res.json(rows); }
  catch { res.status(500).json({ message: 'Could not load campaigns' }); }
});
router.post('/campaigns', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim().slice(0, 120);
    const headline = String(req.body.headline || '').trim().slice(0, 180);
    const body = String(req.body.body || '').trim().slice(0, 5000);
    const targetUrl = String(req.body.target_url || '').trim();
    const mediaUrl = String(req.body.media_url || '').trim().slice(0, 500) || null;
    const audience = ['all', 'new', 'active'].includes(req.body.audience) ? req.body.audience : 'all';
    const status = ['draft', 'active', 'paused'].includes(req.body.status) ? req.body.status : 'draft';
    const budget = Math.max(0, Math.min(100000000, Number(req.body.budget) || 0));
    const startsAt = req.body.starts_at || null, endsAt = req.body.ends_at || null;
    let target; try { target = new URL(targetUrl); } catch { return res.status(400).json({ message: 'A valid destination URL is required' }); }
    if (!['https:', 'http:'].includes(target.protocol)) return res.status(400).json({ message: 'Destination must use HTTP or HTTPS' });
    if (!name || !headline) return res.status(400).json({ message: 'Campaign name and headline are required' });
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return res.status(400).json({ message: 'End date must be after start date' });
    const [result] = await pool.query('INSERT INTO ad_campaigns (name, headline, body, media_url, target_url, audience, status, budget, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [name, headline, body || null, mediaUrl, target.href, audience, status, budget, startsAt, endsAt, req.user.id]);
    res.status(201).json({ success: true, id: result.insertId });
  } catch { res.status(500).json({ message: 'Could not create campaign' }); }
});
router.put('/campaigns/:id/status', async (req, res) => {
  try {
    const status = String(req.body.status || '');
    if (!['draft', 'active', 'paused', 'ended'].includes(status)) return res.status(400).json({ message: 'Invalid campaign status' });
    const [result] = await pool.query('UPDATE ad_campaigns SET status = ? WHERE id = ?', [status, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Campaign not found' });
    res.json({ success: true });
  } catch { res.status(500).json({ message: 'Could not update campaign' }); }
});
router.delete('/campaigns/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM ad_campaigns WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Campaign not found' });
    res.json({ success: true });
  } catch { res.status(500).json({ message: 'Could not delete campaign' }); }
});
router.get('/backups', async (req, res) => {
  try {
    const files = await adminBackups.list();
    let runs = [];
    try { [runs] = await pool.query('SELECT id, kind, file, ok, detail, created_at FROM backup_runs ORDER BY id DESC LIMIT 30'); } catch { /* table missing */ }
    res.json({ files, runs: runs.map((r) => ({ ...r, ok: !!r.ok })), offhost: require('../services/offhost').isConfigured(), autoHours: Number(process.env.BACKUP_AUTO_HOURS) || 0 });
  } catch (error) { res.status(503).json({ message: error.message || 'Backups are not configured' }); }
});
router.post('/backups/run', async (req, res) => {
  try { const r = await require('../services/backupJob').runOnce(); res.status(r.ok ? 201 : 502).json(r); }
  catch (error) { res.status(503).json({ message: error.message || 'Backup job failed' }); }
});
router.post('/backups/:file/verify', async (req, res) => {
  try { res.json(await require('../services/backupJob').verifyLocal(req.params.file)); }
  catch (error) { res.status(503).json({ message: error.message || 'Could not verify backup' }); }
});
router.post('/backups/:file/upload', async (req, res) => {
  try { await require('../services/backupJob').uploadAndCheck(req.params.file); res.json({ success: true }); }
  catch (error) { res.status(503).json({ message: error.message || 'Could not upload backup' }); }
});
router.post('/backups', async (req, res) => {
  try { res.status(201).json(await adminBackups.create()); }
  catch (error) { res.status(503).json({ message: error.message || 'Could not create backup' }); }
});
router.post('/backups/:file/restore', async (req, res) => {
  try {
    if (String(req.body.confirmDatabase || '') !== String(process.env.DB_NAME || 'echat')) return res.status(400).json({ message: 'Type the exact database name to confirm restore' });
    await adminBackups.restore(req.params.file);
    res.json({ success: true, message: 'Database restore completed' });
  } catch (error) { res.status(503).json({ message: error.message || 'Could not restore backup' }); }
});
router.delete('/backups/:file', async (req, res) => {
  try { await adminBackups.remove(req.params.file); res.json({ success: true }); }
  catch (error) { res.status(503).json({ message: error.message || 'Could not delete backup' }); }
});

module.exports = router;
