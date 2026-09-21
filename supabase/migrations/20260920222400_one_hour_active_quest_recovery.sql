-- A deliberate sign-out records when the active quest was left. Returning
-- within an hour resumes from the saved elapsed time; longer absences require
-- an explicit owner choice in the app.
alter table public.quest_sessions
  add column if not exists recovery_started_at timestamptz;

create or replace function public.mark_my_active_quest_away()
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
  set recovery_started_at = coalesce(
    recovery_started_at,
    (select snapshot.updated_at from public.quest_session_snapshots as snapshot where snapshot.session_id = quest_sessions.id),
    now()
  )
  where user_id = auth.uid()
    and status = 'active';
end;
$$;

create or replace function public.cleanup_my_stale_quest_sessions(
  p_max_age_hours integer default 1
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  recovery_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_max_age_hours < 1 or p_max_age_hours > 720 then
    raise exception 'Invalid recovery age';
  end if;

  update public.quest_sessions as session
  set recovery_required_at = coalesce(session.recovery_required_at, now())
  where session.user_id = current_user_id
    and session.status = 'active'
    and session.recovery_required_at is null
    and coalesce(
      session.recovery_started_at,
      (select snapshot.updated_at from public.quest_session_snapshots as snapshot where snapshot.session_id = session.id),
      session.started_at
    ) < now() - make_interval(hours => p_max_age_hours);

  get diagnostics recovery_count = row_count;
  return recovery_count;
end;
$$;

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
    and status = 'active';
end;
$$;

create or replace function public.get_quest_engine_state(p_today date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  current_user_id uuid := auth.uid();
  daily_used integer;
  active_session jsonb;
  today_completions jsonb;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select count(*) into daily_used
  from public.quest_completions
  where user_id = current_user_id and completed_on = p_today;

  select jsonb_build_object(
    'id', session.id,
    'questId', session.quest_id,
    'source', session.source,
    'packId', session.pack_id,
    'startedAt', session.started_at,
    'recoveryStartedAt', session.recovery_started_at,
    'recoveryRequiredAt', session.recovery_required_at
  ) into active_session
  from public.quest_sessions as session
  where session.user_id = current_user_id and session.status = 'active'
  limit 1;

  select coalesce(jsonb_agg(row order by row->>'completedAt' desc), '[]'::jsonb)
  into today_completions
  from (
    select jsonb_build_object(
      'completionId', completion.id,
      'questId', completion.quest_id,
      'xpAwarded', completion.xp_awarded,
      'logged', completion.logged,
      'completedAt', completion.created_at
    ) as row
    from public.quest_completions as completion
    where completion.user_id = current_user_id and completion.completed_on = p_today
  ) as rows;

  return jsonb_build_object(
    'dailyLimit', case when public.daily_quest_limit_is_enabled() then 5 else 0 end,
    'dailyUsed', daily_used,
    'activeSession', active_session,
    'todayCompletions', today_completions
  );
end;
$$;

revoke all on function public.mark_my_active_quest_away() from public, anon;
grant execute on function public.mark_my_active_quest_away() to authenticated;
revoke all on function public.cleanup_my_stale_quest_sessions(integer) from public, anon;
grant execute on function public.cleanup_my_stale_quest_sessions(integer) to authenticated;
revoke all on function public.clear_my_active_quest_recovery() from public, anon;
grant execute on function public.clear_my_active_quest_recovery() to authenticated;
revoke all on function public.get_quest_engine_state(date) from public, anon;
grant execute on function public.get_quest_engine_state(date) to authenticated;
