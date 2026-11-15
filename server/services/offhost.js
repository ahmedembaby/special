'use strict';
// Off-host copy of encrypted backups to any S3-compatible bucket (AWS S3, R2, MinIO, Backblaze).
// Zero dependencies: AWS Signature V4 with UNSIGNED-PAYLOAD over HTTPS.
const crypto = require('crypto');
const fs = require('fs');
const { Readable } = require('stream');

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const sha256hex = (data) => crypto.createHash('sha256').update(data).digest('hex');

function signingKey(secret, date, region, service) {
  return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), service), 'aws4_request');
}

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function sign({ method, host, path, region, accessKey, secretKey, now = new Date(), payloadHash = 'UNSIGNED-PAYLOAD', service = 's3' }) {
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const date = amzDate.slice(0, 8);
  const headers = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
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

async function request(method, key, { body, size } = {}) {
  const c = config();
  if (!c) throw new Error('Off-host storage is not configured (BACKUP_S3_*)');
  const url = new URL(`${c.endpoint}/${c.bucket}/${c.prefix}${key}`);
  const path = url.pathname.split('/').map((seg) => enc(decodeURIComponent(seg))).join('/');
  const headers = sign({ method, host: url.host, path, region: c.region, accessKey: c.accessKey, secretKey: c.secretKey });
  const init = { method, headers: { ...headers }, signal: AbortSignal.timeout(10 * 60 * 1000) };
  if (body) { init.body = body; init.duplex = 'half'; init.headers['content-length'] = String(size); }
  return fetch(url.origin + path, init);
}

async function upload(file, name) {
  const { size } = await fs.promises.stat(file);
  const res = await request('PUT', name, { body: Readable.toWeb(fs.createReadStream(file)), size });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return { size };
}
// Confirms the object exists and has the expected size
async function check(name, expectedSize) {
  const res = await request('HEAD', name);
  if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
  const size = Number(res.headers.get('content-length'));
  return size === expectedSize ? { ok: true, detail: 'size matches' } : { ok: false, detail: `size ${size} != ${expectedSize}` };
}

module.exports = { isConfigured, upload, check, sign, signingKey };
