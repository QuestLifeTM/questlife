# Energy optimization validation

## Build controls

- `EXPO_PUBLIC_ENERGY_DIAGNOSTICS=1` enables bounded numeric counters in internal release builds. Read/reset through `readEnergyDiagnostics()` / `resetEnergyDiagnostics()` in `services/active-quest/energy-diagnostics`. Counters contain no coordinates or media. Payload character counts are estimates, not measured network bytes.
- `EXPO_PUBLIC_LOCATION_ENERGY_CANDIDATE=1` selects iOS High accuracy / 5 metres. Leave unset in normal builds. Existing Highest / 1 metre settings remain the default; automatic pausing remains disabled.
- No backend migration or production deployment is required.

## Implemented

Concurrent sync calls share one runner with a dirty follow-up. Successful payload acknowledgements suppress unchanged snapshot/media/activity/dismissal writes until restart. Failed payloads remain retryable. Automatic route and periodic journey triggers use capped jittered backoff. Stable IDs and local durable saves are unchanged.

iOS foreground persistence yields only after successful background task delivery in the same recording window; a five-second heartbeat expiry restores fallback. UI store reload notifications coalesce for one second. Completed route segments reuse simplified geometry. Camera review is virtualized and mounts only one selected video player; backgrounding removes selection.

## Still requires follow-up

- Physical-device baseline and optimized measurements have not been collected. Neither a 20% energy reduction nor a thermal improvement is established.
- Five-second recovery polling remains until native background notification coverage is verified. Live location still uses the existing context; splitting subscribers remains outstanding.
- Photo review currently uses original image URIs with virtualization; dedicated review thumbnails remain outstanding.
- Sync payload acknowledgements are bounded in-memory exact snapshots, not persistent per-row dirty revisions. Changed media/activity collections are still sent as a collection. Connectivity recovery currently relies on existing app-resume/periodic triggers; a dedicated connectivity listener remains outstanding.
- Diagnostics count logical sync payload characters rather than transport bytes and do not yet expose an internal UI/export action or general render counters.
- Android shares sync coalescing, payload skipping, route geometry caching and notification throttling. Background persistence ownership is currently iOS-only.

## Device protocol

Use current baseline and optimized release builds on the same unplugged phone after cooldown. Record model, OS, battery health, ambient conditions, brightness and network. Run each scenario at least three times: idle without quest; stationary recording; walking with map visible; walking with screen locked; pause/resume; weak signal; offline/reconnect; photo/video batch review. Compare Strava separately, not concurrently.

Use Xcode Instruments and device diagnostics for energy, CPU, memory, network and thermal state. Verify route continuity and measured-course distance alongside energy results. No new unexplained gaps; candidate accuracy may add at most two percentage points of error. Target 20% lower median energy in the problem scenario, with no material regressions elsewhere. Do not enable the candidate or publish a thermal-fix claim without these measurements.

Exercise sign-out/session replacement, late callbacks, full storage, failed uploads, partial batch saves, and completion while offline. Verify no duplicate rewards or lost committed captures. Check 375/768/1024/1440-width layouts and short landscape screens. Run `npm run app:typecheck`, `npm run app:build:web`, and the tracking/journey/journal plus energy-coordination tests.
