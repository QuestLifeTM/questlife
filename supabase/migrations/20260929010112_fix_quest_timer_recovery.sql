-- A successful recovery must clear both recovery timestamps. Leaving
-- `recovery_started_at` set causes every later launch to be treated as a
-- fresh interruption and can repeatedly freeze/resume the active timer.
create or replace function public.clear_my_active_quest_recovery()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.quest_sessions
  set recovery_required_at = null,
      recovery_started_at = null
  where user_id = auth.uid()
    and status = 'doing_now';
end;
$$;

revoke all on function public.clear_my_active_quest_recovery() from public, anon;
grant execute on function public.clear_my_active_quest_recovery() to authenticated;

-- Recovery is based on a quest's original start time, not on the latest
-- background location/snapshot update. This makes the 12-hour prompt
-- deterministic even when iOS has suspended or terminated the app.
create or replace function public.cleanup_my_stale_quest_sessions(
  p_max_age_hours integer default 12
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_max_age_hours < 1 or p_max_age_hours > 720 then
    raise exception 'Invalid recovery age';
  end if;

  update public.quest_sessions as session
  set recovery_required_at = coalesce(session.recovery_required_at, now())
  where session.user_id = auth.uid()
    and session.status = 'doing_now'
    and session.recovery_required_at is null
    and session.started_at < now() - make_interval(hours => p_max_age_hours);

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.cleanup_my_stale_quest_sessions(integer) from public, anon;
grant execute on function public.cleanup_my_stale_quest_sessions(integer) to authenticated;
