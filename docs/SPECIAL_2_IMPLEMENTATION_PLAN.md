# Special 2.0 — implementation plan

This document tracks the requested product scope and the technical dependencies required to ship it safely. Existing features are reused rather than duplicated.

## Delivery principles
- Keep API changes additive and preserve existing clients where possible.
- Use database migrations that are safe on existing MySQL installations.
- Never expose AI, TURN, LiveKit, or storage credentials in the mobile bundle.
- Keep end-to-end encrypted message bodies on-device; AI processing of private messages must be an explicit user action and disclose when text is sent to an external provider.
- Use a Selective Forwarding Unit (SFU) for group calls; do not implement an unbounded peer-to-peer mesh.
- Validate Android and iOS native builds before declaring WebRTC, screen sharing, or screenshot controls complete.

## Workstreams

### A. Media messaging
- [ ] Image, video, audio, and document selection from native pickers.
- [ ] Client-side image/video compression with original-quality override.
- [ ] Upload progress, retry, cancellation, size/type validation, and safe filenames.
- [ ] In-app image gallery and video playback; authenticated access to private media.
- [ ] Add document metadata and MIME type to message responses and search.

### B. Calls
- [ ] Verify/install a compatible `react-native-webrtc` native dependency and EAS development-build configuration.
- [ ] Add audio mute, camera toggle, front/back camera switch, speaker route, and connection recovery.
- [ ] Add TURN credentials for reliable calls across carrier NATs.
- [ ] Add group calls through a configured LiveKit/SFU deployment (room tokens minted by the server).
- [ ] Add native screen-share extensions and platform-specific permission flows.
- [ ] Test call interruption, app backgrounding, Bluetooth, low bandwidth, and permission denial.

### C. Stories
- [ ] Text-only stories with background/theme options.
- [ ] Audience controls: everyone, followers, and only me; enforce on every read/viewer/media endpoint.
- [ ] Reply by opening/creating a direct conversation and passing a story reference; message content must still use the normal E2EE path.
- [ ] Viewer list and expiry cleanup verification.
- [ ] Preserve 24-hour TTL and block/private-account rules.

### D. AI
- [ ] Configurable server-side OpenAI-compatible provider; no secrets in mobile.
- [ ] On-demand summary of selected conversation context with clear consent.
- [ ] Translation and suggested replies with per-user language preferences.
- [ ] Voice transcription via configured speech-to-text provider.
- [ ] Natural-language search over metadata and user-authorized content only.
- [ ] Group moderation suggestions; never auto-delete or ban without moderator confirmation.
- [ ] Rate limits, usage quotas, cost reporting, and provider timeout/error handling.

### E. Privacy and safety
- [ ] Verify app and chat biometric locks across iOS/Android lifecycle events.
- [ ] Keep screenshot prevention platform-aware and disclose that external cameras/modified devices cannot be blocked.
- [ ] Add per-chat notification controls, mention/reply notification categories, and daily digest scheduling.
- [ ] Test notification delivery in foreground, background, terminated state, and token refresh.

### F. Admin and operations
- [ ] DAU/WAU/MAU, calls and media usage analytics.
- [ ] Multi-role RBAC (owner/admin/moderator/support) with least-privilege API enforcement.
- [ ] User warnings, suspensions, content review, stories and group moderation.
- [ ] Targeted campaigns with audience preview, idempotent delivery, and delivery audit.
- [ ] Backup/restore workflows with off-host storage and restore verification.
- [ ] Server error/latency monitoring and release/version tracking.

## External deployment requirements
- AI: `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, and optionally `AI_TRANSCRIPTION_MODEL`.
- Calls: `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD`; group calls additionally require a LiveKit/SFU URL and server API secret.
- Push: valid Expo/EAS push credentials and platform notification configuration.
- Backups: encrypted object-storage credentials and a tested retention policy.

## Current implementation note
The first foundation change adds concurrency-safe unread badges, durable broadcast IDs, input validation for announcements, and active-user/call/media metrics to the admin stats API and overview. The remaining checkboxes require separate, testable feature pull requests and native build/deployment configuration.
