'use strict';
// Encrypted authenticator secrets (enc:v1:...) are about 90 characters, but 003 created totp_secret as VARCHAR(64),
// so enabling or verifying two-step verification failed with "Data too long for column 'totp_secret'".
exports.up = async (pool) => {
  await pool.query('ALTER TABLE `users` MODIFY COLUMN `totp_secret` VARCHAR(512) DEFAULT NULL');
};
