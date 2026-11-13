# X-style redesign

Tabs: Home · Search · Notifications · Messages (your existing chat backend) · Profile.
Dark mode: Profile → Settings → Dark mode (pure-black "lights out").

New/rewritten: HomeScreen, SearchScreen, NotificationsScreen, PostDetailScreen, ComposeScreen,
ChatsScreen (Messages), ProfileScreen, ProfileEditScreen, SettingsScreen (replaces More),
components PostCard / PostComposer / NotificationItem / ScreenHeader / Tabs, services/social.ts.

## Backend endpoints for the social features (src/services/social.ts)
If these don't exist yet the app falls back to on-device storage, so it works right away.

GET /posts · GET /posts/user/:username · POST /posts (content, optional image) · DELETE /posts/:id
POST /posts/:id/like · POST /comments/post/:id {content}
GET /notifications · DELETE /notifications/:id · POST /users/:id/follow
