-- A recovery is a clearly bounded grace day, not a synthetic quest completion.
create table if not exists public.streak_recoveries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recovered_on date not null,
  used_at timestamptz not null default now()
);

alter table public.streak_recoveries enable row level security;

create or replace function public.restore_streak(p_today date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  streak public.user_streaks%rowtype;
  last_recovery_at timestamptz;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if p_today <> current_date then raise exception 'STREAK_RECOVERY_DATE_INVALID'; end if;

  select * into streak
  from public.user_streaks
  where user_id = current_user_id
  for update;

  if not found or streak.last_quest_on is distinct from p_today - 2 then
    raise exception 'STREAK_RECOVERY_UNAVAILABLE';
  end if;

  select used_at into last_recovery_at
  from public.streak_recoveries
  where user_id = current_user_id;

  if last_recovery_at is not null and last_recovery_at > now() - interval '30 days' then
    raise exception 'STREAK_RECOVERY_COOLDOWN';
  end if;

  update public.user_streaks
  set current_streak = streak.current_streak + 1,
      longest_streak = greatest(streak.longest_streak, streak.current_streak + 1),
      last_quest_on = p_today - 1
  where user_id = current_user_id;

  insert into public.streak_recoveries (user_id, recovered_on, used_at)
  values (current_user_id, p_today - 1, now())
  on conflict (user_id) do update
    set recovered_on = excluded.recovered_on,
        used_at = excluded.used_at;

  return jsonb_build_object('currentStreak', streak.current_streak + 1, 'recoveredOn', p_today - 1);
end;
$$;

revoke all on function public.restore_streak(date) from public, anon;
grant execute on function public.restore_streak(date) to authenticated;
