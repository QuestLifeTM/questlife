-- Active quests are never silently abandoned because a user signed out or was
-- away from the app. After twelve hours without a checkpoint they require an
-- explicit recovery decision from their owner.

alter table public.quest_sessions
  add column if not exists recovery_required_at timestamptz;

create or replace function public.cleanup_my_stale_quest_sessions(
  p_max_age_hours integer default 12
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
    and coalesce((
      select snapshot.updated_at
      from public.quest_session_snapshots as snapshot
      where snapshot.session_id = session.id
    ), session.started_at) < now() - make_interval(hours => p_max_age_hours);

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
  set recovery_required_at = null
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
    'id', s.id,
    'questId', s.quest_id,
    'source', s.source,
    'packId', s.pack_id,
    'startedAt', s.started_at,
    'recoveryRequiredAt', s.recovery_required_at
  ) into active_session
  from public.quest_sessions s
  where s.user_id = current_user_id and s.status = 'active'
  limit 1;

  select coalesce(jsonb_agg(row order by row->>'completedAt' desc), '[]'::jsonb)
  into today_completions
  from (
    select jsonb_build_object('completionId', c.id, 'questId', c.quest_id, 'xpAwarded', c.xp_awarded, 'logged', c.logged, 'completedAt', c.created_at) as row
    from public.quest_completions c
    where c.user_id = current_user_id and c.completed_on = p_today
  ) as rows;

  return jsonb_build_object(
    'dailyLimit', case when public.daily_quest_limit_is_enabled() then 5 else 0 end,
    'dailyUsed', daily_used,
    'activeSession', active_session,
    'todayCompletions', today_completions
  );
end;
$$;

revoke all on function public.clear_my_active_quest_recovery() from public, anon;
grant execute on function public.clear_my_active_quest_recovery() to authenticated;
