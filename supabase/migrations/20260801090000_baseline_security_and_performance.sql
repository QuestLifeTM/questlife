-- Baseline hardening for the clean QuestLife Supabase projects.
--
-- Keep this migration intentionally narrow: each change below is confirmed by
-- the Supabase advisors and the application query paths. Broader index and RPC
-- permission changes require measurement or a complete function-access audit.

-- Evaluate the authenticated user once per query instead of once per scanned
-- row. These tables are written frequently while an Active Quest is running.
drop policy if exists "Users manage their active quest snapshots" on public.quest_session_snapshots;
create policy "Users manage their active quest snapshots"
on public.quest_session_snapshots
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their active quest route" on public.quest_session_route_points;
create policy "Users manage their active quest route"
on public.quest_session_route_points
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their active quest media" on public.quest_session_media;
create policy "Users manage their active quest media"
on public.quest_session_media
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- The original party migration and the later completion-flow migration create
-- the same (party_id, created_at DESC) index under different names. Retain the
-- later, descriptive name and avoid duplicate write/storage overhead.
drop index if exists public.party_feed_party_idx;

-- The primary key starts with follower_id. Profile overviews also count and
-- list followers by following_id, so that direction needs its own covering
-- index. created_at supports newest-follower ordering without an extra sort.
create index if not exists profile_follows_following_created_idx
on public.profile_follows (following_id, created_at desc);
