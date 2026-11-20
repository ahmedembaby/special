'use strict';
const crypto = require('crypto');

const PREFIX = 'enc:v1:';
function keyFromEnv(value = process.env.TOTP_ENCRYPTION_KEY) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  let key;
  if (/^[a-f0-9]{64}$/i.test(raw)) key = Buffer.from(raw, 'hex');
  else {
    try { key = Buffer.from(raw, 'base64'); } catch { key = null; }
    const normalized = raw.replace(/=+$/, '');
    if (!key || key.toString('base64').replace(/=+$/, '') !== normalized) key = null;
  }
  if (!key || key.length !== 32) throw new Error('TOTP_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters or base64)');
  return key;
}
function encrypt(secret, key = keyFromEnv()) {
  if (!key) throw new Error('TOTP_ENCRYPTION_KEY is required to store authenticator secrets');
  if (typeof secret !== 'string' || !secret) throw new Error('TOTP secret is required');
  if (secret.startsWith(PREFIX)) {
    decrypt(secret, key);
    return secret;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64');
}
function decrypt(value, key = keyFromEnv()) {
  if (typeof value !== 'string' || !value) throw new Error('TOTP secret is missing');
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext; migrate on successful verification
  if (!key) throw new Error('TOTP_ENCRYPTION_KEY is required to read encrypted authenticator secrets');
  const payload = Buffer.from(value.slice(PREFIX.length), 'base64');
  if (payload.length < 29) throw new Error('Encrypted TOTP secret is malformed');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
const isEncrypted = (value) => typeof value === 'string' && value.startsWith(PREFIX);
module.exports = { PREFIX, keyFromEnv, encrypt, decrypt, isEncrypted };
