# Security and release-readiness review

Reviewed against the repository state on 2026-11-13. This is a source review, not a penetration test or production runtime certification.

## Release blockers

### 1. Direct-message encryption is optional, not guaranteed

The reviewed client previously fell back to plaintext when either peer key was unavailable, and the server accepted plaintext on direct message, edit, schedule and forward routes. The current change makes the client fail closed for direct text, validates the E2EE envelope on the server for send/edit/schedule/forward, and disables direct-chat polls until structured-message encryption exists. Historical plaintext messages remain plaintext; this does not retroactively encrypt them.

The strict fail-closed policy is implemented for direct text routes. Remaining work before claiming production-grade E2EE includes key authenticity and key-change handling, multi-device key management, backup KDF review, cryptographic test vectors, and integration tests against staging MySQL.

Also review public-key authenticity and key-change handling, multi-device behavior, backup KDF strength, recovery, and downgrade resistance. Do not rely on a client-only badge as proof of encryption.

### 2. Media is not end-to-end encrypted

The integration guide states that photos, files and voice messages are not E2EE. They may be access-controlled by the server, but that is not end-to-end encryption. Any product copy must distinguish server-side access control from E2EE.

### 3. Calling is not ready for release

The integration guide says calls require a native development build and WebRTC, but the current mobile dependency manifest does not include `react-native-webrtc` and the guide also says calls are disabled in Expo Go. No working call flow was verified in this source review. Voice/video calling is explicitly hidden and incoming calls are rejected when the native WebRTC module is absent. Treat calling as unavailable until the native dependency, platform configuration, signaling, permissions, TURN behavior, incoming-call behavior and real-device tests are implemented and verified.

## Required staging tests

- Authentication, OTP rate limits, token expiry/revocation and administrator authorization.
- Direct and group membership checks for messages, uploads, downloads and socket events.
- Upload rejection, duplicate retry, persistence failure and orphan-file cleanup.
- MySQL migrations from both a fresh database and a copy of the current schema.
- Redis unavailable/reconnect behavior and OTP counter correctness.
- E2EE key creation, missing/changed peer keys, tampering, backup/restore and every text-send route.
- Confirm that old clients and direct-message API routes cannot bypass the server-side E2EE envelope check.
- Android and iOS development/release builds on physical devices.
- Push notifications, background/terminated app behavior, privacy settings and account deletion.

## Scope and limitations

This review did not change the database schema, production secrets, or live deployment configuration. CI tests and static checks do not replace a security assessment, dependency audit, penetration test, or device testing.

## Follow-up hardening and automated MySQL coverage

- Chat and story media downloads require a valid session plus resource-level authorization. Chat media is limited to conversation participants and respects expiry and per-user deletion; story media follows public/private visibility, follower, ban and block rules.
- Private media responses use `Cache-Control: private, no-store`; unknown resources return 404 to avoid disclosing file existence.
- CI provisions a disposable MySQL 8.4 service and runs integration checks against `special_test_ci`. The integration test refuses to run unless `DB_NAME` uses the `special_test_*` prefix and `NODE_ENV` is not production.
- The checks cover database initialization, foreign-key enforcement, participant-scoped media access, view-once and per-user deletion behavior, story visibility, and block enforcement. CI also starts the API against the disposable MySQL instance and smoke-tests health and unauthenticated access boundaries for messages and private uploads. This is an ephemeral CI staging runtime, not a persistent deployed staging environment; it does not replace production penetration testing or a migration rehearsal against a production copy.
