const PREFIX = 'e2ee:v1:';

// The mobile client encodes nonce + authenticated ciphertext as base64 after this prefix.
const isEncrypted = (content) => typeof content === 'string'
  && content.startsWith(PREFIX)
  && /^[A-Za-z0-9+/]+={0,2}$/.test(content.slice(PREFIX.length))
  && content.length - PREFIX.length >= 56;

const requiresEncryption = (conversationType, content) => conversationType === 'direct' && !isEncrypted(content);

module.exports = { PREFIX, isEncrypted, requiresEncryption };
