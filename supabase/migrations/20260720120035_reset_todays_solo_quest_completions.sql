-- A self-service reset for development/support use. It intentionally excludes
-- Party completions: those affect shared rankings, feed entries, and other
-- members' views, so they must not be removed from a personal settings action.
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
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(sum(completion.xp_awarded), 0)::integer, count(*)::integer
  into removed_xp, removed_count
  from public.quest_completions as completion
  where completion.user_id = current_user_id
    and completion.completed_on = p_today
    and completion.party_id is null;

  if removed_count = 0 then
    return 0;
  end if;

  -- quest_posts.completion_id is ON DELETE SET NULL, preserving any post the
  -- user already shared while correctly removing its completion association.
  delete from public.quest_completions as completion
  where completion.user_id = current_user_id
    and completion.completed_on = p_today
    and completion.party_id is null;

  update public.profiles
  set total_xp = greatest(0, total_xp - removed_xp)
  where id = current_user_id;

  return removed_count;
end;
$$;

revoke execute on function public.reset_todays_solo_quest_completions(date) from public, anon;
grant execute on function public.reset_todays_solo_quest_completions(date) to authenticated;
