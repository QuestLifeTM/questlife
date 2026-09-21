-- The August hardening migration revoked direct Data API table privileges but
-- omitted these user-facing tables. Their owner-only RLS policies remain the
-- authorization boundary; these grants only permit those policies to run.

revoke all on table public.journal_entries from anon, authenticated;
grant select, insert, update on table public.journal_entries to authenticated;

revoke all on table public.quest_completions from anon, authenticated;
grant select on table public.quest_completions to authenticated;

revoke all on table public.quest_sessions from anon, authenticated;
grant select on table public.quest_sessions to authenticated;
