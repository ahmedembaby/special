'use strict';
const { addColumn } = require('../services/migrate');

exports.up = async (pool) => {
  await addColumn(pool, 'users', 'totp_secret', 'VARCHAR(64) DEFAULT NULL');
  await addColumn(pool, 'users', 'totp_enabled', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumn(pool, 'users', 'totp_last_step', 'BIGINT DEFAULT NULL');
  await pool.query(`CREATE TABLE IF NOT EXISTS known_devices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    device_key VARCHAR(100) NOT NULL,
    device_name VARCHAR(120) NOT NULL DEFAULT 'Unknown device',
    platform VARCHAR(20) NOT NULL DEFAULT 'unknown',
    first_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_known_device (user_id, device_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
};
