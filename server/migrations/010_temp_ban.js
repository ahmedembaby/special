'use strict';
const { addColumn } = require('../services/migrate');
// Temporary bans: banned_until set means the ban lifts itself once the time passes.
exports.up = async (pool) => {
  await addColumn(pool, 'users', 'banned_until', 'DATETIME DEFAULT NULL');
};
