'use strict';
// OpenAPI 3.0 description of the public API surface. Served at /api/docs.json.
// Keep in sync when adding routes (tests/openapi.test.js checks basic consistency).
const ok = { description: 'OK' };
const secured = [{ bearerAuth: [] }];
const op = (summary, tag, extra = {}) => ({ summary, tags: [tag], responses: { 200: ok, 401: { description: 'Unauthorized' } }, ...extra });
const pub = (summary, tag, extra = {}) => ({ summary, tags: [tag], responses: { 200: ok, 429: { description: 'Too many requests' } }, ...extra });
const auth = (summary, tag, extra = {}) => op(summary, tag, { security: secured, ...extra });

module.exports = {
  openapi: '3.0.3',
  info: { title: 'Special API', version: '1.1.0', description: 'REST API of the Special chat server. Realtime events use Socket.io with the same JWT.' },
  servers: [{ url: '/' }],
  components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  tags: ['Auth', 'Messages', 'Conversations', 'Search', 'Social', 'Safety', 'AI', 'Telemetry', 'Admin', 'System'].map((name) => ({ name })),
  paths: {
    '/api/health': { get: pub('Liveness and dependency status', 'System') },
    '/api/auth/login': { post: pub('Password login (+ TOTP code when enabled)', 'Auth') },
    '/api/auth/send-otp': { post: pub('Send a WhatsApp OTP', 'Auth') },
    '/api/auth/verify-otp': { post: pub('Verify OTP and open a session', 'Auth') },
    '/api/auth/logout': { post: auth('End the current session', 'Auth') },
    '/api/auth/sessions': { get: auth('List my active sessions', 'Auth') },
    '/api/auth/push/register': { post: auth('Register an Expo push token', 'Auth') },
    '/api/conversations': { get: auth('List my conversations', 'Conversations') },
    '/api/messages/search': { get: auth('Search plain-text messages', 'Search') },
    '/api/messages/upload': { post: auth('Upload chat media', 'Messages') },
    '/api/search/users': { get: auth('Search users', 'Search') },
    '/api/search/posts': { get: auth('Search posts', 'Search') },
    '/api/social/posts': { get: auth('Home feed', 'Social') },
    '/api/safety/report': { post: auth('Report content or a user', 'Safety') },
    '/api/ai/assistant': { post: auth('AI assistant (summary, reply suggestions, ...)', 'AI') },
    '/api/ai/transcribe/{messageId}': { post: auth('Transcribe a voice message', 'AI') },
    '/api/auth/2fa/setup': { post: auth('Start TOTP setup', 'Auth') },
    '/api/auth/2fa/enable': { post: auth('Confirm TOTP with a code', 'Auth') },
    '/api/auth/appeal': { post: pub('Appeal a suspension (public)', 'Safety') },
    '/api/users/me/verification': { get: auth('My verification status', 'Auth'), post: auth('Request verification', 'Auth') },
    '/api/safety/appeals': { post: auth('Appeal a moderation decision', 'Safety') },
    '/api/ai/usage': { get: auth("Today's AI usage and limits", 'AI') },
    '/api/telemetry/error': { post: auth('Report a client error', 'Telemetry') },
    '/api/admin/me': { get: auth('Current admin role and permissions', 'Admin') },
    '/api/admin/stats': { get: auth('Dashboard statistics', 'Admin') },
    '/api/admin/health': { get: auth('Latency and error metrics', 'Admin') },
  },
};
