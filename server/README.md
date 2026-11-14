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


## Encrypted database backups

Configure a persistent writable directory and a 32-byte encryption key (64 hexadecimal characters):

```env
BACKUP_DIR=/var/lib/special/backups
BACKUP_ENCRYPTION_KEY=replace-with-64-hex-characters
```

The host must provide `mysqldump` and `mysql` client binaries. Backups use AES-256-GCM encryption. Keep the key outside the backup directory and store a secure copy separately; losing it makes backups unrecoverable. The backup directory must be on persistent storage, not an ephemeral deployment filesystem. Restore is owner-only and requires typing the exact database name; it replaces current database contents. Test restores on staging before relying on production backups.

## Advertising campaigns

The admin dashboard manages campaign settings and statuses. This does not yet render ads in mobile feeds or record real impressions/clicks; mobile ad placements and event tracking are a separate rollout before activating campaigns for users.


## Calls and encrypted backups

For reliable WebRTC calls across mobile networks, configure `TURN_URL`, `TURN_USERNAME`, and `TURN_PASSWORD` with a TURN service. STUN alone is not sufficient for every carrier or restrictive NAT. Group calls currently use a peer-to-peer mesh capped at five participants; production rooms with more participants should use an SFU.

The admin backup screen requires `BACKUP_DIR` on a persistent mounted volume, `BACKUP_ENCRYPTION_KEY` containing 64 hexadecimal characters (32 random bytes), and the MySQL client utilities (`mysqldump` and `mysql`) installed in the server image. Generate the key with `openssl rand -hex 32`, store it in the hosting provider's secret manager, and keep a secure copy separately. Restoring a backup replaces the active database; test restore procedures against a staging database before production use. Do not commit the key or backup files to Git.
