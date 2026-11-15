'use strict';
// In-memory set of verified user ids so any serializer can attach the badge
// synchronously (no SQL change in every query). Refreshed on change and every minute.
const pool = require('../db');

let ids = new Set();
let timer = null;

async function refresh() {
  try {
    const [rows] = await pool.query('SELECT id FROM users WHERE verified = 1');
    ids = new Set(rows.map((r) => Number(r.id)));
  } catch (err) {
    console.warn('verified refresh:', err.message);
  }
}
function start() {
  refresh();
  if (!timer) { timer = setInterval(refresh, 60 * 1000); timer.unref(); }
}
const isVerified = (id) => ids.has(Number(id));
const set = (id, value) => { if (value) ids.add(Number(id)); else ids.delete(Number(id)); };

module.exports = { start, refresh, isVerified, set };
