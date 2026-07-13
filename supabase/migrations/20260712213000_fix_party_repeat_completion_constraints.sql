-- Free-for-All quests can be completed again in a later personal session, and
-- shared quests can be completed again in a later round. The original
-- `UNIQUE NULLS NOT DISTINCT` constraints treated the unused nullable id as a
-- shared value, which incorrectly made every later completion a duplicate.
--
-- Retain the intended duplicate protection, scoped to the actual session or
-- round that owns the completion.
alter table public.party_quest_sessions
  drop constraint if exists party_quest_sessions_party_id_quest_id_user_id_status_key;

create unique index if not exists party_quest_sessions_one_active_per_quest_idx
  on public.party_quest_sessions (party_id, quest_id, user_id)
  where status = 'active';

alter table public.party_completions
  drop constraint if exists party_completions_party_id_quest_id_user_id_round_id_key,
  drop constraint if exists party_completions_party_id_quest_id_user_id_session_id_key;

create unique index if not exists party_completions_one_per_shared_round_idx
  on public.party_completions (party_id, quest_id, user_id, round_id)
  where round_id is not null;

create unique index if not exists party_completions_one_per_free_session_idx
  on public.party_completions (party_id, quest_id, user_id, session_id)
  where session_id is not null;
