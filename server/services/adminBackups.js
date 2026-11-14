'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const { pipeline, finished } = require('stream/promises');

const MAGIC = Buffer.from('SPBACK01');
const HEADER_SIZE = MAGIC.length + 12;
const TAG_SIZE = 16;
const FILE_RE = /^special-\\d{8}T\\d{6}Z-[a-f0-9]{8}\\.sdbak$/;

function config() {
  const dir = process.env.BACKUP_DIR;
  const rawKey = process.env.BACKUP_ENCRYPTION_KEY || '';
  if (!dir) throw new Error('BACKUP_DIR is not configured');
  if (!/^[a-f0-9]{64}$/i.test(rawKey)) throw new Error('BACKUP_ENCRYPTION_KEY must be 64 hexadecimal characters');
  return {
    dir: path.resolve(dir),
    key: Buffer.from(rawKey, 'hex'),
    db: process.env.DB_NAME || 'echat',
    host: process.env.DB_HOST || 'localhost',
    port: String(Number(process.env.DB_PORT) || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  };
}
function mysqlArgs(c, includeDatabase) {
  return ['--host', c.host, '--port', c.port, '--user', c.user, '--default-character-set=utf8mb4', ...(includeDatabase ? [c.db] : [])];
}
function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error('MySQL utility exited with code ' + code)));
  });
}
async function list() {
  const c = config();
  await fsp.mkdir(c.dir, { recursive: true, mode: 0o700 });
  const entries = await fsp.readdir(c.dir, { withFileTypes: true });
  const rows = [];
  for (const entry of entries) {
    if (!entry.isFile() || !FILE_RE.test(entry.name)) continue;
    const stat = await fsp.stat(path.join(c.dir, entry.name));
    rows.push({ name: entry.name, size: stat.size, created_at: stat.mtime.toISOString() });
  }
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
async function create() {
  const c = config();
  await fsp.mkdir(c.dir, { recursive: true, mode: 0o700 });
  const name = 'special-' + new Date().toISOString().replace(/[-:]/g, '').replace(/\\.\\d{3}Z$/, 'Z') + '-' + crypto.randomBytes(4).toString('hex') + '.sdbak';
  const target = path.join(c.dir, name);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', c.key, iv);
  const output = fs.createWriteStream(target, { flags: 'wx', mode: 0o600 });
  output.write(Buffer.concat([MAGIC, iv]));
  const child = spawn('mysqldump', ['--single-transaction', '--routines', '--triggers', '--databases', c.db, '--host', c.host, '--port', c.port, '--user', c.user, '--default-character-set=utf8mb4'], {
    env: { ...process.env, MYSQL_PWD: c.password }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-3000); });
  const exited = waitForExit(child);
  try {
    await pipeline(child.stdout, cipher, output, { end: false });
    await exited;
    await new Promise((resolve, reject) => { output.once('error', reject); output.end(cipher.getAuthTag(), resolve); });
    return { name, size: (await fsp.stat(target)).size, created_at: new Date().toISOString() };
  } catch (error) {
    child.kill();
    output.destroy();
    await fsp.unlink(target).catch(() => {});
    if (error.code === 'ENOENT') throw new Error('mysqldump is not installed on this host');
    if (stderr) throw new Error('Backup failed: ' + stderr.slice(-700));
    throw error;
  }
}
async function safeFile(name) {
  if (typeof name !== 'string' || !FILE_RE.test(name)) throw new Error('Invalid backup file name');
  const c = config();
  const file = path.join(c.dir, name);
  const stat = await fsp.stat(file);
  if (!stat.isFile() || stat.size < HEADER_SIZE + TAG_SIZE) throw new Error('Backup file is invalid');
  return { c, file, stat };
}
async function restore(name) {
  const { c, file, stat } = await safeFile(name);
  const handle = await fsp.open(file, 'r');
  const header = Buffer.alloc(HEADER_SIZE);
  const tag = Buffer.alloc(TAG_SIZE);
  try {
    await handle.read(header, 0, HEADER_SIZE, 0);
    await handle.read(tag, 0, TAG_SIZE, stat.size - TAG_SIZE);
  } finally { await handle.close(); }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Backup format is not recognized');
  const decipher = crypto.createDecipheriv('aes-256-gcm', c.key, header.subarray(MAGIC.length));
  decipher.setAuthTag(tag);
  const child = spawn('mysql', mysqlArgs(c, false), {
    env: { ...process.env, MYSQL_PWD: c.password }, stdio: ['pipe', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-3000); });
  try {
    await Promise.all([
      pipeline(fs.createReadStream(file, { start: HEADER_SIZE, end: stat.size - TAG_SIZE - 1 }), decipher, child.stdin),
      waitForExit(child),
    ]);
  } catch (error) {
    child.kill();
    if (error.code === 'ENOENT') throw new Error('mysql client is not installed on this host');
    if (stderr) throw new Error('Restore failed: ' + stderr.slice(-700));
    throw error;
  }
}
async function remove(name) {
  const { file } = await safeFile(name);
  await fsp.unlink(file);
}
module.exports = { list, create, restore, remove };
