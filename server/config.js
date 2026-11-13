require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  if (isProd) throw new Error('JWT_SECRET must be set to a random value of at least 32 characters in production');
  console.warn('JWT_SECRET is missing or too short; use a random secret outside development');
}
if (isProd && !process.env.DB_PASSWORD) {
  console.warn('DB_PASSWORD is empty in production');
}

const clientOrigins = (process.env.CLIENT_URL || (isProd ? '' : 'http://localhost:8081'))
  .split(',').map((value) => value.trim()).filter(Boolean);
if (isProd && (!clientOrigins.length || clientOrigins.includes('*'))) {
  throw new Error('CLIENT_URL must contain explicit trusted origins in production; wildcard CORS is not allowed');
}

module.exports = {
  isProd,
  PORT: Number(process.env.PORT) || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-insecure-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  CLIENT_URL: clientOrigins,
  REDIS_URL: process.env.REDIS_URL || '',
  ADMIN_PHONES: (process.env.ADMIN_PHONES || '').split(',').map((s) => s.trim()).filter(Boolean),
  ADMIN_IDS: (process.env.ADMIN_IDS || '').split(',').map((s) => Number(s.trim())).filter((n) => Number.isSafeInteger(n) && n > 0),
  OTP_DEV_MODE: process.env.OTP_DEV_MODE === 'true' && !isProd,
  WHATSAPP_ENABLED: process.env.WHATSAPP_ENABLED !== 'false',
  CHROME_PATH: process.env.CHROME_PATH || undefined,
  WHATSAPP_SETUP_KEY: process.env.WHATSAPP_SETUP_KEY || '',
};
