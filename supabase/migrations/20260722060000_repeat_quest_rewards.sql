-- A quest remains replayable after its first completion. The completion
-- history remains intact for the Journal, while repeat runs award 20% XP.
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
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1 from public.quest_sessions
    where user_id = current_user_id and status = 'active'
  ) then
    raise exception 'ACTIVE_SESSION_EXISTS';
  end if;

  if not exists (
    select 1 from public.quests
    where id = p_quest_id and status = 'published'
  ) then
    raise exception 'QUEST_NOT_AVAILABLE';
  end if;

  select count(*) into daily_used
  from public.quest_completions
  where user_id = current_user_id and completed_on = p_today;

  if public.daily_quest_limit_is_enabled() and daily_used >= 5 then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;

  insert into public.quest_sessions (user_id, quest_id, source, pack_id)
  values (current_user_id, p_quest_id, p_source, p_pack_id)
  returning id into session_id;

  return jsonb_build_object('sessionId', session_id);
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
  p_photo_urls text[] default '{}'
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
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select session.id into active_session_id
  from public.quest_sessions as session
  where session.user_id = current_user_id
    and session.quest_id = p_quest_id
    and session.status = 'active'
  for update;

  if active_session_id is null then
    raise exception 'ACTIVE_SESSION_NOT_FOUND';
  end if;

  -- Keep a started quest finishable even if it is unpublished afterwards.
  select * into quest
  from public.quests as quest_row
  where quest_row.id = p_quest_id;

  if quest.id is null then
    raise exception 'QUEST_NOT_FOUND';
  end if;

  select count(*) into previous_completions
  from public.quest_completions as completion
  where completion.user_id = current_user_id
    and completion.quest_id = p_quest_id;

  select count(*) into daily_used
  from public.quest_completions as completion
  where completion.user_id = current_user_id
    and completion.completed_on = p_today;

  if public.daily_quest_limit_is_enabled() and daily_used >= 5 then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;

  if p_rating is not null and (p_rating < 1 or p_rating > 5) then
    raise exception 'RATING_INVALID';
  end if;

  awarded := case
    when previous_completions > 0 then round(quest.experience_points * 0.20)::integer
    when p_logged then quest.experience_points
    else floor(quest.experience_points / 2.0)::integer
  end;

  insert into public.quest_completions (
    user_id, quest_id, completed_on, reflection, xp_awarded, logged,
    rating, review_text, review_public, photo_urls
  ) values (
    current_user_id, p_quest_id, p_today,
    nullif(trim(coalesce(p_reflection, '')), ''),
    awarded, p_logged, p_rating,
    case when p_logged then nullif(trim(coalesce(p_review, '')), '') else null end,
    p_review_public, coalesce(p_photo_urls, '{}')
  ) returning id into completion_id;

  update public.quest_sessions
  set status = 'completed', ended_at = now()
  where id = active_session_id;

  return jsonb_build_object(
    'completionId', completion_id,
    'xpAwarded', awarded,
    'dailyUsed', daily_used + 1,
    'dailyLimit', case when public.daily_quest_limit_is_enabled() then 5 else 0 end
  );
end;
$$;

revoke all on function public.start_quest_session(uuid, date, text, uuid) from public, anon;
grant execute on function public.start_quest_session(uuid, date, text, uuid) to authenticated;
revoke all on function public.complete_quest_v2(uuid, date, boolean, text, smallint, text, boolean, text[]) from public, anon;
grant execute on function public.complete_quest_v2(uuid, date, boolean, text, smallint, text, boolean, text[]) to authenticated;
