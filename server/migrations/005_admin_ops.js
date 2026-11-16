'use strict';
exports.up = async (pool) => {
  await pool.query(`CREATE TABLE IF NOT EXISTS report_decisions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    report_id INT NOT NULL,
    admin_id INT NOT NULL,
    decision ENUM('resolved','dismissed') NOT NULL,
    action VARCHAR(30) NOT NULL DEFAULT 'none',
    note VARCHAR(300) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_report_decisions_report (report_id),
    INDEX idx_report_decisions_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS appeals (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    decision_id INT DEFAULT NULL,
    kind ENUM('account','content') NOT NULL DEFAULT 'account',
    message VARCHAR(1000) NOT NULL,
    status ENUM('pending','accepted','denied') NOT NULL DEFAULT 'pending',
    reviewed_by INT DEFAULT NULL,
    review_note VARCHAR(300) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_appeals_status (status, created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS backup_runs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    kind ENUM('create','upload','verify') NOT NULL,
    file VARCHAR(120) DEFAULT NULL,
    ok TINYINT(1) NOT NULL,
    detail VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_backup_runs_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_alerts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    kind VARCHAR(40) NOT NULL,
    message VARCHAR(300) NOT NULL,
    value DOUBLE DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin_alerts_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
};
