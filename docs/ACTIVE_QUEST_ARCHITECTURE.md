# Active Quest Architecture

**Status:** Phases 1–5 implemented in the client; native device validation and migration deployment remain.

## Purpose

An active solo quest needs a durable home while it is happening. Today, QuestLife creates a `quest_sessions` record but leaves the user in the Lobby or quest detail flow, where the only next actions are completion or saving it for later. That loses the useful context created during a real-world quest: elapsed time, route, captured photos, and reflections.

This design adds an Active Quest subsystem for **solo quests started from Explore**. It deliberately excludes Party quest sessions from the first release. The session model and navigation boundary will allow Party support later without requiring a second screen design.

## Current flow

```text
Explore → Quest detail → start_quest_session RPC → quest_sessions(status = active)
                                           ↓
Lobby active card → Complete Quest / Save For Later
                                           ↓
complete_quest_v2 RPC → quest_completions → optional Log Your Lore
```

The current engine already provides a strong server-authoritative boundary:

- `quest_sessions` permits one active solo session per user.
- `QuestEngineProvider` fetches the active session through `get_quest_engine_state`.
- `complete_quest_v2` creates the completion and closes the active server session.
- `LogLoreFlow` persists the final reflection, rating, review, and uploaded photo URLs.

## Problem

The active record is not yet a live experience. It has no dedicated route, durable local state, live timing, route history, offline queue, photo queue, or in-progress journal draft. The Lobby card also exposes completion before users can capture the story of a quest.

## Proposed lifecycle

```text
startQuest (solo Explore)
  → create/confirm server quest_sessions row
  → create local active-session snapshot + outbox transactionally
  → route to /active-quest
  → request only the permissions needed for the feature the user invokes
  → record points/photos/draft locally first
  → batch sync pending data when connectivity permits
  → pause/resume without deleting data
  → end quest
  → flush local outbox, create completion, hand finished draft/media to Log Your Lore
  → close local snapshot only after the completion succeeds
```

### Session states

| Local state | Server `quest_sessions` state | Meaning |
| --- | --- | --- |
| `starting` | `active` once confirmed | Session shell is being hydrated. |
| `recording` | `active` | Timer and accepted GPS samples are recording. |
| `paused` | `active` | Data is retained; elapsed active time is frozen. |
| `recovering` | `active` | App relaunched or tracking is unavailable; no location is invented. |
| `ending` | `active` | Queues are flushed before completion. |
| `completed` | `completed` | Completion is durable; local data may be retained as a cache. |

`saved_for_later` and `abandoned` remain existing explicit exits. Neither should silently discard local files; the user must choose whether to retain or delete them in a later cleanup flow.

## Screen structure

The dedicated route is `/active-quest`, guarded by the presence of an active **non-Party** engine session.

```text
┌──────────────── live tab content ────────────────┐
│ Quest title                             Close     │  transparent header
│ Map · Album · Entry                                  │  transparent segmented switch
│                                                        │
│ Map: native map, accepted route, blue current dot      │
│ Album: two-column in-quest memory stream                │
│ Entry: Day N: Quest name, editable title and body       │
│                                                        │
├──────────── always-open anchored bottom sheet ─────┤
│ Duration              Photos              Distance │
│                 [Pause / Resume]  [Camera]          │
│ Paused only:           [End]                         │
└────────────────────────────────────────────────────┘
```

- Header and tab switch are transparent overlays and remain mounted across all tabs.
- The bottom sheet remains mounted and open across all tabs. It uses the existing QuestLife sheet/button geometry rather than copying the reference app's visual identity.
- The tab indicator follows the streak tab interaction pattern: one selected tab, a visible accent underline, 150–220 ms state transition, and a reduced-motion fallback.
- The route has no Party data assumptions. A future `sessionKind: "solo" | "party"` selector can choose an appropriate shell.

## State management and modules

The implementation keeps this domain boundary rather than placing tracking state in the generic quest engine:

```text
types/active-quest.ts                 domain types and serializable commands
services/active-quest/localStore.ts   SQLite schema, transactions, recovery
services/active-quest/sync.ts         idempotent server mirror replay
services/active-quest/tracking.ts     location registration and point filtering
services/active-quest/media.ts        durable copy, upload queue, thumbnails
contexts/ActiveQuestContext.tsx       UI-facing session state and commands
screens/active-quest-screen.tsx       screen composition only
components/active-quest/*             tab content and controls
app/active-quest.tsx                  route adapter
```

`QuestEngineProvider` stays responsible for server quest eligibility, existing active-session state, and final completion. `ActiveQuestProvider` owns only the local live record keyed by `quest_sessions.id`.

## Data model

### Local SQLite (source of truth while offline)

| Object | Key fields | Notes |
| --- | --- | --- |
| `active_quest_sessions` | `session_id`, `quest_id`, `recording_state`, `started_at`, `active_since`, `paused_at`, `active_duration_ms`, `distance_meters`, `entry_title`, `entry_body`, `updated_at` | One local row per server session. |
| `active_quest_route_points` | `id`, `session_id`, `captured_at`, `latitude`, `longitude`, `accuracy_m`, `speed_mps`, `altitude_m`, `accepted` | Stores raw accepted points; never derive movement from missing data. |
| `active_quest_media` | `id`, `session_id`, `local_uri`, `taken_at`, `width`, `height`, `upload_state`, `remote_path`, `remote_url` | Local file is durable before queueing upload. |

### Supabase additions (Phase 3+)

Use a single migration with clear ownership and RLS:

| Object | Purpose |
| --- | --- |
| `quest_session_snapshots` | Latest server recoverable state: pause/resume, cumulative distance/duration, last accepted point, draft revision. |
| `quest_session_route_points` | Ordered, user-owned route points. Insert idempotently by client UUID. |
| `quest_session_media` | Media metadata and upload state; media binary remains in a session-scoped Storage path. |

Each table references `quest_sessions(id)` and uses `user_id` policies matching the existing quest engine. Do not alter the semantics of `quest_completions`; finalization will copy the selected draft and media into the existing completion / journal path only after all required local work is safely recorded.

## Persistence and sync strategy

1. **Local first:** every state transition, accepted location point, draft update, and captured photo metadata commits locally before network work begins.
2. **Server mirror:** the client replays the local snapshot, route, and uploaded-media metadata to Supabase after local mutations and on active-session restore. Network failures are ignored locally and retried on the next mutation or restore.
3. **Idempotency:** route/media mutations use stable local IDs combined with the session ID. Retrying after a crash upserts rather than creates duplicate route segments or media rows.
4. **Recovery:** on provider startup, load SQLite first, then reconcile with `get_quest_engine_state`. If the server session is still active, restore the local session. If local data exists but the server session is no longer active, preserve it as recoverable data and present an explicit resolution path.
5. **Completion:** finalization stops tracking, persists a final local snapshot, drains essential mutations, calls the existing completion flow, and only then marks the local session completed. If the network call fails, the app stays in `ending`/`recovering` with a retry affordance.

## Location and map tracking

### Chosen platform approach

- **Tracking:** `expo-location` + `expo-task-manager`, with the background task defined at module top level.
- **Map rendering:** `react-native-maps`, installed through `npx expo install react-native-maps`, for a mature cross-platform map, polyline, and marker surface. Expo Maps is intentionally not selected for this feature because Expo documents it as alpha, with frequent breaking changes and different platform providers. A stable map surface is more important than a new API for a durable tracking feature.
- **Build requirement:** background location is not supported in Expo Go; this needs a development build and eventual production configuration.

### Point acceptance rules

The tracker records the raw sample only when all of these pass:

- coordinates are finite and timestamped;
- horizontal accuracy is within a configurable threshold (currently 35 m; rejected samples are not drawn);
- the sample is not older than the last accepted point;
- calculated implied speed is plausible for the selected quest type; impossible jumps are rejected;
- minimal distance/time movement thresholds prevent stationary GPS jitter from creating route noise.

Distance uses a Haversine calculation between consecutive accepted points. The UI route polyline is optionally simplified for rendering only; source points remain unchanged for accurate recovery. A gap does not create a synthetic segment. When GPS is unavailable, the UI changes to `recovering`, keeps the last valid route and distance, and explains that location is temporarily unavailable.

### Background / interruption limits

Background tracking can continue while the app is backgrounded or the phone is locked only with foreground + background location permission and an installed development/production build. The operating systems can still terminate work; Android vendor behavior differs, and a force-closed app cannot be guaranteed to continue tracking. On relaunch, the persisted local session and last valid point are restored and the tracker re-registers when permissions permit. The product must never claim uninterrupted tracking when the system did not provide points.

## Media handling

1. Request camera permission only after the user taps **Take Photo**.
2. Capture through `expo-camera`, then copy the temporary camera URI into the app's durable document directory before closing the camera. Camera capture URIs are temporary on native platforms.
3. Insert a local `active_quest_media` row and enqueue upload before showing confirmation.
4. Show a two-second confirmation state on the camera control, then restore the normal camera icon. The Album reads from local records immediately.
5. Upload sequentially to a deterministic session-scoped Supabase Storage path. Keep the local original until remote upload is confirmed and a safe retention policy runs.
6. Load album thumbnails lazily (two-column virtualization) and release full-resolution images outside the visible area.

Saving a copy to the user's system Photos library is an opt-in secondary action, not a prerequisite for the Active Quest record.

## Journal draft behavior

- Default title: `Day <N>: <Quest name>`.
- Title and body are editable in the Entry tab.
- Save to SQLite on a 750–1,000 ms debounce after editing stops, and immediately on background / pause / exit transitions.
- Sync draft revisions every 5–10 seconds when there are changes, not per keystroke.
- On restart, display the local draft immediately and reconcile the newest revision with the server mirror.
- Completion passes the local draft into the final journal / Log Your Lore handoff without forcing the user to reconstruct it.

## Permissions and recovery UX

| Feature | Permission | Denied behavior |
| --- | --- | --- |
| Map / route | Foreground location; background location only when the user enables background tracking | Keep the quest active; show the Map's unavailable state and still track time, photos, and entry. |
| Background route | Background location / iOS Always | Explain locked-screen limitation; offer Settings link without blocking the quest. |
| Camera | Camera | Keep the quest active; photo action explains how to enable camera. |
| Save to device library | Media library add-only access | Keep the local QuestLife photo even if saving to Photos is declined. |

All permission explanations appear before a system request and identify the immediate benefit. A denial is a recoverable feature state, not an error that ends the quest.

## Error and offline strategy

- Network unavailable: continue local recording and show a quiet `Saved on this device` status.
- Upload failure: retain the original local file and retry via outbox; do not silently remove the thumbnail.
- GPS dropout: preserve last confirmed distance/route, show `Location paused`, and resume only with validated samples.
- App crash/restart: restore local state first, reconcile server second, then resume the selected active/paused state.
- Server conflict: prefer the server when it has a completed/abandoned session; retain local data for explicit recovery instead of discarding it.

## Delivery phases

1. **Architecture (this phase):** document lifecycle, data objects, native package decision, recovery constraints, and UI structure.
2. **Shell and navigation:** completed — guarded route, transparent header/tabs, always-open sheet, and Lobby/Explore entry points now open `View Active Quest`.
3. **Durable session + map:** completed — SQLite local state, module-scope task, point filtering, actual map polyline/current point, and a Supabase mirror migration are included.
4. **Camera + album:** completed — native camera, durable file copy, deferred upload, two-column local album, capture confirmation, and retry-on-restore are included.
5. **Entry + completion:** completed — 750 ms draft autosave/recovery, pause/resume state, and draft/uploaded media handoff to Log Your Lore are included.
6. **Reliability and polish:** pending device validation — locked-screen, interruption, offline, denied-permission, relaunch, and end-to-end device tests; defer ornamental animation until this is proven.

## Required manual setup before device validation

```bash
cd App
npx expo install expo-location expo-task-manager expo-sqlite expo-file-system expo-media-library react-native-maps
```

`app.json` is configured with location, camera, media-library, and background-location plugins. Build and test with an Expo development build; Expo Go cannot validate background location. Apply `supabase/migrations/20260719090000_active_quest_records.sql` before enabling server synchronization. Configure Android Maps credentials for release builds if the chosen Android maps provider requires them.

## Phase 1 acceptance checklist

- [x] Current start / active / completion flow mapped.
- [x] Solo scope separated from Party sessions.
- [x] Live screen hierarchy defined.
- [x] Durable local-first objects and sync boundaries defined.
- [x] Native map and tracking choices documented with operational limits.
- [x] Permission, offline, crash, and GPS-dropout behavior defined.

## Implementation validation checklist

- [x] Local session, route, media, and draft persistence use SQLite.
- [x] Route points render with a native map polyline and current-location marker.
- [x] Camera files are copied from temporary capture storage before upload.
- [x] Journal draft and uploaded photo URLs pass into the existing completion flow.
- [x] TypeScript typecheck passes without launching Expo visually.
- [ ] Supabase migration applied to the target project.
- [ ] Development-build test for foreground/background location, permissions, interruption, and crash recovery.
