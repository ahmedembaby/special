'use strict';
// Daily AI quotas (requests + tokens) persisted in ai_usage, plus cost estimation.
const pool = require('../db');

const limits = () => ({
  requests: Number(process.env.AI_DAILY_REQUESTS) || 50,
  tokens: Number(process.env.AI_DAILY_TOKENS) || 60000,
});
const costPer1k = () => Number(process.env.AI_COST_PER_1K_TOKENS) || 0;
const estimateCost = (tokens) => Math.round((tokens / 1000) * costPer1k() * 10000) / 10000;

async function usageToday(userId) {
  const [r] = await pool.query('SELECT requests, tokens FROM ai_usage WHERE user_id = ? AND day = CURDATE()', [userId]);
  return r[0] ? { requests: Number(r[0].requests), tokens: Number(r[0].tokens) } : { requests: 0, tokens: 0 };
}
function exceeded(used, lim = limits()) {
  return used.requests >= lim.requests || used.tokens >= lim.tokens;
}
async function record(userId, tokens = 0) {
  await pool.query(
    'INSERT INTO ai_usage (user_id, day, requests, tokens) VALUES (?, CURDATE(), 1, ?) ON DUPLICATE KEY UPDATE requests = requests + 1, tokens = tokens + VALUES(tokens)',
    [userId, Math.max(0, Math.round(tokens) || 0)]);
}

module.exports = { limits, usageToday, exceeded, record, estimateCost, costPer1k };
