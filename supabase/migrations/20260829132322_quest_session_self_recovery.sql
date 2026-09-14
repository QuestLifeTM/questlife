-- Self-service recovery for sessions left active by an interrupted app run.
-- Both functions are intentionally scoped to auth.uid(); callers can never
-- inspect or alter another person's quest session.

create or replace function public.abandon_my_active_quest_session()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  abandoned_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.quest_sessions
  set status = 'abandoned', ended_at = now()
  where user_id = current_user_id
    and status = 'active';

  get diagnostics abandoned_count = row_count;
  return abandoned_count;
end;
$$;

create or replace function public.cleanup_my_stale_quest_sessions(
  p_max_age_hours integer default 24
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  abandoned_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_max_age_hours < 1 or p_max_age_hours > 720 then
    raise exception 'Invalid stale-session age';
  end if;

  -- A session is stale only when it is old and has received no local-record
  -- update within the same period. This preserves an actively-recorded quest.
  update public.quest_sessions as session
  set status = 'abandoned', ended_at = now()
  where session.user_id = current_user_id
    and session.status = 'active'
    and session.started_at < now() - make_interval(hours => p_max_age_hours)
    and not exists (
      select 1
      from public.quest_session_snapshots as snapshot
      where snapshot.session_id = session.id
        and snapshot.updated_at >= now() - make_interval(hours => p_max_age_hours)
    );

  get diagnostics abandoned_count = row_count;
  return abandoned_count;
end;
$$;

revoke all on function public.abandon_my_active_quest_session() from public, anon;
revoke all on function public.cleanup_my_stale_quest_sessions(integer) from public, anon;
grant execute on function public.abandon_my_active_quest_session() to authenticated;
grant execute on function public.cleanup_my_stale_quest_sessions(integer) to authenticated;
