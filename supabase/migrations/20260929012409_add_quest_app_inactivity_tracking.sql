-- Quest duration and app inactivity are separate concepts. Keep the last
-- foreground/open time with the focused quest so it survives app termination.
alter table public.quest_sessions
  add column if not exists last_app_opened_at timestamptz not null default now();

create or replace function public.record_my_active_quest_app_open(
  p_inactivity_hours integer default 12
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_inactivity_hours < 1 or p_inactivity_hours > 720 then
    raise exception 'Invalid inactivity threshold';
  end if;

  -- Evaluate the previous foreground timestamp before overwriting it. When a
  -- recovery is needed, retain that previous time in recovery_started_at so
  -- the client can show exactly how long the app was unopened.
  update public.quest_sessions as session
  set recovery_started_at = case
        when session.last_app_opened_at <= now() - make_interval(hours => p_inactivity_hours)
          then session.last_app_opened_at
        else null
      end,
      recovery_required_at = case
        when session.last_app_opened_at <= now() - make_interval(hours => p_inactivity_hours)
          then now()
        else null
      end,
      last_app_opened_at = now()
  where session.user_id = auth.uid()
    and session.status = 'doing_now';
end;
$$;

-- Include app-session metadata in the existing engine read model.
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
  doing_now jsonb;
  in_progress jsonb;
  today_completions jsonb;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  select count(*) into daily_used from public.quest_completions where user_id = current_user_id and completed_on = p_today;
  select jsonb_build_object(
    'id', s.id, 'questId', s.quest_id, 'source', s.source, 'startedAt', s.started_at,
    'lastAppOpenedAt', s.last_app_opened_at,
    'recoveryStartedAt', s.recovery_started_at, 'recoveryRequiredAt', s.recovery_required_at
  ) into doing_now
  from public.quest_sessions s
  where s.user_id = current_user_id and s.status = 'doing_now'
  limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'questId', s.quest_id, 'source', s.source, 'startedAt', s.started_at)
    order by s.started_at desc), '[]'::jsonb) into in_progress
  from public.quest_sessions s where s.user_id = current_user_id and s.status = 'in_progress';
  select coalesce(jsonb_agg(row order by row->>'completedAt' desc), '[]'::jsonb) into today_completions from (
    select jsonb_build_object('completionId', c.id, 'questId', c.quest_id, 'xpAwarded', c.xp_awarded, 'logged', c.logged, 'completedAt', c.created_at) row
    from public.quest_completions c where c.user_id = current_user_id and c.completed_on = p_today
  ) rows;
  return jsonb_build_object('dailyLimit', case when public.daily_quest_limit_is_enabled() then 5 else 0 end,
    'dailyUsed', daily_used, 'doingNowSession', doing_now, 'inProgressSessions', in_progress, 'todayCompletions', today_completions);
end;
$$;

revoke all on function public.record_my_active_quest_app_open(integer) from public, anon;
grant execute on function public.record_my_active_quest_app_open(integer) to authenticated;
revoke all on function public.get_quest_engine_state(date) from public, anon;
grant execute on function public.get_quest_engine_state(date) to authenticated;
