'use strict';
// OTP delivery audit: events only (phone, outcome, time). Codes are NEVER stored here.
exports.up = async (pool) => {
  await pool.query(`CREATE TABLE IF NOT EXISTS otp_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone VARCHAR(32) NOT NULL,
    event ENUM('sent','send_failed','verified','rejected','blocked') NOT NULL,
    detail VARCHAR(200) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_otp_events_created (created_at),
    INDEX idx_otp_events_phone (phone, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
};
