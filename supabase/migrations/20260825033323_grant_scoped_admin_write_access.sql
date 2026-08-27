-- Explicit Data API privileges for Admin client writes. RLS remains enabled on
-- every table below and its existing policies decide which authenticated users
-- can perform each operation; these grants only allow Postgres to evaluate
-- those policies. Anonymous users remain excluded.

revoke all on table public.quests from anon, authenticated;
grant select, insert, update, delete on table public.quests to authenticated;

revoke all on table public.adventure_packs from anon, authenticated;
grant select, insert, update, delete on table public.adventure_packs to authenticated;

revoke all on table public.adventure_pack_quests from anon, authenticated;
grant select, insert, delete on table public.adventure_pack_quests to authenticated;

revoke all on table public.featured_quest_batches from anon, authenticated;
grant select, insert, update, delete on table public.featured_quest_batches to authenticated;

revoke all on table public.featured_batch_quests from anon, authenticated;
grant select, insert, update, delete on table public.featured_batch_quests to authenticated;

revoke all on table public.admin_notifications from anon, authenticated;
grant select, insert, update, delete on table public.admin_notifications to authenticated;

revoke all on table public.admin_invites from anon, authenticated;
grant select, update on table public.admin_invites to authenticated;

revoke all on table public.saved_quests from anon, authenticated;
grant select, insert, delete on table public.saved_quests to authenticated;

revoke all on table public.quest_completions from anon, authenticated;
grant select, insert on table public.quest_completions to authenticated;

revoke all on table public.admin_audit_log from anon, authenticated;
grant select, insert on table public.admin_audit_log to authenticated;

revoke all on table public.app_announcements from anon, authenticated;
grant select, update on table public.app_announcements to authenticated;
