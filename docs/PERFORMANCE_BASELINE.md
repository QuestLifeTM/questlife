# QuestLife performance baseline

Use this checklist before and after a performance change. Test a release-like
development build on the same physical iOS and Android devices, with the same
account and a comparable network connection.

## Capture

1. Cold launch and warm launch: record time to the Lobby becoming interactive.
2. Navigate through Explore, Social feed, Journal, Active Quest, and Profile.
3. On each screen, record JS/UI FPS and JS heap from Expo's Performance Monitor.
4. In React Native DevTools, capture a profile while scrolling the Social feed
   and Journal, switching feed scope, and starting an active quest.
5. Record Network requests for launch, first Social visit, and first Journal
   visit. Note duplicate requests and slow RPCs.

## Acceptance rule

Keep an optimization only when it improves the measured target flow or removes
a verified redundant request without changing user-visible behavior. Recheck
authentication transitions, offline errors, realtime updates, image loading,
and active-quest route tracking after every change.

## Database follow-up

Do not add an index from client code inspection alone. Identify slow calls in
Supabase Query Performance, inspect their plan with `EXPLAIN` in a non-production
environment, and validate a proposed index with Index Advisor before creating a
migration.
