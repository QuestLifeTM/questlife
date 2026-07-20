-- A quest can be unpublished after someone has started it. The user must
-- still be able to finish their already-active session; availability governs
-- starting new sessions, not completing an existing one.
create or replace function public.complete_quest_v2(
  p_quest_id uuid, p_today date default current_date, p_logged boolean default true, p_reflection text default null,
  p_rating smallint default null, p_review text default null, p_review_public boolean default true, p_photo_urls text[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  quest record;
  active_session_id uuid;
  daily_used integer;
  awarded integer;
  completion_id uuid;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;

  select s.id into active_session_id
  from public.quest_sessions s
  where s.user_id = current_user_id and s.quest_id = p_quest_id and s.status = 'active'
  for update;
  if active_session_id is null then raise exception 'ACTIVE_SESSION_NOT_FOUND'; end if;

  select * into quest from public.quests q where q.id = p_quest_id;
  if quest.id is null then raise exception 'QUEST_NOT_FOUND'; end if;
  if exists (select 1 from public.quest_completions c where c.user_id = current_user_id and c.quest_id = p_quest_id) then
    raise exception 'QUEST_ALREADY_COMPLETED';
  end if;

  select count(*) into daily_used from public.quest_completions c where c.user_id = current_user_id and c.completed_on = p_today;
  if public.daily_quest_limit_is_enabled() and daily_used >= 5 then raise exception 'DAILY_LIMIT_REACHED'; end if;
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then raise exception 'RATING_INVALID'; end if;

  awarded := case when p_logged then quest.experience_points else floor(quest.experience_points / 2.0)::integer end;
  insert into public.quest_completions (user_id, quest_id, completed_on, reflection, xp_awarded, logged, rating, review_text, review_public, photo_urls)
  values (current_user_id, p_quest_id, p_today, nullif(trim(coalesce(p_reflection, '')), ''), awarded, p_logged, p_rating,
    case when p_logged then nullif(trim(coalesce(p_review, '')), '') else null end, p_review_public, coalesce(p_photo_urls, '{}'))
  returning id into completion_id;

  update public.quest_sessions set status = 'completed', ended_at = now() where id = active_session_id;
  return jsonb_build_object('completionId', completion_id, 'xpAwarded', awarded, 'dailyUsed', daily_used + 1,
    'dailyLimit', case when public.daily_quest_limit_is_enabled() then 5 else 0 end);
end;
$$;

grant execute on function public.complete_quest_v2(uuid, date, boolean, text, smallint, text, boolean, text[]) to authenticated;
