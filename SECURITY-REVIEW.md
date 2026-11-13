# Security and release-readiness review

Reviewed against the repository state on 2026-11-13. This is a source review, not a penetration test or production runtime certification.

## Release blockers

### 1. Direct-message encryption is optional, not guaranteed

The direct-chat screen currently sends readable text when either the peer public key or the local key is unavailable. The same fallback exists in the forwarding path; location, sticker, and scheduled text paths also fall back to plaintext. The integration guide explicitly describes this behavior. Consequently, the product must not claim that all direct messages are end-to-end encrypted.

Before release, choose and implement one explicit policy:
- **Strict E2EE:** prevent sending direct-chat text until both keys are available and verified; make the unavailable-key state visible; apply the same rule to forwarding, scheduled messages, stickers and location text; test every send path.
- **Clearly labelled optional encryption:** show a persistent per-message encryption status and obtain informed user confirmation before sending plaintext.

Also review public-key authenticity and key-change handling, multi-device behavior, backup KDF strength, recovery, and downgrade resistance. Do not rely on a client-only badge as proof of encryption.

### 2. Media is not end-to-end encrypted

The integration guide states that photos, files and voice messages are not E2EE. They may be access-controlled by the server, but that is not end-to-end encryption. Any product copy must distinguish server-side access control from E2EE.

### 3. Calling is not ready for release

The integration guide says calls require a native development build and WebRTC, but the current mobile dependency manifest does not include `react-native-webrtc` and the guide also says calls are disabled in Expo Go. No working call flow was verified in this source review. Treat voice/video calling as unavailable until the native dependency, platform configuration, signaling, permissions, TURN behavior, incoming-call behavior and real-device tests are implemented and verified.

## Required staging tests

- Authentication, OTP rate limits, token expiry/revocation and administrator authorization.
- Direct and group membership checks for messages, uploads, downloads and socket events.
- Upload rejection, duplicate retry, persistence failure and orphan-file cleanup.
- MySQL migrations from both a fresh database and a copy of the current schema.
- Redis unavailable/reconnect behavior and OTP counter correctness.
- E2EE key creation, missing/changed peer keys, tampering, backup/restore and every text-send route.
- Android and iOS development/release builds on physical devices.
- Push notifications, background/terminated app behavior, privacy settings and account deletion.

## Scope and limitations

This review did not change the database schema, production secrets, or live deployment configuration. CI tests and static checks do not replace a security assessment, dependency audit, penetration test, or device testing.
