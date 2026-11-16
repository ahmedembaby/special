'use strict';
// Scheduled backup: create -> copy off-host -> verify integrity, with an audit trail and failure alerts.
const path = require('path');
const pool = require('../db');
const backups = require('./adminBackups');
const offhost = require('./offhost');

async function log(kind, file, ok, detail) {
  try { await pool.query('INSERT INTO backup_runs (kind, file, ok, detail) VALUES (?, ?, ?, ?)', [kind, file, ok ? 1 : 0, String(detail || '').slice(0, 500)]); } catch { /* table missing */ }
}
const fail = (message) => require('./alerts').fire({ kind: 'backup', value: null, message: `⚠️ ${message}` }).catch(() => {});

async function uploadAndCheck(name) {
  const cfg = backups.config();
  const full = path.join(cfg.dir, name);
  const { size } = await offhost.upload(full, name);
  await log('upload', name, true, `${size} bytes`);
  const c = await offhost.check(name, size);
  await log('verify', name, c.ok, 'off-host: ' + c.detail);
  if (!c.ok) throw new Error('off-host check failed: ' + c.detail);
}

async function verifyLocal(name) {
  const v = await backups.verify(name);
  await log('verify', name, v.ok, v.detail);
  if (!v.ok) await fail(`فشل فحص سلامة النسخة ${name}: ${v.detail}`);
  return v;
}

async function runOnce() {
  let name = null;
  try {
    const made = await backups.create();
    name = made.name;
    await log('create', name, true, `${made.size} bytes`);
  } catch (e) { await log('create', null, false, e.message); await fail('فشل إنشاء النسخة الاحتياطية: ' + e.message); return { ok: false, step: 'create', detail: e.message }; }
  const v = await verifyLocal(name);
  if (offhost.isConfigured()) {
    try { await uploadAndCheck(name); } catch (e) { await log('upload', name, false, e.message); await fail('فشل رفع النسخة خارج الخادم: ' + e.message); return { ok: false, step: 'upload', detail: e.message, name }; }
  }
  await prune().catch(() => {});
  return { ok: v.ok, name, detail: v.detail, offhost: offhost.isConfigured() };
}

async function prune() {
  const keep = Number(process.env.BACKUP_KEEP_LOCAL) || 14;
  const all = await backups.list();
  for (const old of all.slice(keep)) await backups.remove(old.name);
}

let timer = null;
function start() {
  const hours = Number(process.env.BACKUP_AUTO_HOURS);
  if (!hours || hours <= 0 || timer) return;
  try { backups.config(); } catch (e) { console.warn('Automatic backups disabled:', e.message); return; }
  timer = setInterval(() => runOnce().catch(() => {}), hours * 3600 * 1000);
  timer.unref();
  console.log(`Automatic backups every ${hours}h${offhost.isConfigured() ? ' (off-host enabled)' : ' (local only)'}`);
}

module.exports = { runOnce, verifyLocal, uploadAndCheck, start };
