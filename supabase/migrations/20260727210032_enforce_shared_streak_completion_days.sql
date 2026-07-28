-- A shared streak is opt-in: only respond_duo_streak_invite creates a duo.
-- It advances once per calendar day, and only after both accepted members have
-- completed a quest on that exact same day. Serializing per duo prevents two
-- near-simultaneous completions from both observing stale partner state.
create or replace function public.apply_streak_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  duo_id uuid;
  duo public.duo_streaks%rowtype;
  partner_last date;
  both_done boolean;
begin
  insert into public.user_streaks (user_id, current_streak, longest_streak, last_quest_on, streak_started_on)
  values (new.user_id, 1, 1, new.completed_on, new.completed_on)
  on conflict (user_id) do update
  set current_streak = case
        when public.user_streaks.last_quest_on = excluded.last_quest_on then public.user_streaks.current_streak
        when public.user_streaks.last_quest_on = excluded.last_quest_on - 1 then public.user_streaks.current_streak + 1
        else 1
      end,
      longest_streak = greatest(
        public.user_streaks.longest_streak,
        case
          when public.user_streaks.last_quest_on = excluded.last_quest_on then public.user_streaks.current_streak
          when public.user_streaks.last_quest_on = excluded.last_quest_on - 1 then public.user_streaks.current_streak + 1
          else 1
        end
      ),
      streak_started_on = case
        when public.user_streaks.last_quest_on = excluded.last_quest_on
          or public.user_streaks.last_quest_on = excluded.last_quest_on - 1
          then public.user_streaks.streak_started_on
        else excluded.streak_started_on
      end,
      last_quest_on = greatest(public.user_streaks.last_quest_on, excluded.last_quest_on)
  where public.user_streaks.last_quest_on is null
     or public.user_streaks.last_quest_on <= excluded.last_quest_on;

  for duo_id in
    select id
    from public.duo_streaks
    where status = 'active'
      and new.user_id in (user_a, user_b)
  loop
    perform pg_advisory_xact_lock(hashtextextended(duo_id::text, 0));

    select *
    into duo
    from public.duo_streaks
    where id = duo_id
      and status = 'active'
    for update;

    if not found then
      continue;
    end if;

    if duo.user_a = new.user_id then
      partner_last := duo.last_completed_b;
      update public.duo_streaks
      set last_completed_a = greatest(coalesce(last_completed_a, new.completed_on), new.completed_on)
      where id = duo.id;
    else
      partner_last := duo.last_completed_a;
      update public.duo_streaks
      set last_completed_b = greatest(coalesce(last_completed_b, new.completed_on), new.completed_on)
      where id = duo.id;
    end if;

    both_done := partner_last = new.completed_on;

    if both_done and (duo.last_advanced_on is null or duo.last_advanced_on < new.completed_on) then
      update public.duo_streaks
      set current_streak = case
            when last_advanced_on is null or last_advanced_on < new.completed_on - 1 then 1
            else current_streak + 1
          end,
          longest_streak = greatest(
            longest_streak,
            case
              when last_advanced_on is null or last_advanced_on < new.completed_on - 1 then 1
              else current_streak + 1
            end
          ),
          last_advanced_on = new.completed_on
      where id = duo.id;
    end if;
  end loop;

  return new;
end;
$$;
