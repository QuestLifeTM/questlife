# Strava location research and QuestLife implementation plan

Research date: October 27, 2026. Status: proposal only; no application implementation, dependency installation, database change, or deployment.

The recommendation is to improve QuestLife's recorder and distance model first, then improve its map presentation. Keep the current native map library initially. A Mapbox migration can provide consistent styling and advanced map features, but it does not itself make recorded locations or miles more accurate.

This report distinguishes **documented Strava behavior**, **findings in QuestLife's current source**, and **proposed engineering choices**. No instrumented Strava field recordings were performed. Strava does not publicly document enough detail to reproduce its private recorder exactly. Sampling rates, filter coefficients, sensor fusion, mobile map SDK versions, camera zoom constants, and all internal heuristics remain unverified.

## 1. What Strava actually uses

| Layer | Evidence and implications |
|---|---|
| Location measurement | Strava's troubleshooting documentation identifies the phone's GPS hardware as the source. The map image is not the location sensor. Device hardware, reception, and operating-system behavior limit accuracy. [Strava iOS GPS](https://support.strava.com/en-us/articles/15402040-troubleshooting-ios-gps-issues), [Android GPS](https://support.strava.com/en-us/articles/15402062-troubleshooting-android-gps-issues). |
| Basemap | Strava identifies Mapbox as the provider of static and interactive feed/activity maps and OpenStreetMap as a source for roads, trails, parks, and places. It also identifies selected OSM-based thumbnails; do not assume every surface has an identical renderer. [About Strava Maps](https://support.strava.com/en-us/articles/15402176-about-strava-maps). |
| Satellite imagery | Its documentation names DigitalGlobe, NASA, and Mapbox. This is the wording of Strava's documentation, not an independently verified current imagery supply chain. The same page documents Standard and Satellite website activity views. [About Strava Maps](https://support.strava.com/en-us/articles/15402176-about-strava-maps). |
| Route discovery/planning | Strava combines OSM with its own popularity/heat data and other sources. Planned routes and the underlying map can disagree because data updates differ. This does not establish that recorded workouts are automatically snapped to roads. [About Strava Maps](https://support.strava.com/en-us/articles/15402176-about-strava-maps). |
| Imported workouts | Strava can receive recordings from other devices. Its FIT parsing generally preserves the distance stream; its explanation says non-FIT inputs such as GPX are recalculated from coordinates. Therefore a Garmin workout displayed in Strava does not reveal Strava's phone recorder settings. [Strava's distance parsing explanation](https://stories.strava.com/articles/explaining-the-strava-tax). |

For QuestLife specifically, the installed `expo-location` source uses `CLLocationManager` on iOS and Google Play Services' `FusedLocationProviderClient` on Android. These were verified locally in `node_modules/expo-location/ios/Providers/BaseLocationProvider.swift` and `android/src/main/java/expo/modules/location/LocationModule.kt`. They are appropriate native foundations; this is not evidence of Strava's precise internal API choices.

## 2. Recording frequency, path updates, and real-world behavior

There are four different clocks: sensor acquisition, delivery of samples to the app, redraw of the visible map, and upload to the server. They should be independently controlled. A smooth marker animation can happen between measurements without producing additional measured distance.

**No official source reviewed establishes a universal “Strava records every one second” rule.** Exact intervals can vary by recording device and operating conditions. Strava does document Beacon updates at approximately 15 seconds, subject to cellular service. That is the recipient's location-sharing refresh, not proof of a 15-second GPS sampling interval. [Strava Beacon](https://support.strava.com/en-us/articles/15401829-strava-beacon).

| Situation | What the research supports | Proposed QuestLife response |
|---|---|---|
| Starting outdoors | Strava recommends acquiring a good GPS lock before setting off. | Show “Acquiring GPS,” accuracy, and readiness; let the quest timer begin if desired while clearly indicating that the route is not yet reliable. |
| Walking/running through turns | Sparse observations miss intermediate geometry. | Request frequent samples and preserve turn points; evaluate walking as carefully as running. |
| Stationary break | GPS noise can look like travel. Strava running auto-pause uses accelerometer motion; cycling auto-pause uses GPS movement. | Use a movement state with hysteresis; do not add every small GPS movement to miles. Keep auto-pause optional for exploration quests. |
| App minimized or screen locked | OS background execution is distinct from foreground observation. | Continue a native background task, persist on delivery, and measure actual callback gaps. |
| No internet | Strava distinguishes GPS recording from map/network usage. | Keep recording locally; defer uploads. A missing basemap must not stop recording. |
| Tunnel, indoor stop, urban canyon | Strava describes missing samples and GPS bounce; its documentation says missing path data cannot be reconstructed as fact. | Mark an uncertain gap, reacquire, and begin a new measured segment. |
| Same street traversed again | Spatial position alone cannot identify duplicate measurements. | Preserve chronological traversal, including laps and backtracking. Deduplicate delivery events, never whole geographic locations. |
| Saving the activity | Strava uploads and processes the activity after recording. | Finalize local metrics immediately; sync independently and expose any later correction. |

Sources for these distinctions: [Strava recording](https://support.strava.com/en-us/articles/15402137-how-do-i-record-an-activity-on-strava), [Auto-Pause](https://support.strava.com/en-us/articles/15402141-auto-pause), [Bad GPS Data](https://support.strava.com/en-us/articles/15402181-bad-gps-data).

In QuestLife's Expo version, `timeInterval` is Android-only; it is not an iOS sampling timer. Requested settings do not guarantee actual delivery timing. Force termination is also different from locking the screen: Expo documents that background location stops when the user terminates the app. [Expo SDK 58 Location](https://docs.expo.dev/versions/v58.0.0/sdk/location/), [Google LocationRequest](https://developers.google.com/android/reference/com/google/android/gms/location/LocationRequest).

## 3. How distance stays accurate—and how it goes wrong

Strava's phone app accumulates GPS-derived distance during recording. Its server can calculate distance from coordinates when a usable distance stream is absent, and offers a correction action. Its documentation describes connecting successive coordinates, ignoring obvious outliers, and treating GPS distance as horizontal rather than adding noisy vertical movement. It does not publish the complete filtering algorithm. [How Distance Is Calculated](https://support.strava.com/en-us/articles/15401893-how-distance-is-calculated).

Three independent error sources matter:

1. **Noise overcounts:** random deviations create a zigzag longer than the true path. Research demonstrates this systematic overestimate, especially when interpolation error is small. Increasing sample frequency alone is not a cure. [Ranacher et al., Why GPS makes distances bigger than they are](https://arxiv.org/abs/1504.04504).
2. **Sparse samples undercount:** a route with two 10-meter perpendicular legs is 20 meters, but connecting only the endpoints measures about 14.14 meters. This is a geometry example, not a measured Strava error.
3. **Aggressive smoothing undercounts:** averaging coordinates rounds corners, delays the route endpoint, and can erase small loops. A visually cleaner route is not necessarily a better measurement.

Distance, elapsed time, active timer time, and moving time must be separate. Strava documents different handling of running pause events and GPS-derived moving time. Pace comparisons become misleading if the denominator differs. [Moving Time, Speed, and Pace](https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations).

Strava's displayed distance can also differ simply because it rounds down while retaining the underlying meters. QuestLife should retain full-precision meters and use one consistent presentation rule; copying truncation is not a GPS improvement. [Explaining the Strava Tax](https://stories.strava.com/articles/explaining-the-strava-tax).

**Algorithm conclusions:** outlier rejection and post-recording processing are documented. Claims that Strava specifically uses a Kalman filter, Ramer–Douglas–Peucker, Hidden Markov Models, or a particular road-snapping API for its recorded activities are not established by the reviewed sources. Those are candidate techniques, not verified Strava internals.

## 4. What QuestLife currently does

Source inspected in the working tree, including existing uncommitted edits to the active-quest screen. Those edits were not changed. These are source-level findings, not results from a physical-device run.

| Component | Finding | Consequence |
|---|---|---|
| `App/contexts/ActiveQuestContext.tsx:117` | Foreground watcher requests Highest accuracy, 1-meter distance interval, and 1,000-ms Android interval. | The foreground path may be denser than the locked-screen path. |
| `App/services/active-quest/tracking.ts:8` | Background task requests Highest, 5 meters, and 5,000 ms. | Screen state can change requested sampling density. |
| `location-quality-filter.ts` | Accuracy cutoff 45 m; movement floor 3–8 m; speed limit 15 m/s; readings older than 60 seconds rejected. | Short turns/slow movement can be lost; valid delayed batches can be discarded; one speed profile does not fit every quest. Missing and negative accuracy need explicit treatment. |
| `location-smoothing.ts` and `local-store.ts:288` | Accepted coordinates are exponentially smoothed before storage, and distance is summed between those smoothed coordinates. Original coordinates are not retained in this path. | Cannot reliably replay or correct the original samples; corner cutting affects miles. Simply summing all raw points instead would introduce noise inflation. |
| `route-filter.ts` | Haversine distance; RDP simplification at 2.5 m for rendering. | Rendering simplification is already separated from distance, which is useful. The earlier smoothing stage still affects both. |
| `ActiveQuestContext.tsx:216` | Pause explicitly pauses quest time while continuing route recording. | This is an existing product choice. Distance continues while paused; changing it silently would change QuestLife's meaning. |
| `local-store.ts` | Every mutation copies/writes the JSON store; accepted samples rebuild the simplified route. | More frequent sampling requires a storage/performance redesign. Rejected samples also pass through the mutation persistence path. |
| `sync.ts` | Eligible point events trigger full-record upserts with a 30-second throttle. | This is not a guaranteed recurring timer; long sessions resend a growing history. |
| Live map | Foreground coordinates update the live marker before the route filter accepts them. Native user-location display is also enabled. | Marker and saved line can disagree; there can be multiple position indicators with different provenance. |
| Camera | Main map uses 0.012-degree spans after route points, 0.018 initially; 600-ms camera animations; sheet offset is a fixed fraction. | Latitude spans are approximately 1.33 km and 2 km before provider/aspect adjustments—broad for walking. Following can overwrite the user's chosen scale. |
| Map styles | Main view standard; compact route card satellite; native wrapper exports `react-native-maps`. | Default native providers are Apple Maps on iOS and Google Maps on Android. Styles are not necessarily identical. |
| Web | SVG route sketch independently scales latitude/longitude; outbound OSM link. | No embedded street basemap; independent axis scaling can distort route shape. |

Native provider behavior is documented in [Expo's react-native-maps guide](https://docs.expo.dev/versions/v58.0.0/sdk/map-view/). The Android source manifest inspected lacks a `com.google.android.geo.API_KEY` entry, and `App/app.json` does not configure a Maps key. A build-time injection could exist elsewhere, so verify the merged release manifest before declaring the installed app misconfigured.

## 5. Proposed recording and measurement design

All numerical settings below are **initial experiment values**, not Strava constants or proven accuracy guarantees.

```text
Native location callbacks
        ↓
Durable original samples + session events
        ↓
Timestamp ordering / delivery deduplication / validation
        ↓
Movement and confidence estimator
        ├── Measurement segments → full-precision meters
        ├── Display segments → zoom-aware simplification → map
        └── Outbox → incremental sync → reproducible final processing
```

**A. One canonical recording pipeline.** Keep the background-capable task as the native recording authority. The UI subscribes to its output; avoid two competing metric writers. If an additional foreground watcher is needed for responsiveness, route it through explicit event deduplication and source tagging. Browser foreground recording remains a separate supported mode.

**B. Sampling profile.** Start field evaluation with Highest accuracy, a 1-second requested Android interval, and a 1-meter distance interval for walking/running, in foreground and background. On iOS use the supported accuracy/distance/activity settings and observe delivery timing. Do not promise 1 Hz there. Test a 0-meter distance filter as an alternate if callbacks are too sparse for stationary detection. Choose the least expensive profile that passes the field tests.

Persist every valid delivered observation, including stationary samples useful for classification. Keep rendering to roughly one update per second while visible; interpolate only the marker animation, not distance. Batch network sync around 30–60 seconds when execution/connectivity permits and on important state changes. This batching interval is unrelated to recording accuracy.

**C. Preserve evidence.** Store sample ID, session/device/recorder ID, captured time, received time, coordinates, reported accuracy, available speed/course/altitude, callback source, and quality decision. Retain original coordinates separately from estimated ones. Reject nonfinite/out-of-range coordinates, invalid timestamps, duplicate events, and invalid accuracy; unknown accuracy should be low confidence, never silently “perfect.” Missing/negative speed is unknown rather than reverse movement.

Order each batch by captured time. Check the session's actual recording windows and recorder identity. Distinguish an old cached starting fix from a valid delayed batch. Late samples after the already-finalized cursor can be stored for deterministic replay without corrupting live chronological state. Never discard all samples simply because delivery is more than 60 seconds late.

**D. Movement and quality.** Use acquiring, moving, stationary, weak-signal, and gap states. Start evaluation with 3 credible fixes for readiness, a target reported accuracy around 15–20 m, and several seconds of consistent evidence to enter/exit stationary mode. These values need separate walking/running validation. GPS speed, displacement over a time window, and optional motion evidence should agree; absence of motion permission must not break basic tracking.

Use an activity-aware speed plausibility check plus accuracy and acceleration consistency, not the current universal 15 m/s cutoff alone. Preserve short turns and slow exploration. A single outlier must not move the estimator anchor; sustained reacquisition must eventually be allowed to establish a new segment so one bad first fix cannot trap recording indefinitely.

**E. Distance estimator.** Compare a conservative window-based estimator against an accuracy-weighted constant-velocity Kalman candidate in local meter coordinates. Evaluate correlated GPS noise; do not treat the device's accuracy radius as an exact independent Gaussian variance. Kalman filtering is a candidate to benchmark, not a default guarantee. Preserve turns by adapting process noise and using heading evidence only when reliable.

Sum horizontal geodesic distances along the chosen measurement trajectory within valid continuous segments. The existing Haversine helper is adequate for the initial comparison; clamp numerical bounds. Do not calculate miles from the simplified display line or add artificial points created for animation. Keep `distanceMeters` as a full-precision accumulator and convert using 1 mile = 1609.344 meters only for presentation.

**F. Gaps and repeated traversals.** Start evaluating a visible gap after roughly 10–15 seconds without credible fixes, adjusted for delivery batching and movement evidence. A gap is not automatically proof of stationary time. Break the measured polyline across unobserved travel; any optional connector must be dashed and explicitly estimated, excluded from measured mileage. On reacquisition reset filter continuity appropriately.

Preserve A→B→A and repeated laps as separate time-ordered travel. A line overlapping itself is correct; do not offset it geographically to make laps visible. Optional arrows, lap selection, or time-based coloring can communicate repeated traversal. RDP affects only the displayed geometry, never stored traversal or distance.

**G. Quest-specific pause semantics.** Preserve the current “pause quest time, continue journey” behavior initially. Make the label explicit. Store total journey distance and active-quest distance separately if both are useful; do not substitute one for the other. Provide a distinct “Stop route recording” action. That action ends a recording window, and later resumption starts a new segment. Auto-pause for the quest timer should remain off by default for photo-taking, wandering, and slow exploration.

**H. Storage, recovery, and finalization.** Move native observations/events to transactional SQLite with an outbox, using the existing device abstraction and IndexedDB-equivalent behavior on web. Enforce sample identity and single-recorder ownership; a JS mutation queue alone is not a cross-process guarantee. Flush batches durably on delivery and flush pending records at pause/end where applicable. Recover the recorder state after restart and flag the unobserved interval.

Add algorithm version, distance source, metric revision, and quality summary to snapshots. A final replay must use the same events and rules as live calculation. If a correction changes the result, retain the prior value and explain it; do not silently rewrite completed quest rewards. Existing saved smoothed routes cannot become raw data retroactively—mark legacy records accordingly.

Keep the existing Supabase backend and owner access boundaries. Sync only unacknowledged sample batches with stable device/session/sequence keys. Download summaries/render geometry for normal viewing and full samples only for explicit analysis. Review actual quotas at implementation time rather than assuming historical plan limits in repository notes remain current. No new backend service or PostGIS requirement is justified for basic recording.

## 6. Map presentation and zoom plan

Strava publicly documents a map/stats recording interface and an accuracy halo around the user's position. I found no published default numeric zoom or camera-follow algorithm. Exact comparison requires observing a particular app version, device, screen size, and activity type; this report does not claim such observations. [Strava recording UI](https://support.strava.com/en-us/articles/15402137-how-do-i-record-an-activity-on-strava).

Recommended QuestLife behavior:

| State | Proposed view |
|---|---|
| Ready / walking | Flat standard street/trail map; roughly 300–600 m visible width on a phone, after accounting for controls. |
| Running | Roughly 400–800 m visible width; retain bends and upcoming intersections. |
| Cycling, if supported | Roughly 800–1,600 m width, with speed-based look-ahead only after validating stability. |
| Manual browsing | A gesture disengages following; retain user-selected zoom. A clear Recenter button restores following. |
| Quest completed | Fit the complete route with padding for header, bottom sheet, markers, and map attribution. Clamp zoom for tiny/stationary activities. |
| Compact card | Fit the route for a recap; follow the user only when the card explicitly represents live position. |

Use ground coverage and actual viewport size as the specification. As an orientation example, a 390-pixel Mapbox GL viewport around latitude 40° covers roughly 714 m at zoom 15 and 357 m at zoom 16 under its 512-pixel tile convention. A 256-pixel convention differs by a zoom level. Device scale, pitch, and padding matter, so “zoom 16 everywhere” is not a portable specification. [Mapbox zoom levels and tile-size conventions](https://docs.mapbox.com/help/glossary/zoom-level/).

Use one primary location dot driven by the validated live estimate, a meter-based accuracy circle, a clear route endpoint when distinct, and a weak-signal indicator. A rejected fix should not swing the camera. Animate camera movement around 300–600 ms, coalesce updates, and avoid overlapping animations. Preserve the user's zoom rather than resetting a fixed region on every point. Use actual map padding for the sheet instead of a fixed latitude offset.

Keep a 4–6 logical-pixel route stroke with rounded joins and a contrasting casing when necessary. Standard street/trail styling should be default; satellite/hybrid is an optional layer. Keep map labels and attribution readable. Use existing responsive layout helpers across 375, 768, 1024, and 1440 widths. Replace the web SVG with a true map renderer if web street context is part of this release.

## 7. Street finder, Street View, road snapping, and providers

These are different features and require different services:

| Feature | Needed for accurate recording? | Setup |
|---|---|---|
| Street/trail basemap | Useful for display, not the measurement source | Existing native maps; configure Google Maps on Android. Web needs a renderer and tile/provider arrangement. |
| Street/place finder | No | Optional search/geocoding provider; query on user input, not every GPS point. |
| Current street name | No | Optional reverse geocoding with caching and movement-based throttling. |
| Street View panorama | No | Separate imagery/viewer integration. It does not improve the GPS trace or mileage. |
| Walking directions to a checkpoint | No, separate navigation feature | Pedestrian routing provider and access rules; show planned route distinctly from traveled route. |
| Road/path snapping | No | Optional map matching after capture; preserve the original path and measured distance. |
| Offline basemap | No for GPS capture; yes for guaranteed map visibility offline | Provider-supported offline downloads and storage/lifecycle policy. |
| Strava API | No | Not required to implement any core recording behavior described here. |

Map matching can choose the wrong parallel road, sidewalk, bridge, or trail. Hidden Markov map matching considers sequences and network continuity rather than blindly choosing the nearest road; it is a useful optional approach, but not proof of Strava's implementation. [Newson and Krumm research paper](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/12/map-matching-ACM-GIS-camera-ready.pdf).

Mapbox's API supports walking/cycling profiles, confidence outputs, and a maximum of 100 coordinates per ordinary request. Its documentation requires results to be displayed on a Mapbox map. That restriction matters: do not plan to overlay those matched results on the existing Apple/Google renderer without a compliant arrangement. If adopted later, batch with overlap, reject low-confidence matches, preserve off-road movement, and keep matched distance labeled as an estimate. [Mapbox Map Matching API](https://docs.mapbox.com/api/navigation/map-matching/).

**Provider decision:** retain `react-native-maps` for the first native release of improved tracking. Consider Mapbox across native and web if consistent branded maps, terrain, offline regions, or its map matching become concrete requirements. A React Native migration needs compatibility validation with Expo 58 / React Native 0.88, tokens, native configuration, and rebuilt apps; the wrapper documentation is version-scoped and is not proof of compatibility with this exact project. [RNMapbox installation](https://rnmapbox.github.io/docs/install).

## 8. What must be set up before implementation/testing

1. **Physical development builds:** one iPhone and at least two Android device families for background testing. The project already includes native directories, `expo-dev-client`, location/task-manager, SQLite, and an EAS project association. Simulator paths help deterministic testing but cannot establish real GPS accuracy.
2. **Native permissions/build configuration:** verify precise location, iOS background capability and runtime permission state, and Android location foreground service/notification behavior in the actual built binaries. Background location configuration already exists in source. Native changes require a fresh build; do not assume an OTA update adds capabilities. [Expo location setup](https://docs.expo.dev/versions/v58.0.0/sdk/location/).
3. **Android map credentials:** verify or create a Google Cloud project with billing and Maps SDK for Android enabled. Restrict the key to `app.myquestlife.questlife` and correct development/release signing fingerprints. Verify the merged manifest. Existing default Apple Maps rendering does not require a Google Maps key. [Google Maps Android setup](https://developers.google.com/maps/documentation/android-sdk/get-api-key), [Expo maps](https://docs.expo.dev/versions/v58.0.0/sdk/map-view/).
4. **Optional Mapbox account:** only if the expanded map-provider scope is chosen. Configure public runtime credentials, appropriate build credentials if the selected SDK requires them, style IDs, platform restrictions where supported, usage alerts, and attribution. Keep privileged tokens out of the app bundle.
5. **Database migration in development:** add raw observation/event support, durable sync identity, processing metadata, and access rules; test ownership and deletion behavior before production promotion. Keep precise tracks private by default and exclude raw coordinates from ordinary error logs.
6. **Product defaults:** walking/exploration first; timer pause keeps journey recording; separate full stop; no automatic road snapping; standard street map default. These are proposed defaults, not blockers requiring an immediate decision.
7. **Test routes and baselines:** establish measured open-sky routes, corners, repeated loops, backtracking, stationary periods, poor reception, and locked-screen sessions. Use known course distances as ground truth where available; Strava is a comparator, not the authority for true distance.

No Street View subscription, Strava partnership, custom satellite service, or paid location-tracking SDK is required to begin this plan. Provider usage costs should be estimated from actual expected map loads, users, offline downloads, and optional API requests before committing to a migration.

## 9. Implementation order and acceptance tests

| Phase | Work | Completion evidence |
|---|---|---|
| 1. Baseline | Add opt-in recording diagnostics and a replay/export harness; document pause semantics. | Foreground/background timing, accuracy distribution, rejected samples, gaps, battery baseline, and three repeated routes captured. |
| 2. Durable data | Original samples, event log, transactional storage, outbox, recorder identity, recovery, and migration. | Duplicate/reordered batches do not double count; crash/restart loses no acknowledged samples; owner isolation holds. |
| 3. Measurement | Unified profiles, quality/movement state, gap rules, estimator comparison, consistent miles. | Replay and field criteria below pass; no corner/loop regression. |
| 4. Presentation | Accuracy halo, one live estimate, adaptive camera, gesture preservation, route overview, map layers, optional web basemap. | Screen-size review; route endpoints and controls remain visible; map failure does not interrupt recording. |
| 5. Sync/finalize | Incremental uploads, versioned metrics, deterministic final replay, completion recovery. | Airplane-mode activity syncs once; retries remain idempotent; completed metrics are reproducible. |
| 6. Optional scope | Place search, checkpoint navigation, Mapbox migration, offline maps, or matching. | Separate product need, compatibility, provider terms, and cost validated. |

Proposed release criteria—not claims about current performance:

- Open-sky measured 1–5 km routes: median absolute distance error at most 2% across a declared device/route set, with individual error reported rather than hidden by averaging. Aim for no more than 3% on any open-sky validation run; investigate outliers.
- Repeatability: at least three repetitions per core route and phone; report range and standard deviation, not only a single good run.
- Stationary drift: target no more than 10 m accumulated in a five-minute open-sky stop; validate that the same filter still counts slow walking.
- Turns/loops: no systematic shortcuts across measured right-angle turns; two laps count twice; A→B→A remains two legs.
- Background: 60–90-minute screen-locked sessions on physical devices; no unexplained continuous-recording gaps beyond the chosen threshold. Force-stop tests must produce honest recovery/gap state, not pretend continuity.
- Noise/gaps: simulated jumps, negative/missing accuracy, delayed/out-of-order batches, tunnels, and GPS recovery cannot add giant phantom distances or permanently block reacquisition.
- Timing semantics: manual timer pause, recording stop, automatic stationary detection, and quest completion remain distinct in both metrics and UI.
- Deterministic replay: identical originals/events/algorithm version produce identical totals; zoom, line simplification, marker animation, and provider changes leave distance unchanged.
- Battery/performance: measure screen-on and screen-off consumption separately on matched phones. Choose the recording profile only after comparing accuracy with battery cost; do not promise a universal battery percentage.
- Comparison procedure: record the same course with QuestLife and Strava, document device placement/OS/settings, alternate runs, and test both simultaneous and independent recording because shared OS location activity can alter results. Export time-stamped tracks to compare observed intervals; exported spacing does not prove the internal sensor frequency.
- Regression checks during implementation: meaningful pure replay tests, owner/sync integration tests, native device validation, and repository-required `npm run app:typecheck` / `npm run app:build:web`. No implementation tests were run for this research-only change.

The first release should deliver reliable original capture, reproducible miles, clear gap handling, and a readable following map. Additional map services should be added only for a specific user-facing feature.
