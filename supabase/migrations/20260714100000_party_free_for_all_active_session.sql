-- A free-for-all Party member can work on only one Party quest at a time.
-- Preserve the most recent historical session if an earlier app version left
-- multiple active sessions behind, then make the invariant durable.
alter table public.party_quest_sessions
  drop constraint if exists party_quest_sessions_status_check;

alter table public.party_quest_sessions
  add constraint party_quest_sessions_status_check
  check (status in ('active', 'completed', 'abandoned'));

with ranked_sessions as (
  select id,
    row_number() over (partition by party_id, user_id order by started_at desc, id desc) as session_rank
  from public.party_quest_sessions
  where status = 'active'
)
update public.party_quest_sessions session
set status = 'abandoned'
from ranked_sessions ranked
where session.id = ranked.id
  and ranked.session_rank > 1;

drop index if exists public.party_quest_sessions_one_active_per_quest_idx;

create unique index if not exists party_quest_sessions_one_active_per_member_idx
  on public.party_quest_sessions (party_id, user_id)
  where status = 'active';

create or replace function public.start_party_quest(p_party_id uuid, p_quest_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare party_row public.parties%rowtype; round_id uuid; session_id uuid; started timestamptz;
begin
  select * into party_row from public.parties where id = p_party_id;
  if party_row.status <> 'active' or not public.is_party_member(p_party_id, auth.uid()) then
    raise exception 'This party is not active.';
  end if;
  if public.party_member_count(p_party_id) < 2 then
    raise exception 'A party needs two active members to start a quest.';
  end if;
  if not exists (select 1 from public.party_quests where party_id = p_party_id and quest_id = p_quest_id and status = 'available') then
    raise exception 'This quest is not in the party.';
  end if;
  if party_row.game_mode = 'free_for_all' and not party_row.quests_enabled then
    raise exception 'The host has not opened the Party quest list yet.';
  end if;
  if party_row.game_mode = 'everyone_together' then
    if not public.is_party_host(p_party_id, auth.uid()) then raise exception 'Only the host starts shared quests.'; end if;
    if exists (select 1 from public.party_quest_rounds where party_id = p_party_id and status = 'active') then raise exception 'End the current shared quest first.'; end if;
    insert into public.party_quest_rounds (party_id, quest_id, started_by)
    values (p_party_id, p_quest_id, auth.uid()) returning id, started_at into round_id, started;
    return jsonb_build_object('roundId', round_id, 'startedAt', started);
  end if;
  if exists (
    select 1 from public.party_quest_sessions
    where party_id = p_party_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'ACTIVE_PARTY_SESSION_EXISTS';
  end if;
  begin
    insert into public.party_quest_sessions (party_id, quest_id, user_id)
    values (p_party_id, p_quest_id, auth.uid()) returning id, started_at into session_id, started;
  exception when unique_violation then
    raise exception 'ACTIVE_PARTY_SESSION_EXISTS';
  end;
  return jsonb_build_object('sessionId', session_id, 'startedAt', started);
end;
$$;

create or replace function public.abandon_party_quest_session(p_party_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.parties party
    where party.id = p_party_id and party.status = 'active' and public.is_party_member(p_party_id, auth.uid())
  ) then
    raise exception 'This party is not active.';
  end if;

  update public.party_quest_sessions
  set status = 'abandoned'
  where party_id = p_party_id and user_id = auth.uid() and status = 'active';

  if not found then raise exception 'No active Party quest to abandon.'; end if;
end;
$$;

revoke execute on function public.abandon_party_quest_session(uuid) from public;
grant execute on function public.abandon_party_quest_session(uuid) to authenticated;
