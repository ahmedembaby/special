'use strict';
// Minimal versioned migration runner. Files in server/migrations are named
// NNN_description.js and export `up(pool)`; each runs once and is recorded in
// schema_migrations. The legacy inline schema in db.js stays as the baseline.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'migrations');
const NAME_RE = /^\d{3,}_[a-z0-9_]+\.js$/;

function listMigrations(dir = DIR) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => NAME_RE.test(f)).sort();
}

async function run(pool, { dir = DIR, log = console.log } = {}) {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(190) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [rows] = await pool.query('SELECT name FROM schema_migrations');
  const done = new Set(rows.map((r) => r.name));
  const applied = [];
  for (const file of listMigrations(dir)) {
    if (done.has(file)) continue;
    const mod = require(path.join(dir, file));
    if (typeof mod.up !== 'function') throw new Error(`Migration ${file} has no up()`);
    await mod.up(pool);
    await pool.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    applied.push(file);
    log(`Applied migration: ${file}`);
  }
  return applied;
}

// Helpers so migrations are idempotent and safe to re-run after a partial failure.
async function hasColumn(pool, table, column) {
  const [r] = await pool.query(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1',
    [table, column]);
  return r.length > 0;
}
async function addColumn(pool, table, column, definition) {
  if (!/^[a-z0-9_]+$/i.test(table) || !/^[a-z0-9_]+$/i.test(column)) throw new Error('bad identifier');
  if (!(await hasColumn(pool, table, column))) await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

module.exports = { run, listMigrations, hasColumn, addColumn, NAME_RE };
