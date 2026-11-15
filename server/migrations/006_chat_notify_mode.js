'use strict';
const { addColumn } = require('../services/migrate');
exports.up = async (pool) => {
  await addColumn(pool, 'conversation_participants', 'mentions_only', 'TINYINT(1) NOT NULL DEFAULT 0');
};
