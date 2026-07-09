-- Streaks: personal streak tracking, duo (friend) streaks, invites with a
-- 24-hour decline cooldown, and app-authored encouragement nudges.
--
-- Design notes:
-- * quest_completions gains a `completed_on` local-calendar date so a "streak
--   day" rolls over at the user's midnight, not UTC midnight. The app passes
--   the device-local date on insert; the default covers older clients.
-- * user_streaks is denormalised and maintained by a trigger so friends can
--   read each other's streak numbers (via RPC) without access to the
--   underlying quest_completions rows.
-- * friendships is the minimal foundation for the social system. Phase 6 adds
--   the request/accept flow; until then rows are only created server-side, so
--   no insert policy exists for regular users.
-- * All cross-user reads and writes go through security-definer RPCs that
--   return exactly the fields the streak screen needs. Raw tables stay locked
--   down to the owning user.

-- ---------------------------------------------------------------------------
-- quest_completions: local-calendar completion date
-- ---------------------------------------------------------------------------

alter table public.quest_completions
add column if not exists completed_on date;

update public.quest_completions
set completed_on = (created_at at time zone 'utc')::date
where completed_on is null;

alter table public.quest_completions
alter column completed_on set not null;

alter table public.quest_completions
alter column completed_on set default current_date;

create index if not exists quest_completions_user_completed_on_idx
on public.quest_completions(user_id, completed_on desc);

-- ---------------------------------------------------------------------------
-- profiles: streak visibility setting
-- ---------------------------------------------------------------------------

alter table public.profiles
add column if not exists streak_visibility text not null default 'public'
check (streak_visibility in ('public', 'private'));

-- ---------------------------------------------------------------------------
-- friendships (foundation for Phase 6)
-- ---------------------------------------------------------------------------

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists friendships_user_a_idx on public.friendships(user_a);
create index if not exists friendships_user_b_idx on public.friendships(user_b);

alter table public.friendships enable row level security;

drop policy if exists "Users can read their friendships" on public.friendships;
create policy "Users can read their friendships"
on public.friendships
for select
to authenticated
using ((select auth.uid()) in (user_a, user_b));

create or replace function public.are_friends(first_user uuid, second_user uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.friendships
    where user_a = least(first_user, second_user)
      and user_b = greatest(first_user, second_user)
  );
$$;

-- ---------------------------------------------------------------------------
-- user_streaks: denormalised personal streak state
-- ---------------------------------------------------------------------------

create table if not exists public.user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_quest_on date,
  streak_started_on date,
  updated_at timestamptz not null default now()
);

alter table public.user_streaks enable row level security;

drop trigger if exists user_streaks_set_updated_at on public.user_streaks;
create trigger user_streaks_set_updated_at
before update on public.user_streaks
for each row
execute function public.set_updated_at();

drop policy if exists "Users can read their own streak" on public.user_streaks;
create policy "Users can read their own streak"
on public.user_streaks
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Backfill from existing completions: group consecutive completion days into
-- runs, keep the latest run as the current streak and the longest run overall.
with completion_days as (
  select user_id, completed_on
  from public.quest_completions
  group by user_id, completed_on
),
runs as (
  select
    user_id,
    completed_on,
    completed_on - (row_number() over (partition by user_id order by completed_on))::integer as run_group
  from completion_days
),
run_aggregates as (
  select
    user_id,
    run_group,
    count(*)::integer as run_length,
    min(completed_on) as run_started,
    max(completed_on) as run_ended
  from runs
  group by user_id, run_group
),
latest_runs as (
  select distinct on (user_id) user_id, run_length, run_started, run_ended
  from run_aggregates
  order by user_id, run_ended desc
),
longest_runs as (
  select user_id, max(run_length)::integer as longest
  from run_aggregates
  group by user_id
)
insert into public.user_streaks (user_id, current_streak, longest_streak, last_quest_on, streak_started_on)
select
  latest_runs.user_id,
  latest_runs.run_length,
  longest_runs.longest,
  latest_runs.run_ended,
  latest_runs.run_started
from latest_runs
join longest_runs on longest_runs.user_id = latest_runs.user_id
on conflict (user_id) do update
set current_streak = excluded.current_streak,
    longest_streak = excluded.longest_streak,
    last_quest_on = excluded.last_quest_on,
    streak_started_on = excluded.streak_started_on;

-- ---------------------------------------------------------------------------
-- duo_streaks: shared streaks between two friends
-- ---------------------------------------------------------------------------

create table if not exists public.duo_streaks (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  started_on date not null default current_date,
  -- Last local-calendar day each partner completed a quest.
  last_completed_a date,
  last_completed_b date,
  -- Last day the shared streak counter advanced (both partners done).
  last_advanced_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ended_at timestamptz,
  check (user_a < user_b)
);

create unique index if not exists duo_streaks_active_pair_idx
on public.duo_streaks(user_a, user_b)
where status = 'active';

create index if not exists duo_streaks_user_a_idx on public.duo_streaks(user_a) where status = 'active';
create index if not exists duo_streaks_user_b_idx on public.duo_streaks(user_b) where status = 'active';

alter table public.duo_streaks enable row level security;

drop trigger if exists duo_streaks_set_updated_at on public.duo_streaks;
create trigger duo_streaks_set_updated_at
before update on public.duo_streaks
for each row
execute function public.set_updated_at();

drop policy if exists "Members can read their duo streaks" on public.duo_streaks;
create policy "Members can read their duo streaks"
on public.duo_streaks
for select
to authenticated
using ((select auth.uid()) in (user_a, user_b));

-- ---------------------------------------------------------------------------
-- duo_streak_invites
-- ---------------------------------------------------------------------------

create table if not exists public.duo_streak_invites (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> recipient_id)
);

create index if not exists duo_streak_invites_recipient_idx
on public.duo_streak_invites(recipient_id, status);

create index if not exists duo_streak_invites_sender_idx
on public.duo_streak_invites(sender_id, status);

alter table public.duo_streak_invites enable row level security;

drop policy if exists "Participants can read duo streak invites" on public.duo_streak_invites;
create policy "Participants can read duo streak invites"
on public.duo_streak_invites
for select
to authenticated
using ((select auth.uid()) in (sender_id, recipient_id));

-- ---------------------------------------------------------------------------
-- duo_streak_nudges: fixed app-authored encouragement pings
-- ---------------------------------------------------------------------------

create table if not exists public.duo_streak_nudges (
  id uuid primary key default gen_random_uuid(),
  duo_streak_id uuid not null references public.duo_streaks(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sent_on date not null default current_date,
  created_at timestamptz not null default now(),
  -- Rate limit: one nudge per streak per sender per day.
  unique (duo_streak_id, sender_id, sent_on)
);

alter table public.duo_streak_nudges enable row level security;

drop policy if exists "Members can read duo streak nudges" on public.duo_streak_nudges;
create policy "Members can read duo streak nudges"
on public.duo_streak_nudges
for select
to authenticated
using (
  exists (
    select 1
    from public.duo_streaks
    where duo_streaks.id = duo_streak_nudges.duo_streak_id
      and (select auth.uid()) in (duo_streaks.user_a, duo_streaks.user_b)
  )
);

-- ---------------------------------------------------------------------------
-- Trigger: advance personal + duo streaks on every quest completion
-- ---------------------------------------------------------------------------

create or replace function public.apply_streak_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  duo record;
  partner_last date;
  both_done boolean;
begin
  -- Personal streak.
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

  -- Duo streaks this user belongs to.
  for duo in
    select *
    from public.duo_streaks
    where status = 'active'
      and (user_a = new.user_id or user_b = new.user_id)
  loop
    if duo.user_a = new.user_id then
      partner_last := duo.last_completed_b;
      update public.duo_streaks set last_completed_a = new.completed_on where id = duo.id;
    else
      partner_last := duo.last_completed_a;
      update public.duo_streaks set last_completed_b = new.completed_on where id = duo.id;
    end if;

    both_done := partner_last is not null and partner_last >= new.completed_on;

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

drop trigger if exists quest_completions_apply_streak_progress on public.quest_completions;
create trigger quest_completions_apply_streak_progress
after insert on public.quest_completions
for each row
execute function public.apply_streak_progress();

-- ---------------------------------------------------------------------------
-- RPC: send a duo streak invite (friendship + cooldown checks)
-- ---------------------------------------------------------------------------

create or replace function public.send_duo_streak_invite(p_recipient uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  invite_id uuid;
  cooldown_ends timestamptz;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_recipient = current_user_id then
    raise exception 'You cannot start a streak with yourself.';
  end if;

  if not public.are_friends(current_user_id, p_recipient) then
    raise exception 'You can only start streaks with friends.';
  end if;

  if exists (
    select 1 from public.duo_streaks
    where status = 'active'
      and user_a = least(current_user_id, p_recipient)
      and user_b = greatest(current_user_id, p_recipient)
  ) then
    raise exception 'You already have an active streak with this friend.';
  end if;

  if exists (
    select 1 from public.duo_streak_invites
    where status = 'pending'
      and ((sender_id = current_user_id and recipient_id = p_recipient)
        or (sender_id = p_recipient and recipient_id = current_user_id))
  ) then
    raise exception 'There is already a pending streak invite between you two.';
  end if;

  select max(responded_at) + interval '24 hours'
  into cooldown_ends
  from public.duo_streak_invites
  where sender_id = current_user_id
    and recipient_id = p_recipient
    and status = 'declined';

  if cooldown_ends is not null and cooldown_ends > now() then
    raise exception 'This friend passed recently. You can invite them again in a bit.';
  end if;

  insert into public.duo_streak_invites (sender_id, recipient_id)
  values (current_user_id, p_recipient)
  returning id into invite_id;

  return invite_id;
end;
$$;

grant execute on function public.send_duo_streak_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: respond to a duo streak invite
-- ---------------------------------------------------------------------------

create or replace function public.respond_duo_streak_invite(p_invite_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  invite record;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into invite
  from public.duo_streak_invites
  where id = p_invite_id
    and recipient_id = current_user_id
    and status = 'pending';

  if invite.id is null then
    raise exception 'This invite is no longer available.';
  end if;

  update public.duo_streak_invites
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = invite.id;

  if p_accept then
    insert into public.duo_streaks (user_a, user_b)
    values (
      least(invite.sender_id, invite.recipient_id),
      greatest(invite.sender_id, invite.recipient_id)
    )
    on conflict do nothing;
  end if;
end;
$$;

grant execute on function public.respond_duo_streak_invite(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: cancel an outgoing pending invite
-- ---------------------------------------------------------------------------

create or replace function public.cancel_duo_streak_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.duo_streak_invites
  set status = 'cancelled',
      responded_at = now()
  where id = p_invite_id
    and sender_id = current_user_id
    and status = 'pending';
end;
$$;

grant execute on function public.cancel_duo_streak_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: end (leave) a duo streak
-- ---------------------------------------------------------------------------

create or replace function public.end_duo_streak(p_streak_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.duo_streaks
  set status = 'ended',
      ended_at = now()
  where id = p_streak_id
    and status = 'active'
    and current_user_id in (user_a, user_b);
end;
$$;

grant execute on function public.end_duo_streak(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: send an encouragement nudge (one per streak per sender per day)
-- ---------------------------------------------------------------------------

create or replace function public.send_duo_streak_nudge(p_streak_id uuid, p_today date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  duo record;
  partner_done boolean;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into duo
  from public.duo_streaks
  where id = p_streak_id
    and status = 'active'
    and current_user_id in (user_a, user_b);

  if duo.id is null then
    raise exception 'This streak is no longer active.';
  end if;

  if duo.user_a = current_user_id then
    partner_done := duo.last_completed_b is not null and duo.last_completed_b >= p_today;
  else
    partner_done := duo.last_completed_a is not null and duo.last_completed_a >= p_today;
  end if;

  if partner_done then
    raise exception 'Your partner already quested today. The streak is safe!';
  end if;

  insert into public.duo_streak_nudges (duo_streak_id, sender_id, sent_on)
  values (p_streak_id, current_user_id, p_today)
  on conflict (duo_streak_id, sender_id, sent_on) do nothing;
end;
$$;

grant execute on function public.send_duo_streak_nudge(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: streak overview for the streak screen
-- ---------------------------------------------------------------------------
-- Returns everything the streak screen needs in one round trip. `p_today` is
-- the caller's local calendar date so "done today" and effective streaks line
-- up with the user's midnight.

create or replace function public.get_streak_overview(p_today date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  current_user_id uuid := auth.uid();
  personal jsonb;
  friends jsonb;
  duos jsonb;
  incoming jsonb;
  outgoing jsonb;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select jsonb_build_object(
    'currentStreak', case
      when streaks.last_quest_on >= p_today - 1 then streaks.current_streak
      else 0
    end,
    'longestStreak', streaks.longest_streak,
    'lastQuestOn', streaks.last_quest_on,
    'streakStartedOn', case
      when streaks.last_quest_on >= p_today - 1 then streaks.streak_started_on
      else null
    end,
    'questedToday', streaks.last_quest_on = p_today,
    'streakVisibility', prof.streak_visibility
  )
  into personal
  from (select 1) as one
  left join public.user_streaks streaks on streaks.user_id = current_user_id
  left join public.profiles prof on prof.id = current_user_id;

  select coalesce(jsonb_agg(friend_row order by friend_row->>'displayName'), '[]'::jsonb)
  into friends
  from (
    select jsonb_build_object(
      'userId', prof.id,
      'displayName', coalesce(prof.display_name, 'Adventurer'),
      'avatarUrl', prof.avatar_url,
      'streakVisible', prof.streak_visibility = 'public',
      'currentStreak', case
        when prof.streak_visibility = 'public' and streaks.last_quest_on >= p_today - 1 then streaks.current_streak
        when prof.streak_visibility = 'public' then 0
        else null
      end,
      'longestStreak', case
        when prof.streak_visibility = 'public' then coalesce(streaks.longest_streak, 0)
        else null
      end,
      'questedToday', case
        when prof.streak_visibility = 'public' then coalesce(streaks.last_quest_on = p_today, false)
        else null
      end,
      'duoStatus', case
        when exists (
          select 1 from public.duo_streaks ds
          where ds.status = 'active'
            and ds.user_a = least(current_user_id, prof.id)
            and ds.user_b = greatest(current_user_id, prof.id)
        ) then 'active'
        when exists (
          select 1 from public.duo_streak_invites inv
          where inv.status = 'pending'
            and ((inv.sender_id = current_user_id and inv.recipient_id = prof.id)
              or (inv.sender_id = prof.id and inv.recipient_id = current_user_id))
        ) then 'pending'
        when exists (
          select 1 from public.duo_streak_invites inv
          where inv.status = 'declined'
            and inv.sender_id = current_user_id
            and inv.recipient_id = prof.id
            and inv.responded_at + interval '24 hours' > now()
        ) then 'cooldown'
        else 'available'
      end,
      'cooldownUntil', (
        select max(inv.responded_at + interval '24 hours')
        from public.duo_streak_invites inv
        where inv.status = 'declined'
          and inv.sender_id = current_user_id
          and inv.recipient_id = prof.id
          and inv.responded_at + interval '24 hours' > now()
      )
    ) as friend_row
    from public.friendships fr
    join public.profiles prof
      on prof.id = case when fr.user_a = current_user_id then fr.user_b else fr.user_a end
    left join public.user_streaks streaks on streaks.user_id = prof.id
    where current_user_id in (fr.user_a, fr.user_b)
  ) as friend_rows;

  select coalesce(jsonb_agg(duo_row order by duo_row->>'startedOn'), '[]'::jsonb)
  into duos
  from (
    select jsonb_build_object(
      'id', ds.id,
      'partnerId', prof.id,
      'partnerName', coalesce(prof.display_name, 'Adventurer'),
      'partnerAvatarUrl', prof.avatar_url,
      'currentStreak', case
        when ds.last_advanced_on >= p_today - 1 then ds.current_streak
        else 0
      end,
      'longestStreak', ds.longest_streak,
      'startedOn', ds.started_on,
      'lastAdvancedOn', ds.last_advanced_on,
      'myDoneToday', case
        when ds.user_a = current_user_id then coalesce(ds.last_completed_a = p_today, false)
        else coalesce(ds.last_completed_b = p_today, false)
      end,
      'partnerDoneToday', case
        when ds.user_a = current_user_id then coalesce(ds.last_completed_b = p_today, false)
        else coalesce(ds.last_completed_a = p_today, false)
      end,
      'nudgeSentToday', exists (
        select 1 from public.duo_streak_nudges n
        where n.duo_streak_id = ds.id and n.sender_id = current_user_id and n.sent_on = p_today
      ),
      'nudgeReceivedToday', exists (
        select 1 from public.duo_streak_nudges n
        where n.duo_streak_id = ds.id and n.sender_id = prof.id and n.sent_on = p_today
      )
    ) as duo_row
    from public.duo_streaks ds
    join public.profiles prof
      on prof.id = case when ds.user_a = current_user_id then ds.user_b else ds.user_a end
    where ds.status = 'active'
      and current_user_id in (ds.user_a, ds.user_b)
  ) as duo_rows;

  select coalesce(jsonb_agg(invite_row order by invite_row->>'createdAt' desc), '[]'::jsonb)
  into incoming
  from (
    select jsonb_build_object(
      'id', inv.id,
      'senderId', inv.sender_id,
      'senderName', coalesce(prof.display_name, 'Adventurer'),
      'senderAvatarUrl', prof.avatar_url,
      'createdAt', inv.created_at
    ) as invite_row
    from public.duo_streak_invites inv
    join public.profiles prof on prof.id = inv.sender_id
    where inv.recipient_id = current_user_id
      and inv.status = 'pending'
  ) as invite_rows;

  select coalesce(jsonb_agg(invite_row order by invite_row->>'createdAt' desc), '[]'::jsonb)
  into outgoing
  from (
    select jsonb_build_object(
      'id', inv.id,
      'recipientId', inv.recipient_id,
      'recipientName', coalesce(prof.display_name, 'Adventurer'),
      'recipientAvatarUrl', prof.avatar_url,
      'status', inv.status,
      'createdAt', inv.created_at,
      'respondedAt', inv.responded_at,
      'cooldownUntil', case
        when inv.status = 'declined' then inv.responded_at + interval '24 hours'
        else null
      end
    ) as invite_row
    from public.duo_streak_invites inv
    join public.profiles prof on prof.id = inv.recipient_id
    where inv.sender_id = current_user_id
      and (
        inv.status = 'pending'
        or (inv.status = 'declined' and inv.responded_at > now() - interval '7 days')
      )
  ) as invite_rows;

  return jsonb_build_object(
    'personal', personal,
    'friends', friends,
    'duoStreaks', duos,
    'incomingInvites', incoming,
    'outgoingInvites', outgoing
  );
end;
$$;

grant execute on function public.get_streak_overview(date) to authenticated;
