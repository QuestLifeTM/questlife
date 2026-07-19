# QuestLife Mobile App — Product Requirements Document

**Status:** As-built product definition  
**Platform:** iOS-first Expo/React Native app (Android and web-capable)  
**Audience:** Product, design, engineering, and content operations

## 1. Product summary

QuestLife helps people turn ordinary real-world activities into small, rewarding quests. Users discover a quest, make it part of today, complete it, and keep a personal record of the experience. XP, streaks, journaling, curated packs, and friends provide motivation without making the experience feel like a conventional task manager or a highly competitive game.

The app’s core loop is:

`Discover → start one quest → complete → log or skip lore → earn XP → return for the next day`

## 2. Problem and opportunity

People often want to try meaningful, fun, or healthy activities but do not know what to do next and lack a lightweight reason to follow through. Existing productivity tools emphasize obligations; social products reward broadcasting instead of doing.

QuestLife should make choosing an activity feel easy, completing it feel rewarding, and remembering it feel personally valuable.

## 3. Target users

- **Curious solo adventurer:** wants quick, approachable ideas for getting out, learning, creating, or connecting.
- **Routine builder:** uses a daily quest and streak to sustain small habits.
- **Memory keeper:** values reflections, a visual archive, and revisiting completed experiences.
- **Social motivator:** wants friends, shared challenges, and small-group activities without a public-performance-first experience.

## 4. Goals and non-goals

### Goals

1. Help a signed-in user find and begin a suitable quest in a few taps.
2. Make completion rewarding through XP, a daily allowance, and personal/duo streaks.
3. Turn completions into a private, browseable journal with optional reflection and mood.
4. Support planning through curated and user-created adventure packs.
5. Add lightweight social accountability through friends, sharing, challenges, parties, and profile posts.

### Non-goals

- General task, calendar, or project management.
- Time tracking, location verification, or mandatory proof of completion.
- A public feed as the primary product experience.
- Competitive rankings as the principal motivation loop.
- Content authoring or moderation in the mobile client; that is administered outside the app.

## 5. Core experience requirements

| Area | Product requirement | Current behavior |
|---|---|---|
| Onboarding and access | Introduce the value proposition, then gate app data behind an account with verified email. | Intro animation, email registration/login, verification resend/polling, password reset, secure persisted session, and deep-link callbacks. |
| Quest discovery | Show published quests, including title, category, difficulty, duration, XP, description, and steps. Users can search, browse categories, sort, filter by duration/difficulty, and save quests. | Implemented in Explore and quest detail. Featured quests may be selected for the current local day; otherwise app-level featured content is used. |
| Quest sessions | A user may have one active quest at a time and may start from explore, saved, plan, pack, featured, or social contexts. | Implemented. The user can save the active session for later or abandon it through the engine. |
| Completion and rewards | Completing a quest must update today’s completion count, personal XP, and streaks. Users should be able to either log lore for full XP or skip it for reduced XP. | Implemented through the quest-engine completion flow. Logging requires a 1–5 star rating; reflection and public review are optional. |
| Daily energy | Limit completions to five quests per user-local calendar day and communicate remaining capacity. | Implemented; the Lobby shows the daily count and the engine rejects starts/completions above the limit. |
| Lobby | Give the user a clear daily starting point: greeting, streak, energy remaining, active quest or next planned quest, and today’s completed activity. | Implemented as the default tab. |
| Saved quests | Let users bookmark and later filter, sort, open, or remove saved quests. | Implemented. |
| Adventure packs and planning | Offer admin-curated packs and allow users to select quests for today and save their own reusable pack. | Curated packs, pack search, daily plans, and user pack creation are implemented. |
| Journal | Preserve completed quests as date-based memories. Allow users to navigate by week/month, view a memory, give a day a title, and record a mood. | Implemented. The archive starts at account creation; completed quests create the primary memories. |
| Streaks | Reward a user for completing a quest on consecutive local dates; allow streak visibility controls and opt-in duo streaks with friends. | Implemented, including calendar, milestones, friend leaderboard, duo invites, nudge, and leaving a duo streak. |
| Identity and posts | Show a profile with XP-based level, quest/friend/streak stats, editable identity fields, and posts linked to completed quests. | Implemented for the signed-in user, including likes and friend/public/private post visibility in the data model. |
| Friends and co-play | Let users search by username/display name, manage friend requests, share quests, challenge a friend, and create/join parties. | Backend and client service support are present. Friend search/requests, party creation, and party invite acceptance are exposed in the current UI. |

## 6. Functional rules

### Account and privacy

- Registration requires a first name, last name, unique username (3–20 letters, numbers, or underscores), and a password with at least 8 characters, uppercase, lowercase, and a number. Existing verified accounts that predate this requirement must complete their name before using the updated app.
- A user must verify their email before accessing protected app content.
- Auth sessions persist using platform-secure storage on native devices.
- Usernames are the unique QuestLife account handles. The Lobby greets the user by first name; profile personalization may include bio, emoji, avatar color, title, XP, and configurable streak visibility.
- A profile post may be private, friends-only, or public; only completions belonging to the author may be posted.

### Quest and reward rules

- Only published quests and non-empty published packs are visible to ordinary users.
- A completed quest cannot be completed again by the same user.
- The daily completion limit is five, calculated using the user’s local calendar date supplied by the app.
- A full lore log awards the quest’s full XP. Skipping lore awards floor(quest XP / 2).
- Lore logging requires a star rating. It may include reflection text, a public review, and photo URLs; the current UI does not yet collect photos.
- Profile level advances in 500-XP bands: `level = floor(total XP / 500) + 1`.

### Streak rules

- One or more completions on a local date counts as one personal streak day.
- A personal streak advances on consecutive dates and is preserved for the day after the last completion; otherwise its displayed current value resets.
- Duo streaks advance only when both partners complete at least one quest on the same date.
- Duo streaks require friendship. A user can nudge a partner no more than once per duo streak per day, and cannot nudge after the partner has completed for the day.

### Social rules

- Friend requests, quest shares, quest challenges, party invitations, and duo streak invites are limited to authenticated users and enforce friendship/participant checks in the backend.
- Party modes are **Everyone Together** (the host runs a shared quest clock and locks speed bonuses) and **Free for All** (members independently earn base quest XP). Parties retain member history, private media, invite codes, rules, and grouped Journal rankings.

## 7. Primary user journeys

### A. First successful quest

1. User views the onboarding story and creates a verified email account.
2. On the Lobby, user explores or starts the first quest from today’s plan.
3. The quest becomes the single active quest.
4. User completes it, chooses to log lore or skip, and receives XP.
5. The Lobby, streak state, and Journal reflect the completion.

### B. Planning a day

1. User opens Adventure Packs or the quest picker.
2. User selects one or more quests.
3. User saves the selection as today’s plan and may also name it as a personal adventure pack.
4. The first planned quest appears as the Lobby’s suggested next action.

### C. Building accountability

1. User searches and adds a friend.
2. User can share a quest, send a same-quest challenge, invite the friend to a party, or invite them to a duo streak.
3. Users complete quests independently; social state and duo progress update from completions.

## 8. UX and quality requirements

- Use a warm, playful, mobile-first visual language; never position the app as a generic productivity dashboard.
- Provide clear loading, empty, retry, and unavailable states for data-backed screens.
- Maintain large touch targets, readable contrast, predictable navigation, and avoid conveying important state solely by color.
- Respect the user’s local date for plans, daily limits, journal placement, and streak logic.
- Keep the primary action obvious on every important screen: start, complete, log, save, or invite.
- The app must be operable with Supabase configured through public Expo environment variables; it should show recoverable errors when backend data cannot load.

## 9. Metrics to define before launch

- Account verification completion rate.
- First-quest completion rate within 24 hours of sign-up.
- Daily active users who start and complete a quest.
- Lore-log rate versus skip rate.
- D1/D7/D30 retention and average active streak length.
- Save-to-start and plan-to-completion conversion.
- Friend-request acceptance, duo-streak creation, and party participation rates.
- Reported/failed completion attempts and backend error rate.

## 10. Known gaps and proposed follow-on scope

These items are visible in the codebase but are not complete end-user capabilities and should not be positioned as launched features:

1. **Notifications:** the Notifications screen is populated by static example data; no notification persistence, push delivery, read state, or deep-link actions are wired.
2. **OAuth:** Apple and Google buttons intentionally show a setup-required alert. Provider configuration and production sign-in flows remain to be enabled.
3. **Journal Growth tab:** it is a placeholder for trends, badges, and insights.
4. **Photo flow and Memory Wrap:** storage upload support exists, but the completion UI does not select or upload photos and no weekly recap is generated.
5. **Adventure-pack detail state:** start/save/progress actions on a curated pack are local screen state; they should be connected to the quest-session and persistent saved-pack model before being treated as durable progress.
6. **Personal packs:** users can create and list packs, but the current library does not open, edit, delete, or start them.
7. **Social completion:** challenge/share state and party management APIs exist, but the primary Social UI does not yet surface incoming challenges, active challenges, sharing inboxes, party invitations, member invitations, leave actions, or party quest editing.
8. **Profile posts:** the creation UI does not expose visibility selection or photo attachment even though the data model supports both. Friend profile viewing is supported by the backend but no in-app navigation to another user’s profile is exposed.
9. **Quest completion consistency:** the curated pack’s “Mark Done” path uses the legacy completion service rather than the quest engine. It should be consolidated so sessions, XP, daily limits, reviews, and journal behavior remain consistent.
10. **Account controls:** the app has sign-out service support but no visible profile sign-out or account deletion controls.

## 11. Release readiness

The current mobile product is suitable for a controlled beta once Supabase configuration and content are in place. Before a broader launch, prioritize completion-path consistency, real notifications or removal of the static screen, the intended OAuth decision, durable curated-pack progress, and the highest-value social paths.
