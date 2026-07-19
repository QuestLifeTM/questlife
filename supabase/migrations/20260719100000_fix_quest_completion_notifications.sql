-- Completion inserts were failing after the row was written because the
-- notification trigger used `total_xp` as both a PL/pgSQL variable and a
-- profiles column. Give the variable its own name and qualify the column.
create or replace function public.notify_quest_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quest_title text;
  streak_count integer;
  completion_count integer;
  level_number integer;
  profile_total_xp integer;
begin
  select q.title into quest_title from public.quests q where q.id = new.quest_id;
  perform public.create_app_notification(new.user_id, 'progress', 'xp_earned', 'XP earned', 'You gained +' || coalesce(new.xp_awarded, 0)::text || ' XP from ' || coalesce(quest_title, 'your quest') || '.', 'flash', '#FEE440', 'xp-earned:' || new.id::text, jsonb_build_object('questId', new.quest_id, 'completionId', new.id, 'xpAwarded', coalesce(new.xp_awarded, 0)), 'in_app');
  if coalesce(new.logged, false) then
    perform public.create_app_notification(new.user_id, 'progress', 'journal_entry_ready', 'Your journal has a new entry', coalesce(quest_title, 'Your completed quest') || ' is ready to revisit in Journal.', 'book', '#4DA8FF', 'journal-entry:' || new.id::text, jsonb_build_object('questId', new.quest_id, 'completionId', new.id), 'in_app');
  end if;
  select us.current_streak into streak_count from public.user_streaks us where us.user_id = new.user_id;
  if streak_count in (3, 7, 14, 30, 60, 100) then
    perform public.create_app_notification(new.user_id, 'progress', 'streak_milestone', 'Streak milestone reached', 'Your ' || streak_count::text || '-day streak is still alive. Keep it going!', 'flame', '#FF9D00', 'streak-milestone:' || streak_count::text, jsonb_build_object('streak', streak_count), 'in_app');
  end if;
  select count(*) into completion_count from public.quest_completions qc where qc.user_id = new.user_id;
  if completion_count in (1, 10, 25, 50, 100) then
    perform public.create_app_notification(new.user_id, 'progress', 'achievement', 'Achievement unlocked', 'You have completed ' || completion_count::text || ' quests. Your explorer story is growing.', 'ribbon', '#9C4DFF', 'achievement-completions:' || completion_count::text, jsonb_build_object('completionCount', completion_count), 'in_app');
  end if;
  select p.total_xp into profile_total_xp from public.profiles p where p.id = new.user_id;
  level_number := floor(coalesce(profile_total_xp, 0) / 500.0)::integer + 1;
  if profile_total_xp is not null and profile_total_xp >= 500 and mod(profile_total_xp, 500) < coalesce(new.xp_awarded, 0) then
    perform public.create_app_notification(new.user_id, 'progress', 'level_up', 'Level up!', 'You reached Level ' || level_number::text || '. Keep collecting real-world wins.', 'trending-up', '#4DA8FF', 'level-up:' || level_number::text, jsonb_build_object('level', level_number), 'in_app');
  end if;
  return new;
end;
$$;

-- An Active Quest already has a journal draft. A rating is valuable context,
-- not a prerequisite for saving that draft and completing the quest.
create or replace function public.complete_quest_v2(
  p_quest_id uuid, p_today date default current_date, p_logged boolean default true, p_reflection text default null,
  p_rating smallint default null, p_review text default null, p_review_public boolean default true, p_photo_urls text[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); quest record; daily_used integer; awarded integer; completion_id uuid;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  select * into quest from public.quests where id = p_quest_id and status = 'published';
  if quest.id is null then raise exception 'QUEST_NOT_AVAILABLE'; end if;
  if exists (select 1 from public.quest_completions where user_id = current_user_id and quest_id = p_quest_id) then raise exception 'QUEST_ALREADY_COMPLETED'; end if;
  select count(*) into daily_used from public.quest_completions where user_id = current_user_id and completed_on = p_today;
  if public.daily_quest_limit_is_enabled() and daily_used >= 5 then raise exception 'DAILY_LIMIT_REACHED'; end if;
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then raise exception 'RATING_INVALID'; end if;
  awarded := case when p_logged then quest.experience_points else floor(quest.experience_points / 2.0)::integer end;
  insert into public.quest_completions (user_id, quest_id, completed_on, reflection, xp_awarded, logged, rating, review_text, review_public, photo_urls)
  values (current_user_id, p_quest_id, p_today, nullif(trim(coalesce(p_reflection, '')), ''), awarded, p_logged, p_rating, case when p_logged then nullif(trim(coalesce(p_review, '')), '') else null end, p_review_public, coalesce(p_photo_urls, '{}')) returning id into completion_id;
  update public.quest_sessions set status = 'completed', ended_at = now() where user_id = current_user_id and quest_id = p_quest_id and status = 'active';
  return jsonb_build_object('completionId', completion_id, 'xpAwarded', awarded, 'dailyUsed', daily_used + 1, 'dailyLimit', case when public.daily_quest_limit_is_enabled() then 5 else 0 end);
end;
$$;

grant execute on function public.complete_quest_v2(uuid, date, boolean, text, smallint, text, boolean, text[]) to authenticated;
