# Special

Special is a chat and social application with an Expo / React Native mobile client and a Node.js backend.

## Repository layout

- `mobile/` — Expo / React Native application.
- `server/` — Express, Socket.IO and MySQL backend.
- `.github/workflows/ci.yml` — server and mobile CI checks.

## Requirements

- Node.js 22
- npm
- MySQL for the backend
- Expo tooling for local mobile development

## Backend

1. Open `server/`.
2. Copy `.env.example` to `.env` and configure the database, a strong unique `JWT_SECRET`, and the trusted client origins.
3. Install and run:

```sh
npm ci
npm test
npm start
```

The server test suite is isolated and does not prove a live MySQL deployment is healthy. Configure and test database migrations against a disposable database before deploying.

## Mobile

1. Open `mobile/`.
2. Copy `.env.example` to `.env`.
3. Set `EXPO_PUBLIC_API_BASE_URL` to the reachable backend base URL (without the `/api` suffix). Use HTTPS in production.
4. Install and start:

```sh
npm install
npx expo start
```

The server and mobile lockfiles currently need regeneration and review; CI temporarily reconciles dependencies with `npm install` before running checks. Expo compatibility, Expo Doctor and Android export are blocking checks; the current TypeScript check is visible but non-blocking because it exposes pre-existing type errors across several screens and components. Do not treat installs as fully reproducible until both regenerated lockfiles are committed and CI uses `npm ci`.

## Release readiness

A green CI run is not a production-readiness certification. Before public release, complete real-device and staging tests for authentication, OTP, chat permissions, media uploads, notifications, backups, and failure recovery. Review `SECURITY-REVIEW.md` for encryption and calling limitations that remain release blockers.

## Data and compatibility

The existing MySQL database name and schema are intentionally not renamed by this repository cleanup. Back up production data before applying any future migration.
