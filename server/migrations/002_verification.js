'use strict';
const { addColumn } = require('../services/migrate');

exports.up = async (pool) => {
  await addColumn(pool, 'users', 'verified', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addColumn(pool, 'users', 'verified_at', 'TIMESTAMP NULL DEFAULT NULL');
  await pool.query(`CREATE TABLE IF NOT EXISTS verification_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'person',
    reason TEXT DEFAULT NULL,
    link VARCHAR(255) DEFAULT NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    reviewed_by INT DEFAULT NULL,
    review_note VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_verification_status (status, created_at),
    INDEX idx_verification_user (user_id, created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
};
