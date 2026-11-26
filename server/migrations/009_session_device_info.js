'use strict';
const { addColumn } = require('../services/migrate');
// Where each session signed in from: network address and client user-agent.
exports.up = async (pool) => {
  await addColumn(pool, 'device_sessions', 'ip', 'VARCHAR(45) DEFAULT NULL');
  await addColumn(pool, 'device_sessions', 'user_agent', 'VARCHAR(255) DEFAULT NULL');
};
