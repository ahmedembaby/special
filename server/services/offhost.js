'use strict';
// Off-host copy of encrypted backups to any S3-compatible bucket (AWS S3, R2, MinIO, Backblaze).
// Every uploaded object carries a signed SHA-256 metadata digest, checked again with HEAD.
const crypto = require('crypto');
const fs = require('fs');
const { Readable } = require('stream');

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const sha256hex = (data) => crypto.createHash('sha256').update(data).digest('hex');

function signingKey(secret, date, region, service) {
  return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), service), 'aws4_request');
}

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function sign({ method, host, path, region, accessKey, secretKey, now = new Date(), payloadHash = 'UNSIGNED-PAYLOAD', service = 's3', extraHeaders = {} }) {
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const date = amzDate.slice(0, 8);
  const headers = {
    host: String(host).toLowerCase(),
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  for (const [name, value] of Object.entries(extraHeaders)) {
    const key = name.toLowerCase().trim();
    if (!/^[a-z0-9-]+$/.test(key) || key === 'authorization' || key === 'host') throw new Error('Invalid signed header');
    headers[key] = String(value).trim().replace(/\s+/g, ' ');
  }
  const names = Object.keys(headers).sort();
  const canonical = [method, path, '', names.map((n) => `${n}:${headers[n]}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${date}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonical)].join('\n');
  const signature = crypto.createHmac('sha256', signingKey(secretKey, date, region, service)).update(toSign).digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  return headers;
}

function config() {
  const endpoint = (process.env.BACKUP_S3_ENDPOINT || '').replace(/\/+$/, '');
  const bucket = process.env.BACKUP_S3_BUCKET;
  const accessKey = process.env.BACKUP_S3_ACCESS_KEY;
  const secretKey = process.env.BACKUP_S3_SECRET_KEY;
  if (!endpoint || !bucket || !accessKey || !secretKey) return null;
  return { endpoint, bucket, accessKey, secretKey, region: process.env.BACKUP_S3_REGION || 'auto', prefix: (process.env.BACKUP_S3_PREFIX || 'special-backups/').replace(/^\/+/, '') };
}
const isConfigured = () => !!config();

async function request(method, key, { body, size, sha256 } = {}) {
  const c = config();
  if (!c) throw new Error('Off-host storage is not configured (BACKUP_S3_*)');
  const url = new URL(`${c.endpoint}/${c.bucket}/${c.prefix}${key}`);
  const path = url.pathname.split('/').map((seg) => enc(decodeURIComponent(seg))).join('/');
  const extraHeaders = sha256 ? { 'x-amz-meta-sha256': sha256 } : {};
  const headers = sign({ method, host: url.host, path, region: c.region, accessKey: c.accessKey, secretKey: c.secretKey, extraHeaders });
  const init = { method, headers: { ...headers }, signal: AbortSignal.timeout(10 * 60 * 1000) };
  if (body) { init.body = body; init.duplex = 'half'; init.headers['content-length'] = String(size); }
  return fetch(url.origin + path, init);
}

async function fileDigest(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function upload(file, name) {
  const { size } = await fs.promises.stat(file);
  const sha256 = await fileDigest(file);
  const res = await request('PUT', name, { body: Readable.toWeb(fs.createReadStream(file)), size, sha256 });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return { size, sha256 };
}

// Requires both size and SHA-256 metadata to match; size-only checks cannot detect same-size corruption.
async function check(name, expectedSize, expectedSha256) {
  if (!/^[a-f0-9]{64}$/i.test(String(expectedSha256 || ''))) {
    return { ok: false, detail: 'expected SHA-256 digest is required' };
  }
  const res = await request('HEAD', name);
  if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
  const size = Number(res.headers.get('content-length'));
  const digest = String(res.headers.get('x-amz-meta-sha256') || '').toLowerCase();
  if (size !== expectedSize) return { ok: false, detail: `size ${size} != ${expectedSize}` };
  if (digest !== expectedSha256.toLowerCase()) return { ok: false, detail: 'SHA-256 metadata mismatch' };
  return { ok: true, detail: 'size and SHA-256 match' };
}

module.exports = { isConfigured, upload, check, sign, signingKey, fileDigest };
