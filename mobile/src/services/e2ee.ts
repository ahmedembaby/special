/**
 * End-to-end encryption for direct chats (text messages only).
 *  - every device creates a curve25519 key pair; the SECRET key never leaves the device (SecureStore)
 *  - the public key is uploaded to the server so the other person can encrypt for us
 *  - messages are sealed with nacl.box (X25519 + XSalsa20-Poly1305) using the shared key of both parties,
 *    so the sender can read their own messages too
 * Limits: one device per account. An optional passphrase-protected key backup is stored on the server (see backupKey/restoreKey);
 * without it a reinstall means old encrypted messages are unreadable.
 */
import nacl from 'tweetnacl';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as api from './api';
import { scryptAsync } from '../vendor/scrypt';

nacl.setPRNG((x: Uint8Array, n: number) => {
  const bytes = Crypto.getRandomBytes(n);
  for (let i = 0; i < n; i++) x[i] = bytes[i];
});

export const PREFIX = 'e2ee:v1:';
export const isEncrypted = (content?: string | null) => !!content && content.startsWith(PREFIX);

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const toB64 = (b: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
  }
  return out;
};
const fromB64 = (s: string): Uint8Array => {
  const clean = s.replace(/=+$/, '');
  const out: number[] = [];
  let bits = 0; let acc = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('bad base64');
    acc = (acc << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); }
  }
  return Uint8Array.from(out);
};
const utf8 = (s: string): Uint8Array => {
  const bin = unescape(encodeURIComponent(s));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const fromUtf8 = (b: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return decodeURIComponent(escape(bin));
};

const secretName = (userId: string | number) => `echat_e2ee_secret_${userId}`;
let cache: { userId: string; secret: Uint8Array; publicKey: string } | null = null;
const shared = new Map<string, Uint8Array>();

/** Loads (or creates) this device's key pair and makes sure the server has the public key. */
export const ensureKeys = async (userId: string | number, serverPublicKey?: string | null): Promise<string> => {
  if (cache && cache.userId === String(userId)) {
    if (serverPublicKey !== cache.publicKey) await api.users.setPublicKey(cache.publicKey);
    return cache.publicKey;
  }
  let secret: Uint8Array;
  let stored: string | null = null;
  try { stored = await SecureStore.getItemAsync(secretName(userId)); } catch { /* unavailable */ }
  if (stored) {
    secret = fromB64(stored);
  } else {
    secret = nacl.box.keyPair().secretKey;
    await SecureStore.setItemAsync(secretName(userId), toB64(secret));
  }
  const publicKey = toB64(nacl.box.keyPair.fromSecretKey(secret).publicKey);
  cache = { userId: String(userId), secret, publicKey };
  shared.clear();
  if (serverPublicKey !== publicKey) await api.users.setPublicKey(publicKey);
  return publicKey;
};

export const forgetKeys = () => { cache = null; shared.clear(); };

const sharedKey = (peerPublic: string): Uint8Array => {
  if (!cache) throw new Error('keys not ready');
  const existing = shared.get(peerPublic);
  if (existing) return existing;
  const k: Uint8Array = nacl.box.before(fromB64(peerPublic), cache.secret);
  shared.set(peerPublic, k);
  return k;
};

export const encrypt = (peerPublic: string, text: string): string => {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const box = nacl.box.after(utf8(text), nonce, sharedKey(peerPublic));
  const all = new Uint8Array(nonce.length + box.length);
  all.set(nonce); all.set(box, nonce.length);
  return PREFIX + toB64(all);
};

/** Returns the plain text, or null if it cannot be decrypted (other key, tampered, no keys yet). */
export const decrypt = (peerPublic: string | null | undefined, content: string): string | null => {
  if (!peerPublic || !isEncrypted(content)) return null;
  try {
    const all = fromB64(content.slice(PREFIX.length));
    const nonce = all.slice(0, nacl.box.nonceLength);
    const opened = nacl.box.open.after(all.slice(nacl.box.nonceLength), nonce, sharedKey(peerPublic));
    return opened ? fromUtf8(opened) : null;
  } catch {
    return null;
  }
};

/** 60 digits both people can compare out loud / in person to confirm nobody is in the middle. */
export const safetyNumber = (myPublic: string, peerPublic: string): string => {
  const [a, b] = [myPublic, peerPublic].sort();
  const h = nacl.hash(utf8(a + b));
  let digits = '';
  for (let i = 0; i < 30; i++) digits += String(((h[i * 2] << 8) | h[i * 2 + 1]) % 100).padStart(2, '0');
  return digits.match(/.{1,5}/g)!.join(' ');
};

// ---------- key backup (also lets a second device read the same chats) ----------
// The secret key is encrypted with a passphrase on the device; the server stores only the unreadable blob.
// Blob versions (the version and cost parameters travel inside the blob, so old backups keep restoring):
//   v1:salt:nonce:box              20,000 rounds of SHA-512 (legacy, still readable, never written any more)
//   v2:N:r:p:salt:nonce:box        scrypt (memory-hard), parameters stored in the blob so the cost can be raised later
const KDF_ROUNDS = 20000;
const SCRYPT_PARAMS = { N: 2 ** 14, r: 8, p: 1 };
const deriveKeyV1 = (passphrase: string, salt: Uint8Array): Uint8Array => {
  let h = nacl.hash(new Uint8Array([...utf8(passphrase), ...salt]));
  for (let i = 0; i < KDF_ROUNDS; i++) h = nacl.hash(h);
  return h.slice(0, nacl.secretbox.keyLength);
};
const deriveKeyV2 = (passphrase: string, salt: Uint8Array, N: number, r: number, p: number): Promise<Uint8Array> =>
  scryptAsync(utf8(passphrase), salt, { N, r, p, dkLen: nacl.secretbox.keyLength });
// Refuse absurd parameters from a tampered blob (they would freeze or crash the phone).
const sane = (N: number, r: number, p: number) => Number.isInteger(Math.log2(N)) && N >= 2 ** 12 && N <= 2 ** 18 && r >= 1 && r <= 8 && p >= 1 && p <= 4;

export const backupKey = async (userId: string | number, passphrase: string): Promise<void> => {
  const stored = await SecureStore.getItemAsync(secretName(userId));
  if (!stored) throw new Error('no key');
  const salt = nacl.randomBytes(16);
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const { N, r, p } = SCRYPT_PARAMS;
  const box = nacl.secretbox(fromB64(stored), nonce, await deriveKeyV2(passphrase, salt, N, r, p));
  await api.users.putKeyBackup(`v2:${N}:${r}:${p}:${toB64(salt)}:${toB64(nonce)}:${toB64(box)}`);
};

/** Returns false when the passphrase is wrong. */
export const restoreKey = async (userId: string | number, passphrase: string): Promise<boolean> => {
  const { data } = await api.users.getKeyBackup();
  const parts = String(data.backup).split(':');
  let secret: Uint8Array | null;
  if (parts[0] === 'v1' && parts.length === 4) {
    secret = nacl.secretbox.open(fromB64(parts[3]), fromB64(parts[2]), deriveKeyV1(passphrase, fromB64(parts[1])));
  } else if (parts[0] === 'v2' && parts.length === 7) {
    const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    if (!sane(N, r, p)) throw new Error('unsupported backup');
    secret = nacl.secretbox.open(fromB64(parts[6]), fromB64(parts[5]), await deriveKeyV2(passphrase, fromB64(parts[4]), N, r, p));
  } else {
    throw new Error('unsupported backup');
  }
  if (!secret) return false;
  await SecureStore.setItemAsync(secretName(userId), toB64(secret));
  forgetKeys();
  await ensureKeys(userId, null);
  // An old v1 backup is re-saved with the stronger KDF now that we hold the passphrase (best effort, same passphrase).
  if (parts[0] === 'v1') backupKey(userId, passphrase).catch(() => {});
  return true;
};
