-- These tables are reached directly by the Admin dashboard. Their RLS
-- policies already define which rows each authenticated user may access; the
-- explicit grants below let Postgres evaluate those policies. Anonymous users
-- retain no access.
revoke all on table public.quests from anon, authenticated;
grant select on table public.quests to authenticated;

revoke all on table public.adventure_packs from anon, authenticated;
grant select on table public.adventure_packs to authenticated;

revoke all on table public.adventure_pack_quests from anon, authenticated;
grant select on table public.adventure_pack_quests to authenticated;

revoke all on table public.featured_quest_batches from anon, authenticated;
grant select on table public.featured_quest_batches to authenticated;

revoke all on table public.featured_batch_quests from anon, authenticated;
grant select on table public.featured_batch_quests to authenticated;

revoke all on table public.admin_notifications from anon, authenticated;
grant select on table public.admin_notifications to authenticated;

revoke all on table public.admin_invites from anon, authenticated;
grant select on table public.admin_invites to authenticated;

revoke all on table public.saved_quests from anon, authenticated;
grant select on table public.saved_quests to authenticated;

revoke all on table public.quest_completions from anon, authenticated;
grant select on table public.quest_completions to authenticated;
