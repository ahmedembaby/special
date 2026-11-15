'use strict';
// Client crash/error reports (Sentry-style, without the SDK). Authenticated, size-capped
// and rate-limited; entries land in the same in-memory monitor the admin console reads.
const express = require('express');
const errorMonitor = require('../services/errorMonitor');
const router = express.Router();

const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

router.post('/error', (req, res) => {
  const b = req.body || {};
  const message = clip(b.message, 500);
  if (!message) return res.status(400).json({ message: 'message is required' });
  const err = new Error(message);
  err.stack = clip(b.stack, 2000);
  errorMonitor.record(err, `client:${clip(b.platform || 'app', 12)}:${clip(b.version || '?', 20)}${b.fatal ? ':fatal' : ''}`);
  res.status(202).json({ ok: true });
});

module.exports = router;
