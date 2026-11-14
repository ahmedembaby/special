const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const rt = require('../services/realtime');
const { pushToUsers } = require('../services/push');
const { adminMiddleware, isAdminId, isAdminUser } = require('../middleware/auth');
const { participantIds } = require('../services/chat');

const router = express.Router();
router.use(adminMiddleware); // mounted behind authMiddleware in index.js

const permissionRoles = (req) => {
  const p = req.path;
  const write = req.method !== 'GET';
  if (p.startsWith('/admins') || p.startsWith('/backups')) return ['owner'];
  if (p.startsWith('/reports') || p.startsWith('/posts') || p.startsWith('/groups') || p.startsWith('/banned-words')) return ['owner', 'admin', 'moderator'];
  if (['/stats', '/system', '/release', '/users', '/sessions', '/conversations'].some((prefix) => p === prefix || p.startsWith(prefix + '/'))) {
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
    const owners = await pool.query('SELECT id, name, username, phone FROM users WHERE id IN (?)', [isAdminId ? [0] : [0]]).catch(() => [[]]);
    res.json({ admins: rows, owners: owners[0] || [] });
  } catch { res.status(500).json({ message: 'Could not load admin roles' }); }
});
router.post('/admins', async (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const role = String(req.body.role || '');
    if (!Number.isInteger(userId) || userId <= 0 || !['admin', 'moderator', 'support'].includes(role)) {
      return res.status(400).json({ message: 'Choose a valid user and role' });
    }
    const [users] = await pool.query('SELECT id FROM users WHERE id = ? AND banned = 0', [userId]);
    if (!users.length) return res.status(404).json({ message: 'User not found' });
    if (await isAdminId(userId)) return res.status(409).json({ message: 'Bootstrap owners cannot be changed here' });
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

router.get('/release', async (req, res) => {
  try {
    const serverPackage = require('../package.json');
    const mobilePackage = require('../../mobile/package.json');
    res.json({
      serverVersion: serverPackage.version || 'unknown',
      mobileVersion: mobilePackage.version || 'unknown',
      appVersion: mobilePackage.expo?.version || 'unknown',
      commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || process.env.SOURCE_VERSION || null,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      checkedAt: new Date().toISOString(),
    });
  } catch { res.status(500).json({ message: 'Could not load release information' }); }
});

router.get('/audit', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT a.*, u.name AS admin_name FROM admin_audit a JOIN users u ON u.id = a.admin_id ORDER BY a.id DESC LIMIT 200');
    res.json(rows);
  } catch { res.status(500).json({ message: 'Could not load the audit log' }); }
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
    const [[callsToday]] = await pool.query('SELECT COUNT(*) AS c FROM calls WHERE created_at >= CURDATE()');
    const [[media]] = await pool.query('SELECT COUNT(*) AS files, COALESCE(SUM(file_size), 0) AS bytes FROM messages WHERE file_url IS NOT NULL');
    const series = async (table) => {
      const [rows] = await pool.query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS c FROM ${table}
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY d`
      );
      const map = new Map(rows.map((r) => [r.d, Number(r.c)]));
      const out = [];
      for (let i = 6; i >= 0; i--) {
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
      callsToday: Number(callsToday.c),
      media: { files: Number(media.files), bytes: Number(media.bytes) },
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
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[t]] = await pool.query(`SELECT COUNT(*) AS c FROM users ${w}`, args);
    const [users] = await pool.query(
      `SELECT id, name, username, email, phone, avatar, status, banned, last_seen, created_at FROM users ${w}
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
      'SELECT id, name, username, email, phone, avatar, bio, status, banned, last_seen, created_at FROM users WHERE id = ?', [id]
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
      },
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
    res.json(rows);
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
    const [rows] = await pool.query(
      `SELECT g.id, g.name, g.type, g.created_at, u.name AS owner_name,
              (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id AND m.status = 'active') AS member_count
       FROM \`groups\` g LEFT JOIN users u ON u.id = g.created_by ORDER BY g.created_at DESC LIMIT 500`
    );
    res.json(rows);
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
    const [convs] = await pool.query(
      `SELECT c.id, c.name, c.type, c.created_at, COUNT(cp.user_id) AS participant_count,
              (SELECT MAX(created_at) FROM messages m WHERE m.conversation_id = c.id) AS last_message_at,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
       FROM conversations c LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
       GROUP BY c.id ORDER BY c.created_at DESC LIMIT 500`
    );
    res.json(convs);
  } catch (err) {
    res.status(500).json({ message: 'Could not load conversations' });
  }
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

router.post('/broadcast', async (req, res) => {
  const title = String(req.body.title || '').trim();
  const body = String(req.body.body || '').trim();
  if (!title || !body) return res.status(400).json({ message: 'Title and body are required' });
  if (title.length > 120) return res.status(400).json({ message: 'Title must be 120 characters or fewer' });
  if (body.length > 1500) return res.status(400).json({ message: 'Body must be 1500 characters or fewer' });
  try {
    const [users] = await pool.query('SELECT id FROM users WHERE banned = 0');
    const ids = users.map((u) => Number(u.id));
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
        data: { type: 'broadcast', broadcastId },
      });
    }
    res.json({ success: true, message: `Broadcast sent to ${ids.length} users`, count: ids.length });
  } catch (err) {
    console.error('admin broadcast:', err.message);
    res.status(500).json({ message: 'Broadcast failed' });
  }
});

// --- reports from users ---
router.get('/reports', async (req, res) => {
  try {
    const status = ['open', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
    const [rows] = await pool.query(
      `SELECT r.*, u.name AS reporter_name, u.username AS reporter_username FROM reports r JOIN users u ON u.id = r.reporter_id
       WHERE r.status = ? ORDER BY r.id DESC LIMIT 200`, [status]);
    res.json(rows);
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
    await pool.query('UPDATE reports SET status = ? WHERE id = ?', [req.body.status === 'dismissed' ? 'dismissed' : 'resolved', r.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Could not update report' });
  }
});

// Toggles the ban state (or sets it with { banned: true|false })
router.post('/users/:id/ban', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (await isAdminId(id)) return res.status(400).json({ message: 'Admins cannot be banned' });
    const [rows] = await pool.query('SELECT banned FROM users WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    const banned = typeof req.body.banned === 'boolean' ? req.body.banned : !rows[0].banned;
    await pool.query('UPDATE users SET banned = ?, push_token = IF(?, NULL, push_token) WHERE id = ?', [banned ? 1 : 0, banned ? 1 : 0, id]);
    if (banned) rt.disconnectUser(id);
    res.json({ success: true, banned });
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
    const [rows] = await pool.query(
      `SELECT ds.id, ds.user_id, ds.device_name, ds.platform, ds.created_at,
              ds.last_active_at, ds.expires_at, u.name AS user_name, u.username,
              u.phone, u.banned
       FROM device_sessions ds JOIN users u ON u.id = ds.user_id
       WHERE ds.revoked_at IS NULL AND ds.expires_at > NOW()
       ORDER BY ds.last_active_at DESC LIMIT 300`
    );
    res.json(rows.map((row) => ({ ...row, banned: !!row.banned, is_current: row.id === req.user.sessionId })));
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

module.exports = router;
