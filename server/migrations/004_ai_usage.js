'use strict';
exports.up = async (pool) => {
  await pool.query(`CREATE TABLE IF NOT EXISTS ai_usage (
    user_id INT NOT NULL,
    day DATE NOT NULL,
    requests INT NOT NULL DEFAULT 0,
    tokens INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day),
    INDEX idx_ai_usage_day (day),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
};
