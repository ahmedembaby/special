const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const { securityHeaders, limits } = require('./middleware/security');
const metrics = require('./services/metrics');

const config = require('./config');
const db = require('./db');
const redis = require('./services/redis');
const rt = require('./services/realtime');
const errorMonitor = require('./services/errorMonitor');

process.on('unhandledRejection', (reason) => { errorMonitor.record(reason, 'unhandledRejection'); console.error('🔴 Unhandled Rejection:', reason); });
process.on('uncaughtException', (err) => { errorMonitor.record(err, 'uncaughtException'); console.error('🔴 Uncaught Exception:', err); });

const { authMiddleware, authenticateToken, authenticateMediaToken, getToken } = require('./middleware/auth');
const { isParticipant } = require('./services/chat');

const app = express();
const server = http.createServer(app);
const corsOrigin = (origin, callback) => {
  if (!origin || config.CLIENT_ORIGINS.includes('*') || config.CLIENT_ORIGINS.includes(origin)) return callback(null, true);
  return callback(new Error('Origin not allowed by CORS'));
};
const io = new Server(server, { cors: { origin: corsOrigin, methods: ['GET', 'POST'] } });
rt.setIO(io);
app.set('io', io);

// Redis adapter (only needed for multi-instance deployments; optional)
if (redis.client) {
  const { createAdapter } = require('@socket.io/redis-adapter');
  let attached = false;
  redis.client.on('ready', () => {
    if (attached) return;
    attached = true;
    // The shared client sets enableOfflineQueue:false, and duplicate() inherits it. A fresh duplicate is not
    // connected yet, so the adapter's subscribe/psubscribe calls were rejected. The subscriber needs the queue on.
    const subClient = redis.client.duplicate({ enableOfflineQueue: true, maxRetriesPerRequest: null });
    subClient.on('error', () => {});
    io.adapter(createAdapter(redis.client, subClient));
    console.log('✅ Redis connected');
  });
}

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(securityHeaders({ isProd: config.isProd }));
app.use(metrics.middleware);
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '1mb' }));

const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});
// Private media requires a valid session and resource-level authorization.
const { canAccessChatMedia, canAccessStoryMedia } = require('./services/mediaAccess');
const { makePrivateUploadAuth } = require('./middleware/privateUpload');
const authorizePrivateUpload = makePrivateUploadAuth({ authenticateToken, authenticateMediaToken, getToken, canAccessChatMedia, canAccessStoryMedia, uploadsDir });
app.use('/uploads/chat', authorizePrivateUpload('chat'));
app.use('/uploads/stories', authorizePrivateUpload('stories'));
app.use('/uploads', express.static(uploadsDir, { fallthrough: true, index: false }));

const authLimiter = limits.auth();
const apiLimiter = limits.api();

// Fail fast with a clear message while the database is not available
app.get('/privacy', (req, res) => {
  const name = process.env.APP_NAME || 'Special';
  const email = process.env.SUPPORT_EMAIL || 'support@example.com';
  res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} Privacy Policy</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;line-height:1.6;color:#0f1419}h1{font-size:26px}h2{font-size:18px;margin-top:24px}</style></head><body>
<h1>${name} Privacy Policy</h1><p><i>Template: have it reviewed for your country/store before publishing.</i></p>
<h2>What we collect</h2><p>Phone number (and email if provided), name, username, profile photo, bio, the posts, comments, stories and messages you send, contacts' phone numbers only when you tap "Find friends" (used to match registered users and not stored), device push token, and technical logs.</p>
<h2>End-to-end encrypted chats</h2><p>Direct text messages are end-to-end encrypted only after both participants have registered encryption keys. If either participant has no key configured, direct text messages are not end-to-end encrypted. Group messages and media files are not end-to-end encrypted.</p>
<h2>How we use it</h2><p>To run the service: deliver messages and calls, show your profile and posts to the audience you choose (private accounts), send notifications, keep the service safe and handle reports.</p>
<h2>Sharing</h2><p>We do not sell your data. Content you post is visible to others according to your privacy settings. Push notifications use Expo's push service. Verification codes may be sent through WhatsApp.</p>
<h2>Your controls</h2><p>You can make your account private, block and report users, download your data and delete your account from Settings. Deleting removes your profile and content.</p>
<h2>Retention</h2><p>Disappearing messages and stories are removed automatically. Deleted accounts are removed from our database.</p>
<h2>Contact</h2><p>${email}</p></body></html>`);
});

app.use('/api', (req, res, next) => (db.isReady() || req.path === '/health' ? next() : res.status(503).json({ message: 'Server is starting, try again shortly' })));

app.use('/api/auth/login', limits.login());
app.use('/api/auth/appeal', limits.otpSend());
app.use('/api/auth/send-otp', limits.otpSend());
app.use('/api/auth/resend-otp', limits.otpSend());
app.use('/api/auth/verify-otp', limits.otpVerify());
app.use('/api/messages/upload', limits.upload());
const uploadLimiter = limits.upload();
app.use('/api/stories', (req, res, next) => (req.method === 'POST' ? uploadLimiter(req, res, next) : next()));
app.use('/api/search', limits.search());
app.use('/api/ai', limits.ai());
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/users', apiLimiter, authMiddleware, require('./routes/users'));
app.use('/api/conversations', apiLimiter, authMiddleware, require('./routes/conversations'));
app.use('/api/messages', apiLimiter, authMiddleware, require('./routes/messages'));
app.use('/api/search', apiLimiter, authMiddleware, require('./routes/search'));
app.use('/api/social', apiLimiter, authMiddleware, require('./routes/social'));
app.use('/api/translate', apiLimiter, authMiddleware, require('./routes/translate'));
app.use('/api/ai', apiLimiter, authMiddleware, require('./routes/ai'));
app.use('/api/ads', apiLimiter, authMiddleware, require('./routes/ads'));
app.use('/api/safety', apiLimiter, authMiddleware, require('./routes/safety'));
app.use('/api/stories', apiLimiter, authMiddleware, require('./routes/stories'));
app.use('/api/calls', apiLimiter, authMiddleware, require('./routes/calls'));
app.use('/api/groups', apiLimiter, authMiddleware, require('./routes/groups'));
app.use('/api/whatsapp', apiLimiter, require('./routes/whatsapp'));
app.use('/api/telemetry', limits.telemetry(), authMiddleware, require('./routes/telemetry'));
app.use('/api/admin', apiLimiter, authMiddleware, require('./routes/admin'));

// Browser-based administration console. The UI authenticates through the existing
// phone OTP flow and every data request is still protected by /api/admin.
const adminAssets = path.join(__dirname, 'admin');
app.use('/admin', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  next();
}, express.static(adminAssets, { index: 'index.html', fallthrough: true }));
app.get('/admin', (req, res) => res.sendFile(path.join(adminAssets, 'index.html')));


app.get('/api/docs.json', (req, res) => res.json(require('./openapi')));
app.get('/api/health', (req, res) => res.json({ status: 'ok', db: db.isReady(), redis: redis.isReady(), time: new Date().toISOString() }));

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// Error handler (multer errors, bad JSON, ...)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'File is too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON' });
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  if (status >= 500) { errorMonitor.record(err, req.method + ' ' + String(req.originalUrl).split('?')[0]); console.error('Unhandled error:', err); }
  res.status(status).json({ message: status >= 500 ? 'Internal server error' : err.message });
});

// ---------- Socket.io ----------
// The client must pass its JWT: io(API_BASE, { auth: { token } })
io.use(async (socket, next) => {
  try {
    const user = await authenticateToken(socket.handshake.auth && socket.handshake.auth.token);
    if (!user) return next(new Error('unauthorized'));
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('unauthorized'));
  }
});

const setPresence = async (userId, status) => {
  try {
    await db.query('UPDATE users SET status = ?, last_seen = NOW() WHERE id = ?', [status, userId]);
  } catch (err) {
    console.warn('presence:', err.message);
  }
  try {
    const [r] = await db.query('SELECT hide_presence FROM users WHERE id = ?', [userId]);
    if (r[0] && r[0].hide_presence) return; // user hides their online status
  } catch { /* ignore */ }
  io.emit('user_status', { userId, status });
};

io.on('connection', (socket) => {
  const userId = socket.user.id;
  socket.join(`user_${userId}`);
  if (socket.user.sessionId) socket.join(`session_${socket.user.sessionId}`);
  const count = (rt.online.get(userId) || 0) + 1;
  rt.online.set(userId, count);
  if (count === 1) setPresence(userId, 'online');

  socket.on('join_conversation', async (conversationId) => {
    try {
      if (await isParticipant(conversationId, userId)) socket.join(`conv_${conversationId}`);
    } catch { /* ignore */ }
  });
  socket.on('leave_conversation', (conversationId) => socket.leave(`conv_${conversationId}`));

  // The sender identity comes from the authenticated socket, never from the payload
  socket.on('typing', async ({ conversationId, isTyping, kind } = {}) => {
    if (!socket.rooms.has(`conv_${conversationId}`)) return;
    socket.to(`conv_${conversationId}`).emit('typing', {
      conversationId, userId, userName: socket.user.name, isTyping: !!isTyping, kind: kind === 'recording' ? 'recording' : 'typing',
    });
  });

  require('./services/calls').register(socket);

  socket.on('disconnect', () => {
    const left = (rt.online.get(userId) || 1) - 1;
    if (left <= 0) {
      rt.online.delete(userId);
      setPresence(userId, 'offline');
    } else {
      rt.online.set(userId, left);
    }
  });
});

async function start() {
  try {
    await db.initDatabase();
    await require('./utils/username').backfillUsernames();
    // Everyone is offline after a restart
    await db.query("UPDATE users SET status = 'offline' WHERE status <> 'offline'");
  } catch (err) {
    console.error('❌ Could not initialise MySQL:', err.message);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 6).join('\n'));
    console.error('   Check DB_HOST / DB_USER / DB_PASSWORD in .env and that MySQL is running.');
    process.exit(1);
  }
  require('./services/verified').start();
  require('./services/alerts').start();
  require('./services/backupJob').start();
  require('./services/cleanup').start();
  require('./services/digest').start();
  if (config.WHATSAPP_ENABLED) require('./services/whatsapp').start();
  server.listen(config.PORT, '0.0.0.0', () => {
    console.log(`🚀 E-Chat server running on port ${config.PORT}`);
    if (config.OTP_DEV_MODE) console.log('🔓 OTP_DEV_MODE is on: codes are returned in the API response when WhatsApp is not linked');
  });
}

async function shutdown() {
  console.log('Shutting down...');
  try { if (redis.client) await redis.client.quit(); } catch { /* ignore */ }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
