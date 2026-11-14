'use strict';

const express = require('express');
const pool = require('../db');
const router = express.Router();

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.headline, c.body, c.media_url, c.target_url
       FROM ad_campaigns c
       JOIN users u ON u.id = ?
       WHERE c.status = 'active'
         AND (c.starts_at IS NULL OR c.starts_at <= NOW())
         AND (c.ends_at IS NULL OR c.ends_at >= NOW())
         AND (
           c.audience = 'all'
           OR (c.audience = 'new' AND u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))
           OR (c.audience = 'active' AND u.last_seen >= DATE_SUB(NOW(), INTERVAL 7 DAY))
         )
       ORDER BY RAND()
       LIMIT 1`,
      [req.user.id]
    );
    if (!rows.length) return res.json(null);
    const ad = rows[0];
    ad.target_url = safeHttpUrl(ad.target_url);
    ad.media_url = safeHttpUrl(ad.media_url);
    if (!ad.target_url) return res.json(null);

    const [impression] = await pool.query(
      'INSERT IGNORE INTO ad_impressions (campaign_id, user_id, impression_date) VALUES (?, ?, CURDATE())',
      [ad.id, req.user.id]
    );
    if (impression.affectedRows) {
      await pool.query('UPDATE ad_campaigns SET impressions = impressions + 1 WHERE id = ?', [ad.id]);
    }
    res.json(ad);
  } catch (error) {
    console.error('ads feed:', error.message);
    res.status(500).json({ message: 'Could not load sponsored content' });
  }
});

router.post('/:id/click', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid campaign' });
    const [rows] = await pool.query(
      `SELECT target_url FROM ad_campaigns
       WHERE id = ? AND status = 'active'
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at >= NOW())`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Campaign is not available' });
    const targetUrl = safeHttpUrl(rows[0].target_url);
    if (!targetUrl) return res.status(400).json({ message: 'Campaign destination is invalid' });
    await pool.query('UPDATE ad_campaigns SET clicks = clicks + 1 WHERE id = ?', [id]);
    res.json({ success: true, target_url: targetUrl });
  } catch (error) {
    console.error('ads click:', error.message);
    res.status(500).json({ message: 'Could not record campaign click' });
  }
});

module.exports = router;
