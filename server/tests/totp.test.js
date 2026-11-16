const test = require('node:test');
const assert = require('node:assert');
const t = require('../utils/totp');

// RFC 6238 Appendix B vector: secret "12345678901234567890", T=59s -> 94287082 (last 6: 287082)
const RFC_SECRET = t.base32Encode(Buffer.from('12345678901234567890'));
test('totp: matches RFC 6238 vectors', () => {
  assert.strictEqual(t.totp(RFC_SECRET, 59000), '287082');
  assert.strictEqual(t.totp(RFC_SECRET, 1111111109000), '081804');
  assert.strictEqual(t.totp(RFC_SECRET, 1234567890000), '005924');
});
test('totp: verify tolerates one step of drift, rejects others', () => {
  const now = 1234567890000;
  assert.ok(t.verify(RFC_SECRET, '005924', now) !== null);
  assert.ok(t.verify(RFC_SECRET, '005924', now + 30000) !== null);
  assert.strictEqual(t.verify(RFC_SECRET, '005924', now + 120000), null);
  assert.strictEqual(t.verify(RFC_SECRET, 'abcdef', now), null);
});
test('totp: base32 roundtrip and secret shape', () => {
  const s = t.generateSecret();
  assert.match(s, /^[A-Z2-7]{32}$/);
  assert.strictEqual(t.base32Encode(t.base32Decode(s)), s);
  assert.match(t.otpauthUrl(s, 'a@b.c'), /^otpauth:\/\/totp\/Special:/);
});
