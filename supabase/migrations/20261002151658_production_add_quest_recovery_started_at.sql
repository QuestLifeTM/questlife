-- Required by record_my_active_quest_app_open and quest recovery RPCs.
alter table public.quest_sessions
  add column if not exists recovery_started_at timestamptz;
