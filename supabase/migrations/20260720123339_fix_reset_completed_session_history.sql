-- Ensure a personal reset clears both sides of a completed solo run. Older
-- completed session rows are not active, but retaining them can leave stale
-- clients attempting to finish an already-reset run.
create or replace function public.reset_todays_solo_quest_completions(
  p_today date default current_date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  removed_xp integer := 0;
  removed_count integer := 0;
  reset_quest_ids uuid[] := '{}';
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    coalesce(sum(completion.xp_awarded), 0)::integer,
    count(*)::integer,
    coalesce(array_agg(completion.quest_id), '{}')
  into removed_xp, removed_count, reset_quest_ids
  from public.quest_completions as completion
  where completion.user_id = current_user_id
    and completion.completed_on = p_today
    and completion.party_id is null;

  if removed_count = 0 then
    return 0;
  end if;

  delete from public.quest_completions as completion
  where completion.user_id = current_user_id
    and completion.completed_on = p_today
    and completion.party_id is null;

  update public.quest_sessions as session
  set status = 'abandoned', ended_at = coalesce(session.ended_at, now())
  where session.user_id = current_user_id
    and session.quest_id = any(reset_quest_ids)
    and session.status = 'completed';

  update public.profiles
  set total_xp = greatest(0, total_xp - removed_xp)
  where id = current_user_id;

  return removed_count;
end;
$$;

revoke execute on function public.reset_todays_solo_quest_completions(date) from public, anon;
grant execute on function public.reset_todays_solo_quest_completions(date) to authenticated;
