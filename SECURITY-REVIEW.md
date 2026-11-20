# Security and release-readiness review

<<<<<<< HEAD
Reviewed against the repository state on 2026-11-13. This is a source review, not a penetration test or production runtime certification.
=======
Reviewed against the maintenance branch on 2026-11-20. This is a source review, not a penetration test or production runtime certification.
>>>>>>> 8428d7fb19f75dea3fae0149e087bb356d7898c4

## Release blockers

### 1. Direct-message encryption is optional, not guaranteed

<<<<<<< HEAD
The reviewed client previously fell back to plaintext when either peer key was unavailable, and the server accepted plaintext on direct message, edit, schedule and forward routes. The current change makes the client fail closed for direct text, validates the E2EE envelope on the server for send/edit/schedule/forward, and disables direct-chat polls until structured-message encryption exists. Historical plaintext messages remain plaintext; this does not retroactively encrypt them.

The strict fail-closed policy is implemented for direct text routes. Remaining work before claiming production-grade E2EE includes key authenticity and key-change handling, multi-device key management, backup KDF review, cryptographic test vectors, and integration tests against staging MySQL.
=======
The mobile client encrypts direct text when both participants have registered public keys. The server now independently counts the two participants and requires a valid E2EE envelope on send, edit, schedule and forward routes once both keys exist; direct-chat polls are disabled under that same condition because structured-message encryption is not implemented. If either participant has no key registered, direct text remains plaintext for compatibility and must not be described as E2EE. Historical plaintext messages remain plaintext; this does not retroactively encrypt them.

This is a conditional downgrade-resistant policy after both keys are registered, not universal E2EE. Remaining work before claiming production-grade E2EE includes key authenticity and key-change handling, multi-device key management, backup KDF review, cryptographic test vectors, group encryption, media encryption, and integration tests against staging MySQL.
>>>>>>> 8428d7fb19f75dea3fae0149e087bb356d7898c4

Also review public-key authenticity and key-change handling, multi-device behavior, backup KDF strength, recovery, and downgrade resistance. Do not rely on a client-only badge as proof of encryption.

### 2. Media is not end-to-end encrypted

The integration guide states that photos, files and voice messages are not E2EE. They may be access-controlled by the server, but that is not end-to-end encryption. Any product copy must distinguish server-side access control from E2EE.

### 3. Calling is not ready for release

<<<<<<< HEAD
The integration guide says calls require a native development build and WebRTC, but the current mobile dependency manifest does not include `react-native-webrtc` and the guide also says calls are disabled in Expo Go. No working call flow was verified in this source review. Voice/video calling is explicitly hidden and incoming calls are rejected when the native WebRTC module is absent. Treat calling as unavailable until the native dependency, platform configuration, signaling, permissions, TURN behavior, incoming-call behavior and real-device tests are implemented and verified.
=======
The mobile dependency manifest already includes `react-native-webrtc` and its Expo config plugin, and the individual and group call contexts implement signaling/media flows. The native module is not available in Expo Go; a custom Android/iOS development build is required. Static checks and Android JS bundle export do not prove native linking, microphone/camera permissions, incoming-call lifecycle, ICE/TURN connectivity, background behavior, or real-device interoperability. Treat calls as unverified until EAS/native builds and physical-device tests pass on both platforms, including a TURN relay test.

### 4. TOTP authenticator secrets at rest

New authenticator setups encrypt TOTP secrets with AES-256-GCM using a dedicated 32-byte `TOTP_ENCRYPTION_KEY`. The key must be provisioned as a deployment secret (64 hex characters or canonical base64), never committed to source control, and backed up separately with restricted access. Existing legacy plaintext TOTP secrets remain readable during rollout and are re-encrypted after a successful TOTP login when the key is configured; accounts that have not successfully authenticated yet may still have legacy plaintext values until migrated. Do not remove or rotate the key without a tested re-encryption procedure, or encrypted 2FA accounts will be unable to authenticate. New 2FA setup fails if the key is missing or invalid.
>>>>>>> 8428d7fb19f75dea3fae0149e087bb356d7898c4

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

<<<<<<< HEAD
This review did not change the database schema, production secrets, or live deployment configuration. CI tests and static checks do not replace a security assessment, dependency audit, penetration test, or device testing.
=======
This review did not change the database schema, production secrets, or live deployment configuration. WhatsApp browser automation now defaults to disabled; explicitly set `WHATSAPP_ENABLED=true` only where that integration is intentionally used. CI tests and static checks do not replace a security assessment, dependency audit, penetration test, or device testing.
>>>>>>> 8428d7fb19f75dea3fae0149e087bb356d7898c4

## Follow-up hardening and automated MySQL coverage

- Chat and story media downloads require a valid session plus resource-level authorization. Chat media is limited to conversation participants and respects expiry and per-user deletion; story media follows public/private visibility, follower, ban and block rules.
- Private media responses use `Cache-Control: private, no-store`; unknown resources return 404 to avoid disclosing file existence.
- CI provisions a disposable MySQL 8.4 service and runs integration checks against `special_test_ci`. The integration test refuses to run unless `DB_NAME` uses the `special_test_*` prefix and `NODE_ENV` is not production.
- The checks cover database initialization, foreign-key enforcement, participant-scoped media access, view-once and per-user deletion behavior, story visibility, and block enforcement. CI also starts the API against the disposable MySQL instance and smoke-tests health and unauthenticated access boundaries for messages and private uploads. This is an ephemeral CI staging runtime, not a persistent deployed staging environment; it does not replace production penetration testing or a migration rehearsal against a production copy.

## Dependency security

- The backend previously depended on Multer 1.x. It is upgraded to Multer 2.5.0 to address the published high-severity multipart denial-of-service advisories affecting older releases.
<<<<<<< HEAD
- CI now runs `npm audit --omit=dev --audit-level=high` for server production dependencies and fails on high/critical findings. Review audit output when dependency changes are made; a clean audit does not replace runtime security testing.

### Open dependency risk requiring a separate decision

The production dependency audit currently reports high-severity transitive advisories in the WhatsApp Web/Puppeteer browser stack, including `basic-ftp`, `extract-zip`, and `zod`. The installed WhatsApp Web dependency range resolves to the 1.34.8 line; forcing a downgrade to make `npm audit fix --force` green would be a breaking change and was not applied.

- `extract-zip` versions through 2.0.1 have published high-severity symlink/path-traversal advisories; the GitHub-reviewed advisories list no patched release.
- `basic-ftp` findings affect the older 5.x dependency pulled through Puppeteer proxy tooling; newer releases have changing advisories, so a blind major override is not considered safe.
- These packages are transitive to the WhatsApp Web/Puppeteer browser automation stack, not the chat upload parser. Their presence still represents an unresolved supply-chain risk and must be addressed before public launch, preferably by isolating/replacing the browser automation integration or applying a reviewed vendor patch and validating WhatsApp login/send behavior.
=======
- CI runs `npm audit --omit=dev --audit-level=critical` for server production dependencies: critical findings fail the build, while high-severity findings are reported and remain tracked below because the WhatsApp Web/Puppeteer dependency tree currently contains unresolved high-severity advisories. Review the full audit output when dependencies change; this gate is not a claim that the dependency tree is free of high-severity risk.

### Open dependency risk requiring a separate decision

The production dependency audit has reported high-severity transitive advisories in the WhatsApp Web/Puppeteer browser stack, including `basic-ftp`, `extract-zip`, and `zod`. The installed WhatsApp Web dependency range resolves to the 1.34.8 line; forcing a downgrade to make `npm audit fix --force` green would be a breaking change and was not applied. To reduce exposure, WhatsApp browser automation is now opt-in: it starts only when `WHATSAPP_ENABLED=true`. Keep it disabled unless OTP delivery through the linked WhatsApp account is explicitly required.

- `extract-zip` versions through 2.0.1 have published high-severity symlink/path-traversal advisories; the GitHub-reviewed advisories list no patched release.
- `basic-ftp` findings affect the older 5.x dependency pulled through Puppeteer proxy tooling; newer releases have changing advisories, so a blind major override is not considered safe.
- These packages are transitive to the WhatsApp Web/Puppeteer browser automation stack, not the chat upload parser. The opt-in default reduces exposure but does not remove the vulnerable packages from the dependency graph. Before enabling WhatsApp in production, isolate/replace the browser automation integration or apply a reviewed vendor patch and validate WhatsApp login/send behavior.
>>>>>>> 8428d7fb19f75dea3fae0149e087bb356d7898c4
- CI reports all production advisories and blocks critical-severity findings. High-severity findings remain visible in the audit output and are explicitly tracked here rather than silently suppressed.
