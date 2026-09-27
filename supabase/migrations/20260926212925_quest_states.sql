-- Quest states v1: one live focused quest plus up to three flexible quests.

alter table public.quests
  add column if not exists quest_mode text not null default 'focused'
  check (quest_mode in ('focused', 'flexible'));

alter table public.quest_sessions
  drop constraint if exists quest_sessions_status_check;

update public.quest_sessions
set status = 'doing_now'
where status = 'active';

alter table public.quest_sessions
  add constraint quest_sessions_status_check
  check (status in ('doing_now', 'in_progress', 'completed', 'abandoned', 'saved_for_later'));

drop index if exists public.quest_sessions_one_active_idx;
create unique index if not exists quest_sessions_one_doing_now_idx
  on public.quest_sessions(user_id)
  where status = 'doing_now';

create index if not exists quest_sessions_in_progress_idx
  on public.quest_sessions(user_id, started_at desc)
  where status = 'in_progress';

create unique index if not exists quest_sessions_one_in_progress_run_idx
  on public.quest_sessions(user_id, quest_id)
  where status = 'in_progress';

create or replace function public.start_quest_session(
  p_quest_id uuid,
  p_today date default current_date,
  p_source text default 'explore',
  p_pack_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  daily_used integer;
  session_id uuid;
  mode text;
  in_progress_count integer;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;

  select quest_mode into mode
  from public.quests
  where id = p_quest_id and status = 'published';
  if mode is null then raise exception 'QUEST_NOT_AVAILABLE'; end if;

  select count(*) into daily_used
  from public.quest_completions
  where user_id = current_user_id and completed_on = p_today;
  if public.daily_quest_limit_is_enabled() and daily_used >= 5 then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;

  if mode = 'focused' and exists (
    select 1 from public.quest_sessions
    where user_id = current_user_id and status = 'doing_now'
  ) then
    raise exception 'DOING_NOW_SESSION_EXISTS';
  end if;

  if mode = 'flexible' then
    if exists (select 1 from public.quest_sessions where user_id = current_user_id and quest_id = p_quest_id and status = 'in_progress') then
      raise exception 'QUEST_ALREADY_IN_PROGRESS';
    end if;
    select count(*) into in_progress_count
    from public.quest_sessions
    where user_id = current_user_id and status = 'in_progress';
    if in_progress_count >= 3 then raise exception 'IN_PROGRESS_LIMIT_REACHED'; end if;
  end if;

  insert into public.quest_sessions (user_id, quest_id, source, pack_id, status)
  values (current_user_id, p_quest_id, p_source, p_pack_id,
    case when mode = 'focused' then 'doing_now' else 'in_progress' end)
  returning id into session_id;

  return jsonb_build_object('sessionId', session_id, 'mode', mode);
end;
$$;

create or replace function public.complete_quest_v2(
  p_quest_id uuid,
  p_today date default current_date,
  p_logged boolean default true,
  p_reflection text default null,
  p_rating smallint default null,
  p_review text default null,
  p_review_public boolean default true,
  p_photo_urls text[] default '{}',
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  quest record;
  active_session_id uuid;
  daily_used integer;
  previous_completions integer;
  awarded integer;
  completion_id uuid;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;

  select session.id into active_session_id
  from public.quest_sessions as session
  where session.user_id = current_user_id
    and session.quest_id = p_quest_id
    and session.status in ('doing_now', 'in_progress')
    and (p_session_id is null or session.id = p_session_id)
  order by session.started_at desc
  limit 1
  for update;
  if active_session_id is null then raise exception 'ACTIVE_SESSION_NOT_FOUND'; end if;

  select * into quest from public.quests where id = p_quest_id;
  if quest.id is null then raise exception 'QUEST_NOT_FOUND'; end if;

  select count(*) into previous_completions from public.quest_completions
  where user_id = current_user_id and quest_id = p_quest_id;
  select count(*) into daily_used from public.quest_completions
  where user_id = current_user_id and completed_on = p_today;
  if public.daily_quest_limit_is_enabled() and daily_used >= 5 then raise exception 'DAILY_LIMIT_REACHED'; end if;
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then raise exception 'RATING_INVALID'; end if;

  awarded := case when previous_completions > 0 then round(quest.experience_points * 0.20)::integer
    when p_logged then quest.experience_points else floor(quest.experience_points / 2.0)::integer end;
  insert into public.quest_completions (user_id, quest_id, completed_on, reflection, xp_awarded, logged, rating, review_text, review_public, photo_urls)
  values (current_user_id, p_quest_id, p_today, nullif(trim(coalesce(p_reflection, '')), ''), awarded, p_logged, p_rating,
    case when p_logged then nullif(trim(coalesce(p_review, '')), '') else null end, p_review_public, coalesce(p_photo_urls, '{}'))
  returning id into completion_id;
  update public.quest_sessions set status = 'completed', ended_at = now() where id = active_session_id;
  return jsonb_build_object('completionId', completion_id, 'xpAwarded', awarded, 'dailyUsed', daily_used + 1,
    'dailyLimit', case when public.daily_quest_limit_is_enabled() then 5 else 0 end);
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
  doing_now jsonb;
  in_progress jsonb;
  today_completions jsonb;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  select count(*) into daily_used from public.quest_completions where user_id = current_user_id and completed_on = p_today;
  select jsonb_build_object('id', s.id, 'questId', s.quest_id, 'source', s.source, 'startedAt', s.started_at,
    'recoveryStartedAt', s.recovery_started_at, 'recoveryRequiredAt', s.recovery_required_at) into doing_now
  from public.quest_sessions s where s.user_id = current_user_id and s.status = 'doing_now' limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'questId', s.quest_id, 'source', s.source, 'startedAt', s.started_at)
    order by s.started_at desc), '[]'::jsonb) into in_progress
  from public.quest_sessions s where s.user_id = current_user_id and s.status = 'in_progress';
  select coalesce(jsonb_agg(row order by row->>'completedAt' desc), '[]'::jsonb) into today_completions from (
    select jsonb_build_object('completionId', c.id, 'questId', c.quest_id, 'xpAwarded', c.xp_awarded, 'logged', c.logged, 'completedAt', c.created_at) row
    from public.quest_completions c where c.user_id = current_user_id and c.completed_on = p_today) rows;
  return jsonb_build_object('dailyLimit', case when public.daily_quest_limit_is_enabled() then 5 else 0 end,
    'dailyUsed', daily_used, 'doingNowSession', doing_now, 'inProgressSessions', in_progress, 'todayCompletions', today_completions);
end;
$$;

create or replace function public.abandon_quest_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.quest_sessions set status = 'abandoned', ended_at = now()
  where id = p_session_id and user_id = auth.uid() and status in ('doing_now', 'in_progress');
  if not found then raise exception 'SESSION_NOT_ACTIVE'; end if;
end;
$$;

-- Focused-only recovery functions now ignore flexible sessions.
create or replace function public.clear_my_active_quest_recovery() returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.quest_sessions set recovery_required_at = null where user_id = auth.uid() and status = 'doing_now';
end;
$$;

create or replace function public.mark_my_active_quest_away()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.quest_sessions set recovery_started_at = coalesce(recovery_started_at, now())
  where user_id = auth.uid() and status = 'doing_now';
end;
$$;

create or replace function public.cleanup_my_stale_quest_sessions(p_max_age_hours integer default 1)
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.quest_sessions as session
  set recovery_required_at = coalesce(session.recovery_required_at, now())
  where session.user_id = auth.uid() and session.status = 'doing_now'
    and session.recovery_required_at is null
    and coalesce((select snapshot.updated_at from public.quest_session_snapshots snapshot where snapshot.session_id = session.id), session.started_at) < now() - make_interval(hours => p_max_age_hours);
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.start_quest_session(uuid, date, text, uuid) from public, anon;
grant execute on function public.start_quest_session(uuid, date, text, uuid) to authenticated;
revoke all on function public.complete_quest_v2(uuid, date, boolean, text, smallint, text, boolean, text[], uuid) from public, anon;
grant execute on function public.complete_quest_v2(uuid, date, boolean, text, smallint, text, boolean, text[], uuid) to authenticated;
