const pool = require('../db');
const rt = require('./realtime');
const { pushToUsers } = require('./push');
const { parse, inQuiet, pushAllowed } = require('./prefs');

let timer = null;
let running = false;

async function runDigest(now = new Date()) {
  if (running) return;
  running = true;
  try {
    const [users] = await pool.query('SELECT id, settings FROM users WHERE settings IS NOT NULL AND banned = 0');
    for (const user of users) {
      const settings = parse(user.settings);
      if (!settings.digest.enabled) continue;
      const offset = Number(settings.quiet.tz) || 0;
      const localTime = new Date(now.getTime() + offset * 60_000);
      const localHour = localTime.getUTCHours();
      if (localHour !== Number(settings.digest.hour)) continue;
      if (inQuiet(settings.quiet, now)) continue;
      const digestDate = localTime.toISOString().slice(0, 10);
      const [[counts]] = await pool.query(
        'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)',
        [user.id]
      );
      const total = Number(counts.total) || 0;
      if (!total) continue;
      const [insert] = await pool.query(
        'INSERT IGNORE INTO notification_digests (user_id, digest_date) VALUES (?, ?)',
        [user.id, digestDate]
      );
      if (insert.affectedRows !== 1) continue;
      const title = 'Your daily Special summary';
      const body = 'You have ' + total + ' unread notifications from the last 24 hours.';
      const [created] = await pool.query(
        'INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)',
        [user.id, 'digest', title, body]
      );
      rt.emitToUser(user.id, 'notification', {
        id: String(created.insertId),
        type: 'digest',
        title,
        body,
        from: { id: 'system', name: 'Special', username: 'special', avatar: null },
        createdAt: now.toISOString(),
        read: false,
      });
      const allowed = await pushAllowed([user.id], 'digest');
      if (allowed.length) await pushToUsers(allowed, { title, body, data: { type: 'digest' } }).catch(() => {});
    }
  } catch (error) {
    console.error('daily digest:', error.message);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  runDigest().catch(() => {});
  timer = setInterval(() => runDigest().catch(() => {}), 60_000);
  if (typeof timer.unref === 'function') timer.unref();
}

module.exports = { start, runDigest };
