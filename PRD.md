# QuestLife — Product Requirements Document

**Status:** code-verified as-built product definition  
**Last verified:** 2026-07-23  
**Scope:** QuestLife mobile app, private admin dashboard, supporting Supabase backend, and the public-website boundary.

This is the single source of truth for what the repository implements today. “Implemented” means a user-facing route and supporting client/backend path exist in this repository. It does not imply that a feature has been production-enabled, configured, or externally tested.

## 1. Product definition

QuestLife helps people turn real-world activities into small, rewarding adventures called quests. A member discovers an activity, starts it, completes it, records as much or as little of the experience as they want, earns XP, and builds an archive of their life. The product uses progression, streaks, collections, memories, and lightweight social play to make doing worthwhile activities easier—not to become a task manager, time tracker, or competitive social network.

The core loop is:

`Discover → choose/start a quest → do it → complete → log lore or skip → earn XP → revisit memories/progress → return`

### Product surfaces

| Surface | Repository location | Purpose |
| --- | --- | --- |
| Member app | `App/` | iOS-first Expo/React Native experience; Android and web-capable. |
| Admin dashboard | `Admin/` | Private web app for authorized content and operations staff. |
| Backend | `Database/migrations/`, `supabase/migrations/` | Supabase PostgreSQL, Auth, Storage, RLS, RPCs, triggers, and realtime-backed reads. |
| Public website | `Website/` | Reserved home for public marketing, privacy, terms, and support pages; no product implementation is currently present. |
| Shared code | `Shared/` | Reserved for future shared types and helpers; currently documentation only. |

## 2. Users, jobs, and boundaries

### Member audiences

- **Curious adventurer:** needs an approachable answer to “what should I do next?”
- **Routine builder:** uses short quests, a daily allowance, XP, and streaks to keep momentum.
- **Memory keeper:** wants reflections, photos, and a dated archive of completed experiences.
- **Social participant:** wants friends, challenges, parties, and shared motivation without a public-performance-first product.

### Operational audiences

- **Admin:** creates drafts, views published content, and carries out only the workflows permitted by their assigned permissions.
- **Super admin:** manages admin access and permissions, publishes/reviews content, manages operational settings, featured batches, announcements, and deletions where authorized.

### Non-goals

- General task, calendar, project-management, or habit-tracking software.
- Mandatory location verification, mandatory photo proof, or compulsory time tracking for solo quests.
- A global competitive leaderboard or public feed as the primary motivation loop.
- Member-side quest authoring or moderation.
- A public website delivered by the current codebase.

## 3. Product principles and experience quality

- The app is warm, playful, encouraging, and mobile-first; it must not read as a generic productivity dashboard.
- The next meaningful action—start, save, complete, log, invite, or manage—must remain obvious.
- Journal is the personal archive; Streaks owns streak history and social streak comparison; Profile owns identity, posts, lifetime stats, and Quest Trail.
- Important state must not rely only on color. Controls should be touch-friendly, readable, and have accessible labels/roles where applicable.
- Backend-backed surfaces need loading, empty, retry, and recoverable-unavailable states.
- Local calendar dates are supplied by the client for daily limits, streaks, and journal placement.

## 4. Member app requirements

### 4.1 Access, onboarding, and account

The app presents an onboarding introduction before protected content. It supports email registration, email/password sign-in, password reset, email verification resend and polling, auth callback handling, and secure persisted sessions on native devices.

Registration requires first name, last name, a unique username of 3–20 letters/numbers/underscores, and a password with at least eight characters including uppercase, lowercase, and a number. Verified older accounts missing their name are blocked behind a name-completion flow. Email verification gates protected app data.

Apple and Google sign-in UI exists, but production OAuth requires provider configuration and must not be represented as available until configured.

### 4.2 Navigation and daily home

The primary tabs are Lobby, Explore, Journal, Social, and Profile. Supporting routes cover active quests, individual quests, saved quests, collections, memories, streaks, friend discovery/profile, notifications, parties, and settings.

Lobby is the daily starting point. It surfaces the member’s greeting, daily quest capacity, streak/progress cues, current active quest, and today’s completed activity. It can launch a quest or route into the relevant deeper surface.

### 4.3 Quest catalog and discovery

Members can browse published quests and published, non-empty adventure packs. A quest includes title, category, difficulty, estimated time, XP, description, steps, accent color, and review data. Supported categories are Adventure, Food and Drinks, Fitness, Nature, Creativity, Events, Skills, Social, and Wild Card; difficulties are Easy, Medium, Hard, and Formidable.

Explore supports search, category browsing, sorting/filtering, featured content, save state, completion state, quest details, reviews, and starting a quest. A member can save or unsave a quest, browse saved quests, and manage saved content. The current backend content model supports featured batches by date.

### 4.4 Personal collections and planning

Members can create, edit, delete, pin, and browse personal adventure packs. A pack has a title, optional description, icon, accent color, optional cover image, ordered quests, and a pin state. Collection covers are stored separately. The database also includes daily-plan entities; the app’s primary planning experience is centered on user collections rather than a documented standalone daily-plan screen.

### 4.5 Solo quest engine and rewards

Only one active solo quest session may exist per member. A session may begin from Explore, Saved, or Social, can be saved for later or abandoned, and is completed through the quest engine.

- The daily quest limit is five completions per member-local date when the admin-controlled limit is enabled.
- A full lore log awards the quest’s full XP; skipping lore awards `floor(quest XP / 2)`.
- Logging requires a 1–5 star rating. Reflection text, public review text, and photo URLs are optional.
- A published quest may be completed again when repeat-completion rules permit it; quest-completion records are the lifetime source of truth.
- Completion updates XP, daily capacity, personal streak state, journal history, profile statistics, and notification triggers.
- Level is a 500-XP band: `floor(total XP / 500) + 1`.

The engine exposes a member recovery action that resets only today’s eligible solo completion/session history. It is a deliberate corrective workflow, not a general history deletion tool.

### 4.6 Active quest recording

An active quest can maintain a local record with elapsed active duration, pause state, text entry title/body, route points, photo references, and sync state. With permission, location tracking captures usable route points and the app renders a simplified route. Media and snapshots can be synchronized to Supabase; local state supports pending/failed/synced recovery. These capabilities are optional and must degrade gracefully if location, camera, storage, or background-task support is unavailable.

### 4.7 Journal and memories

Journal is the member’s dated archive starting at account creation. It groups completed quests by local date and supports week/month navigation, memory details, day titles, and one mood per date (sad, neutral, happy). A memory contains the completed quest, XP, category/difficulty, reflection, media paths, and party association where applicable. The Journal also surfaces a live solo quest before it becomes a completion and summarized party history/rankings.

Members can revise a memory reflection and upload/resolve journal media. The database has support for party-linked photos and private journal media. A weekly recap/“Memory Wrap” is not implemented.

### 4.8 Streaks and recovery

One or more completed quests on a local date counts as one personal streak day. A streak advances on consecutive dates, remains live through the day after the last completion, and otherwise displays as broken. Members can choose public/private streak visibility.

The Streak screen provides personal current/longest streak, completion-day calendar data, milestones, friends’ visible streaks, and duo-streak controls. A recovery entitlement exists in the backend and UI flow; recovery eligibility is enforced by the backend.

### 4.9 Friends, challenges, and discovery

Members can search profiles by username/display name, receive suggestions, optionally discover contacts by submitted email addresses, view friend profiles, send/cancel/respond to requests, and remove friends. Friend profiles are backend-supported and have an in-app route.

Friends can receive quest shares and same-quest challenges. The social overview has contracts for incoming/outgoing shares, incoming challenges, and active challenges. A feature should only be described as fully surfaced when its Social UI exposes that state; the service/backend support is broader than the primary Social screen in several areas.

### 4.10 Parties

Parties are private social groups with invite codes, members, leader/member roles, status/history, optional capacity, optional location label/type, rules, media, and a member feed. A member can create, join, edit, end, leave, invite to, and respond to invitations for a party.

Party quests can be set by the host, added, or suggested by members. Parties support:

- **Everyone Together:** a host runs a shared quest/round; shared timing and completion results are visible to the group.
- **Free for All:** members independently complete selected quests and earn their own base XP.
- Active rounds, individual party sessions, rankings, fastest finishers, completion history, feed posts, emoji reactions, briefing state, and unread feed/leaderboard counters.
- Optional or required party photo proof settings; party media is private to participants.

Every Party completion creates a regular quest-completion record for the participant, so it contributes to the member’s XP, history, Quest Trail, and other completion-derived metrics. The app uses live reads/realtime subscriptions in Party detail where supported.

### 4.11 Profile, posts, and statistics

Members can edit display name, username, bio, emoji, avatar color, title, and avatar image. Profile posts are created only from the member’s completed quests and can include post title, caption, media, measured duration, selected completion stats, and visibility (`private`, `friends`, or `public`). The product supports editing/deleting posts, likes, social feed scopes, and post comments/replies.

The Profile Stats tab includes XP level progress, longest streak, total completed quests, total completed time, and **Your Quest Trail**. Quest Trail ranks the three categories with the highest all-time `quest_completions`, including repeated Party completions, with an accessible empty state for new members. Profile overview data remains safe before the category-trail migration has been deployed by treating the new field as empty.

Profile does not currently implement an achievement catalogue, achievement earning rules, or a dedicated Social-stat card (friends/parties); these are future scope, not launched functionality.

### 4.12 Notifications, announcements, and settings

In-app notifications are persisted and readable per user. Notification categories cover quest, progress, social, party, and system events, including completion, XP, streak, level, friend, party, admin announcement, and feature/service events. Members can mark notifications or journal-related notification groups as read. Push delivery is only represented as `push_eligible`; actual push delivery/configuration must be verified separately.

Admins can enable/disable the introductory experience and publish app announcements. Members can read/dismiss active announcements.

Settings routes cover notification preferences, privacy, app preferences, help/support, and about. Persisted preferences include haptics, reduce motion, high contrast, plus toggle groups for streak alerts, quest reminders, milestones, friend activity, party invites, daily motivation, and weekly recap. Account deletion is exposed via the account service and must remain a deliberate destructive flow.

## 5. Admin dashboard requirements

The Admin app is a web-only private operations surface sharing the Supabase backend. It has separate authentication, registration/invite acceptance, verification, password recovery, and OAuth scaffolding. Every protected action must respect the current admin membership, active state, role, and permission set.

### Content operations

Authorized administrators can create and edit quests and adventure packs. Quest workflow states are draft, in review, published, and archived. The dashboard exposes content library, create/edit route, review queue, published view, featured content, and adventure-pack management.

Admin functionality includes:

- Quest and pack metadata, category, difficulty, XP, steps, duration, colors, status, review notes, and publication metadata.
- Scheduled featured-quest batches and assignment/removal of quest entries.
- Quest review-result notifications.
- Admin-controlled daily quest limit and introductory experience settings.
- Publishing/deactivating application announcements.

### Admin governance

The dashboard manages its own profile, inbox/notifications, admin directory, invites, access, enable/disable state, role/permission updates, password reset initiation, and deletion subject to permission checks. The implementation recognizes permissions for published/all quest visibility, draft creation, review submission, review/publish, content deletion, admin management, profile management, and inbox access. Audit-log tables record operational actions, with super-admin access controls.

There is no code-verified product analytics dashboard in the current Admin routes. “Analytics” must not be promised as a delivered dashboard feature until a route and data path exist.

## 6. Backend and data requirements

Supabase is required. Client apps use public environment configuration, never service-role secrets. The backend uses PostgreSQL tables, RLS policies, security-definer RPCs, triggers, Storage policies, and selected realtime subscriptions. Key domains are:

| Domain | Primary data |
| --- | --- |
| Identity | Auth users, profiles, profile images, verified-name completion. |
| Content | Quests, adventure packs, pack ordering, featured batches, reviews, saved quests. |
| Progress | Quest sessions, completions, XP, engine settings, active-quest snapshots/routes/media. |
| Archive | Journal entries, completion-linked memories, journal media. |
| Streaks | Personal streaks, duo streaks/invites/nudges, recovery records. |
| Social | Friend requests/friendships, shares, challenges, profile posts/likes/comments. |
| Parties | Parties, members/invites/rules/templates, quests/suggestions/rounds/sessions/completions, feed/reactions/notifications/briefings/media. |
| Operations | Admin memberships/permissions/invites/notifications/audit logs, app announcements, application notifications. |

Security requirements:

- Unauthenticated users cannot access protected member or admin data.
- RLS limits users to their own private data and valid social/party visibility boundaries.
- RPCs enforce participant/friend/admin checks for state-changing workflows.
- Storage is separated by purpose; private party and journal media cannot be publicly readable.
- Profile image availability and post visibility follow their explicit policies.
- Database migrations are ordered history. `supabase/migrations/` is deployable migration history; `Database/migrations/` mirrors schema/reference history.

## 7. Technical architecture

- **Frontend:** Expo Router, React Native, TypeScript, React 19; mobile is iOS-first with Android/web capability. Admin is Expo Router configured for web.
- **State:** React context providers partition auth, content, active quest, engine, saved quests, social, streaks, settings, notifications, and feedback.
- **Backend access:** Supabase JS, direct table/storage queries for user-scoped data, and RPCs for rules-heavy workflows.
- **Native capabilities:** SecureStore, Image Picker, Camera, Location/Task Manager, SQLite-backed local active-quest state, Haptics, Contacts, and deep links.
- **Validation:** Zod and React Hook Form for account/content forms.
- **Verification command:** `npm run app:typecheck` for member app; `npm run admin:typecheck` for dashboard.

## 8. Measurement and release gates

Before broad launch, instrument and review:

- Verification completion and first-completion-within-24-hours rates.
- Quest discovery-to-start, start-to-completion, lore-log versus skip, save-to-start, and repeat-completion rates.
- D1/D7/D30 retention, daily active members, average active/longest streak, and streak recovery rate.
- Friend request acceptance, challenge response, party creation/join/completion, and duo-streak participation.
- Journal return rate, post/share engagement, category distribution, and Quest Trail exposure.
- Completion failures, sync failures, permission denials, backend/RPC errors, and notification delivery/read rates.

Release gates include configured Supabase public variables, deployed current migrations, at least one published quest/pack, verified RLS/RPC permissions, tested account verification/reset callbacks, and a clear production decision for OAuth and push delivery.

## 9. Explicitly not delivered or requiring validation

The following must not be represented as complete without further implementation or production validation:

1. Public marketing website, privacy policy, terms, and support website content.
2. Production-configured Apple/Google OAuth.
3. Verified push-notification delivery; the repository implements in-app notification persistence and push-eligible metadata.
4. Weekly Memory Wrap/recap generation.
5. An achievement system or achievement history UI.
6. A dedicated Profile Social statistics section for friends and parties.
7. A code-verified admin analytics dashboard.
8. Fully surfaced Social UI for every backend-supported challenge/share/invite state.
9. Universal proof that location/background tracking behaves correctly across all device/OS permission conditions.

## 10. Document maintenance rules

Update this PRD when a member-visible capability, admin workflow, backend rule, or scope boundary changes. Mark incomplete functionality as partial or planned; do not describe service-only or schema-only capabilities as fully launched UI. Keep design tokens and visual implementation guidance in `App/DESIGN.md`; keep concise surface-specific product principles in `App/PRODUCT.md` and `Admin/PRODUCT.md`.
