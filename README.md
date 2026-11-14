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

CI regenerates both lockfiles from clean dependency manifests on the working PR branch, commits them, and then validates reproducible installs with `npm ci`. Expo compatibility, Expo Doctor, TypeScript and Android export are blocking checks.

## Release readiness

A green CI run is not a production-readiness certification. Before public release, complete real-device and staging tests for authentication, OTP, chat permissions, media uploads, notifications, backups, and failure recovery. Review `SECURITY-REVIEW.md` for encryption and calling limitations that remain release blockers.

## Data and compatibility

The existing MySQL database name and schema are intentionally not renamed by this repository cleanup. Back up production data before applying any future migration.


## Mobile media features

The chat client supports photo, video, and document attachments. Photos and videos are compressed on-device before upload when the native codec is available; if compression fails for a particular file, the app asks to continue with the original. Videos play inside the conversation and documents open with the device's registered viewer.

The media picker/compressor adds native modules. After merging these changes, install the updated mobile dependencies and create a fresh EAS development/production build; Expo Go cannot load the native compressor. The current app binary will not gain these features until it is rebuilt.


## Native calling requirements

One-to-one WebRTC calls and group calls require a fresh EAS development/production build with the native `react-native-webrtc` module and config plugin. Expo Go cannot provide the native media engine. Group calls currently use a peer-to-peer mesh capped at five participants; a larger deployment should migrate group rooms to an SFU such as LiveKit. Screen sharing is exposed only where the native WebRTC build and operating system support display capture; iOS may require additional ReplayKit broadcast-extension configuration.


## Native calling requirements

One-to-one WebRTC calls and group calls require a fresh EAS development/production build with the native `react-native-webrtc` module and config plugin. Expo Go cannot provide the native media engine. Group calls currently use a peer-to-peer mesh capped at five participants; larger rooms should migrate to an SFU such as LiveKit. Screen sharing is exposed only where the native WebRTC build and operating system support display capture; iOS requires a ReplayKit broadcast-extension implementation.
