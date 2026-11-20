const PREFIX = 'e2ee:v1:';

// The mobile client encodes nonce + authenticated ciphertext as base64 after this prefix.
const isEncrypted = (content) => typeof content === 'string'
  && content.startsWith(PREFIX)
  && /^[A-Za-z0-9+/]+={0,2}$/.test(content.slice(PREFIX.length))
  && content.length - PREFIX.length >= 56;

// Require ciphertext for direct messages once both participants have registered keys.
// Chats without two registered keys remain explicitly unencrypted for compatibility.
const requiresEncryption = (type, content, keysReady = false) =>
  type === 'direct' && keysReady && !isEncrypted(content);

module.exports = { PREFIX, isEncrypted, requiresEncryption };
