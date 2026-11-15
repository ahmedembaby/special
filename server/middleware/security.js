'use strict';
// Zero-dependency security headers (helmet-equivalent subset) and shared rate limiters.

function securityHeaders({ isProd = false } = {}) {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    if (isProd) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
  };
}

const limiter = (windowMs, max, extra = {}) => require('express-rate-limit')({
  windowMs, max, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' }, ...extra,
});

// Per-route budgets. Credential and OTP endpoints are deliberately tight.
const limits = {
  api: () => limiter(60 * 1000, 600),
  auth: () => limiter(15 * 60 * 1000, 60),
  login: () => limiter(15 * 60 * 1000, 10, { skipSuccessfulRequests: true }),
  otpSend: () => limiter(15 * 60 * 1000, 8),
  otpVerify: () => limiter(15 * 60 * 1000, 15, { skipSuccessfulRequests: true }),
  upload: () => limiter(10 * 60 * 1000, 60),
  search: () => limiter(60 * 1000, 60),
  telemetry: () => limiter(60 * 1000, 30),
  ai: () => limiter(60 * 1000, 20),
};

module.exports = { securityHeaders, limits, limiter };
