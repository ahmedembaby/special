# Special server

## Run

1. Copy `.env.example` to `.env` and configure `DB_*`, a long random `JWT_SECRET`, and explicit `CLIENT_URLS`.
2. Install and start: `npm install && npm start`. Database tables and additive migrations are initialized at startup.
3. Set `ADMIN_PHONES` to trusted admin phone numbers in international format (comma-separated), or set `ADMIN_IDS` to trusted account IDs. Do not leave these empty in production if you need dashboard access.
4. Configure WhatsApp OTP delivery for the admin phone. The development OTP mode is disabled in production.

## Admin dashboard

Open `https://your-server-host/admin` after deployment. Sign in with the phone number of an account included in `ADMIN_PHONES` or `ADMIN_IDS`, then enter the OTP sent by the existing authentication flow.

The dashboard includes:
- Live service overview and runtime health (database, Redis state, uptime, Node.js and memory).
- User search, profile details, bans and account deletion.
- Post moderation, reports, group and conversation management.
- Active device sessions with remote revocation.
- Broadcast notifications, banned-word management and the admin audit log.

All privileged data/actions are served by `/api/admin` behind the existing JWT session authentication and admin allowlist. The browser UI stores its session token in tab-scoped `sessionStorage`; signing out clears it. The dashboard does not expose session tokens or token hashes.

## Other endpoints

- Health check: `GET /api/health`
- Privacy policy: `GET /privacy`
- Optional Redis: `REDIS_URL` for multi-instance sockets, OTP storage and token blacklist.
- WhatsApp OTP: `WHATSAPP_ENABLED=true` and a working WhatsApp setup; `CHROME_PATH` may be needed on some hosts.
