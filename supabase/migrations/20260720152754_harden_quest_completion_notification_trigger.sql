-- Keep completion notifications from failing the insert transaction. The
-- original trigger declared a variable named `total_xp` and then queried an
-- unqualified `total_xp` column, which PostgreSQL treats as ambiguous.
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
  select q.title into quest_title
  from public.quests as q
  where q.id = new.quest_id;

  perform public.create_app_notification(
    new.user_id, 'progress', 'xp_earned', 'XP earned',
    'You gained +' || coalesce(new.xp_awarded, 0)::text || ' XP from ' || coalesce(quest_title, 'your quest') || '.',
    'flash', '#FEE440', 'xp-earned:' || new.id::text,
    jsonb_build_object('questId', new.quest_id, 'completionId', new.id, 'xpAwarded', coalesce(new.xp_awarded, 0)), 'in_app'
  );

  if coalesce(new.logged, false) then
    perform public.create_app_notification(
      new.user_id, 'progress', 'journal_entry_ready', 'Your journal has a new entry',
      coalesce(quest_title, 'Your completed quest') || ' is ready to revisit in Journal.',
      'book', '#4DA8FF', 'journal-entry:' || new.id::text,
      jsonb_build_object('questId', new.quest_id, 'completionId', new.id), 'in_app'
    );
  end if;

  select us.current_streak into streak_count
  from public.user_streaks as us
  where us.user_id = new.user_id;
  if streak_count in (3, 7, 14, 30, 60, 100) then
    perform public.create_app_notification(
      new.user_id, 'progress', 'streak_milestone', 'Streak milestone reached',
      'Your ' || streak_count::text || '-day streak is still alive. Keep it going!',
      'flame', '#FF9D00', 'streak-milestone:' || streak_count::text,
      jsonb_build_object('streak', streak_count), 'in_app'
    );
  end if;

  select count(*) into completion_count
  from public.quest_completions as qc
  where qc.user_id = new.user_id;
  if completion_count in (1, 10, 25, 50, 100) then
    perform public.create_app_notification(
      new.user_id, 'progress', 'achievement', 'Achievement unlocked',
      'You have completed ' || completion_count::text || ' quests. Your explorer story is growing.',
      'ribbon', '#9C4DFF', 'achievement-completions:' || completion_count::text,
      jsonb_build_object('completionCount', completion_count), 'in_app'
    );
  end if;

  select p.total_xp into profile_total_xp
  from public.profiles as p
  where p.id = new.user_id;
  level_number := floor(coalesce(profile_total_xp, 0) / 500.0)::integer + 1;
  if profile_total_xp is not null
    and profile_total_xp >= 500
    and mod(profile_total_xp, 500) < coalesce(new.xp_awarded, 0) then
    perform public.create_app_notification(
      new.user_id, 'progress', 'level_up', 'Level up!',
      'You reached Level ' || level_number::text || '. Keep collecting real-world wins.',
      'trending-up', '#4DA8FF', 'level-up:' || level_number::text,
      jsonb_build_object('level', level_number), 'in_app'
    );
  end if;

  return new;
end;
$$;
