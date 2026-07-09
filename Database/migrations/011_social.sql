-- Social system: friend requests + search, quest shares, quest challenges,
-- and party quests with two game modes ("together" co-op and "relay" where
-- any one member can clear each quest).
--
-- All cross-user writes go through security-definer RPCs. Raw tables only
-- allow participants to read their own rows.

-- ---------------------------------------------------------------------------
-- friend_requests
-- ---------------------------------------------------------------------------

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> recipient_id)
);

create index if not exists friend_requests_recipient_idx on public.friend_requests(recipient_id, status);
create index if not exists friend_requests_sender_idx on public.friend_requests(sender_id, status);

alter table public.friend_requests enable row level security;

drop policy if exists "Participants can read friend requests" on public.friend_requests;
create policy "Participants can read friend requests"
on public.friend_requests
for select
to authenticated
using ((select auth.uid()) in (sender_id, recipient_id));

-- ---------------------------------------------------------------------------
-- RPC: search profiles by username or display name
-- ---------------------------------------------------------------------------

create or replace function public.search_profiles(p_query text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  current_user_id uuid := auth.uid();
  results jsonb;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if length(trim(coalesce(p_query, ''))) < 2 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(row), '[]'::jsonb)
  into results
  from (
    select jsonb_build_object(
      'userId', prof.id,
      'username', prof.username,
      'displayName', coalesce(prof.display_name, 'Adventurer'),
      'emoji', prof.emoji,
      'avatarColor', prof.avatar_color,
      'isFriend', public.are_friends(current_user_id, prof.id),
      'requestStatus', (
        select fr.status || ':' || case when fr.sender_id = current_user_id then 'outgoing' else 'incoming' end
        from public.friend_requests fr
        where fr.status = 'pending'
          and ((fr.sender_id = current_user_id and fr.recipient_id = prof.id)
            or (fr.sender_id = prof.id and fr.recipient_id = current_user_id))
        limit 1
      )
    ) as row
    from public.profiles prof
    where prof.id <> current_user_id
      and (
        prof.username ilike '%' || trim(p_query) || '%'
        or prof.display_name ilike '%' || trim(p_query) || '%'
      )
    limit 12
  ) as rows;

  return results;
end;
$$;

grant execute on function public.search_profiles(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: send / respond / remove friend
-- ---------------------------------------------------------------------------

create or replace function public.send_friend_request(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_user = current_user_id then
    raise exception 'You cannot add yourself.';
  end if;

  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'This adventurer does not exist.';
  end if;

  if public.are_friends(current_user_id, p_user) then
    raise exception 'You are already friends.';
  end if;

  -- If they already sent you a request, accept it instead of duplicating.
  select id into request_id
  from public.friend_requests
  where sender_id = p_user and recipient_id = current_user_id and status = 'pending';

  if request_id is not null then
    perform public.respond_friend_request(request_id, true);
    return request_id;
  end if;

  if exists (
    select 1 from public.friend_requests
    where sender_id = current_user_id and recipient_id = p_user and status = 'pending'
  ) then
    raise exception 'Friend request already sent.';
  end if;

  insert into public.friend_requests (sender_id, recipient_id)
  values (current_user_id, p_user)
  returning id into request_id;

  return request_id;
end;
$$;

grant execute on function public.send_friend_request(uuid) to authenticated;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request record;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into request
  from public.friend_requests
  where id = p_request_id
    and recipient_id = current_user_id
    and status = 'pending';

  if request.id is null then
    raise exception 'This friend request is no longer available.';
  end if;

  update public.friend_requests
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = request.id;

  if p_accept then
    insert into public.friendships (user_a, user_b)
    values (least(request.sender_id, request.recipient_id), greatest(request.sender_id, request.recipient_id))
    on conflict do nothing;
  end if;
end;
$$;

grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.friend_requests
  set status = 'cancelled', responded_at = now()
  where id = p_request_id
    and sender_id = auth.uid()
    and status = 'pending';
end;
$$;

grant execute on function public.cancel_friend_request(uuid) to authenticated;

create or replace function public.remove_friend(p_user uuid)
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

  delete from public.friendships
  where user_a = least(current_user_id, p_user)
    and user_b = greatest(current_user_id, p_user);

  -- End any active duo streak with this person.
  update public.duo_streaks
  set status = 'ended', ended_at = now()
  where status = 'active'
    and user_a = least(current_user_id, p_user)
    and user_b = greatest(current_user_id, p_user);
end;
$$;

grant execute on function public.remove_friend(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- quest_shares: send a quest to a friend
-- ---------------------------------------------------------------------------

create table if not exists public.quest_shares (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  message text,
  seen_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists quest_shares_recipient_idx on public.quest_shares(recipient_id, created_at desc);

alter table public.quest_shares enable row level security;

drop policy if exists "Participants can read quest shares" on public.quest_shares;
create policy "Participants can read quest shares"
on public.quest_shares
for select
to authenticated
using ((select auth.uid()) in (sender_id, recipient_id));

drop policy if exists "Recipients can mark shares seen" on public.quest_shares;
create policy "Recipients can mark shares seen"
on public.quest_shares
for update
to authenticated
using ((select auth.uid()) = recipient_id)
with check ((select auth.uid()) = recipient_id);

create or replace function public.share_quest(p_recipient uuid, p_quest_id uuid, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  share_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.are_friends(current_user_id, p_recipient) then
    raise exception 'You can only share quests with friends.';
  end if;

  if not exists (select 1 from public.quests where id = p_quest_id and status = 'published') then
    raise exception 'This quest is not available.';
  end if;

  insert into public.quest_shares (sender_id, recipient_id, quest_id, message)
  values (current_user_id, p_recipient, p_quest_id, nullif(trim(coalesce(p_message, '')), ''))
  returning id into share_id;

  return share_id;
end;
$$;

grant execute on function public.share_quest(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- quest_challenges: challenge a friend to do the same quest
-- ---------------------------------------------------------------------------

create table if not exists public.quest_challenges (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> recipient_id)
);

create index if not exists quest_challenges_recipient_idx on public.quest_challenges(recipient_id, status);
create index if not exists quest_challenges_sender_idx on public.quest_challenges(sender_id, status);

alter table public.quest_challenges enable row level security;

drop policy if exists "Participants can read quest challenges" on public.quest_challenges;
create policy "Participants can read quest challenges"
on public.quest_challenges
for select
to authenticated
using ((select auth.uid()) in (sender_id, recipient_id));

create or replace function public.send_quest_challenge(p_recipient uuid, p_quest_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  challenge_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.are_friends(current_user_id, p_recipient) then
    raise exception 'You can only challenge friends.';
  end if;

  if not exists (select 1 from public.quests where id = p_quest_id and status = 'published') then
    raise exception 'This quest is not available.';
  end if;

  if exists (
    select 1 from public.quest_challenges
    where quest_id = p_quest_id
      and status in ('pending', 'accepted')
      and ((sender_id = current_user_id and recipient_id = p_recipient)
        or (sender_id = p_recipient and recipient_id = current_user_id))
  ) then
    raise exception 'There is already a challenge for this quest between you two.';
  end if;

  insert into public.quest_challenges (sender_id, recipient_id, quest_id)
  values (current_user_id, p_recipient, p_quest_id)
  returning id into challenge_id;

  return challenge_id;
end;
$$;

grant execute on function public.send_quest_challenge(uuid, uuid) to authenticated;

create or replace function public.respond_quest_challenge(p_challenge_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.quest_challenges
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_challenge_id
    and recipient_id = auth.uid()
    and status = 'pending';
end;
$$;

grant execute on function public.respond_quest_challenge(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- parties: group questing with game modes
-- ---------------------------------------------------------------------------

create table if not exists public.parties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '🏕️',
  accent_color text not null default '#4da8ff',
  game_mode text not null default 'together' check (game_mode in ('together', 'relay')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.parties enable row level security;

drop trigger if exists parties_set_updated_at on public.parties;
create trigger parties_set_updated_at
before update on public.parties
for each row
execute function public.set_updated_at();

create table if not exists public.party_members (
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create index if not exists party_members_user_idx on public.party_members(user_id);

alter table public.party_members enable row level security;

create or replace function public.is_party_member(p_party_id uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.party_members
    where party_id = p_party_id and user_id = p_user
  );
$$;

drop policy if exists "Members can read their parties" on public.parties;
create policy "Members can read their parties"
on public.parties
for select
to authenticated
using (public.is_party_member(id, (select auth.uid())));

drop policy if exists "Members can read party members" on public.party_members;
create policy "Members can read party members"
on public.party_members
for select
to authenticated
using (public.is_party_member(party_id, (select auth.uid())));

create table if not exists public.party_invites (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists party_invites_recipient_idx on public.party_invites(recipient_id, status);

alter table public.party_invites enable row level security;

drop policy if exists "Participants can read party invites" on public.party_invites;
create policy "Participants can read party invites"
on public.party_invites
for select
to authenticated
using ((select auth.uid()) in (sender_id, recipient_id));

create table if not exists public.party_quests (
  party_id uuid not null references public.parties(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  position integer not null default 0,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (party_id, quest_id)
);

alter table public.party_quests enable row level security;

drop policy if exists "Members can read party quests" on public.party_quests;
create policy "Members can read party quests"
on public.party_quests
for select
to authenticated
using (public.is_party_member(party_id, (select auth.uid())));

drop policy if exists "Members can manage party quests" on public.party_quests;
create policy "Members can manage party quests"
on public.party_quests
for all
to authenticated
using (public.is_party_member(party_id, (select auth.uid())))
with check (public.is_party_member(party_id, (select auth.uid())));

create or replace function public.create_party(
  p_name text,
  p_emoji text default '🏕️',
  p_accent_color text default '#4da8ff',
  p_game_mode text default 'together'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  party_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Give your party a name.';
  end if;

  insert into public.parties (name, emoji, accent_color, game_mode, created_by)
  values (trim(p_name), coalesce(nullif(p_emoji, ''), '🏕️'), p_accent_color, p_game_mode, current_user_id)
  returning id into party_id;

  insert into public.party_members (party_id, user_id, role)
  values (party_id, current_user_id, 'leader');

  return party_id;
end;
$$;

grant execute on function public.create_party(text, text, text, text) to authenticated;

create or replace function public.invite_to_party(p_party_id uuid, p_recipient uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  invite_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_party_member(p_party_id, current_user_id) then
    raise exception 'Only party members can invite friends.';
  end if;

  if not public.are_friends(current_user_id, p_recipient) then
    raise exception 'You can only invite friends to a party.';
  end if;

  if public.is_party_member(p_party_id, p_recipient) then
    raise exception 'They are already in this party.';
  end if;

  if exists (
    select 1 from public.party_invites
    where party_id = p_party_id and recipient_id = p_recipient and status = 'pending'
  ) then
    raise exception 'They already have a pending invite to this party.';
  end if;

  insert into public.party_invites (party_id, sender_id, recipient_id)
  values (p_party_id, current_user_id, p_recipient)
  returning id into invite_id;

  return invite_id;
end;
$$;

grant execute on function public.invite_to_party(uuid, uuid) to authenticated;

create or replace function public.respond_party_invite(p_invite_id uuid, p_accept boolean)
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
  from public.party_invites
  where id = p_invite_id
    and recipient_id = current_user_id
    and status = 'pending';

  if invite.id is null then
    raise exception 'This invite is no longer available.';
  end if;

  update public.party_invites
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = invite.id;

  if p_accept then
    insert into public.party_members (party_id, user_id)
    values (invite.party_id, current_user_id)
    on conflict do nothing;
  end if;
end;
$$;

grant execute on function public.respond_party_invite(uuid, boolean) to authenticated;

create or replace function public.leave_party(p_party_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  remaining integer;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.party_members
  where party_id = p_party_id and user_id = current_user_id;

  select count(*) into remaining from public.party_members where party_id = p_party_id;

  if remaining = 0 then
    delete from public.parties where id = p_party_id;
  end if;
end;
$$;

grant execute on function public.leave_party(uuid) to authenticated;

create or replace function public.set_party_quests(p_party_id uuid, p_quest_ids uuid[])
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

  if not public.is_party_member(p_party_id, current_user_id) then
    raise exception 'Only party members can update the quest list.';
  end if;

  delete from public.party_quests where party_id = p_party_id;

  insert into public.party_quests (party_id, quest_id, position, added_by)
  select p_party_id, quest_id, ordinality - 1, current_user_id
  from unnest(p_quest_ids) with ordinality as list(quest_id, ordinality);
end;
$$;

grant execute on function public.set_party_quests(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: everything the Social tab needs in one round trip
-- ---------------------------------------------------------------------------

create or replace function public.get_social_overview(p_today date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  current_user_id uuid := auth.uid();
  me jsonb;
  friends jsonb;
  incoming_requests jsonb;
  outgoing_requests jsonb;
  shares jsonb;
  incoming_challenges jsonb;
  active_challenges jsonb;
  party_invites_json jsonb;
  parties_json jsonb;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select jsonb_build_object(
    'userId', prof.id,
    'username', prof.username,
    'displayName', coalesce(prof.display_name, 'Adventurer'),
    'emoji', prof.emoji,
    'avatarColor', prof.avatar_color
  )
  into me
  from public.profiles prof
  where prof.id = current_user_id;

  select coalesce(jsonb_agg(row order by row->>'displayName'), '[]'::jsonb)
  into friends
  from (
    select jsonb_build_object(
      'userId', prof.id,
      'username', prof.username,
      'displayName', coalesce(prof.display_name, 'Adventurer'),
      'emoji', prof.emoji,
      'avatarColor', prof.avatar_color,
      'totalXp', prof.total_xp,
      'currentStreak', case
        when prof.streak_visibility = 'public' and streaks.last_quest_on >= p_today - 1 then streaks.current_streak
        when prof.streak_visibility = 'public' then 0
        else null
      end,
      'questedToday', case
        when prof.streak_visibility = 'public' then coalesce(streaks.last_quest_on = p_today, false)
        else null
      end,
      'lastQuestTitle', (
        select q.title
        from public.quest_completions c
        join public.quests q on q.id = c.quest_id
        where c.user_id = prof.id
        order by c.created_at desc
        limit 1
      ),
      'lastQuestAt', (
        select c.created_at
        from public.quest_completions c
        where c.user_id = prof.id
        order by c.created_at desc
        limit 1
      )
    ) as row
    from public.friendships fr
    join public.profiles prof
      on prof.id = case when fr.user_a = current_user_id then fr.user_b else fr.user_a end
    left join public.user_streaks streaks on streaks.user_id = prof.id
    where current_user_id in (fr.user_a, fr.user_b)
  ) as rows;

  select coalesce(jsonb_agg(row order by row->>'createdAt' desc), '[]'::jsonb)
  into incoming_requests
  from (
    select jsonb_build_object(
      'id', fr.id,
      'userId', prof.id,
      'username', prof.username,
      'displayName', coalesce(prof.display_name, 'Adventurer'),
      'emoji', prof.emoji,
      'avatarColor', prof.avatar_color,
      'createdAt', fr.created_at
    ) as row
    from public.friend_requests fr
    join public.profiles prof on prof.id = fr.sender_id
    where fr.recipient_id = current_user_id and fr.status = 'pending'
  ) as rows;

  select coalesce(jsonb_agg(row order by row->>'createdAt' desc), '[]'::jsonb)
  into outgoing_requests
  from (
    select jsonb_build_object(
      'id', fr.id,
      'userId', prof.id,
      'username', prof.username,
      'displayName', coalesce(prof.display_name, 'Adventurer'),
      'emoji', prof.emoji,
      'avatarColor', prof.avatar_color,
      'createdAt', fr.created_at
    ) as row
    from public.friend_requests fr
    join public.profiles prof on prof.id = fr.recipient_id
    where fr.sender_id = current_user_id and fr.status = 'pending'
  ) as rows;

  select coalesce(jsonb_agg(row order by row->>'createdAt' desc), '[]'::jsonb)
  into shares
  from (
    select jsonb_build_object(
      'id', sh.id,
      'senderId', prof.id,
      'senderName', coalesce(prof.display_name, 'Adventurer'),
      'senderEmoji', prof.emoji,
      'questId', sh.quest_id,
      'questTitle', q.title,
      'message', sh.message,
      'seen', sh.seen_at is not null,
      'createdAt', sh.created_at
    ) as row
    from public.quest_shares sh
    join public.profiles prof on prof.id = sh.sender_id
    join public.quests q on q.id = sh.quest_id
    where sh.recipient_id = current_user_id
    order by sh.created_at desc
    limit 20
  ) as rows;

  select coalesce(jsonb_agg(row order by row->>'createdAt' desc), '[]'::jsonb)
  into incoming_challenges
  from (
    select jsonb_build_object(
      'id', ch.id,
      'senderId', prof.id,
      'senderName', coalesce(prof.display_name, 'Adventurer'),
      'senderEmoji', prof.emoji,
      'questId', ch.quest_id,
      'questTitle', q.title,
      'questXp', q.experience_points,
      'createdAt', ch.created_at
    ) as row
    from public.quest_challenges ch
    join public.profiles prof on prof.id = ch.sender_id
    join public.quests q on q.id = ch.quest_id
    where ch.recipient_id = current_user_id and ch.status = 'pending'
  ) as rows;

  select coalesce(jsonb_agg(row order by row->>'createdAt' desc), '[]'::jsonb)
  into active_challenges
  from (
    select jsonb_build_object(
      'id', ch.id,
      'questId', ch.quest_id,
      'questTitle', q.title,
      'questXp', q.experience_points,
      'partnerId', prof.id,
      'partnerName', coalesce(prof.display_name, 'Adventurer'),
      'partnerEmoji', prof.emoji,
      'iCompleted', exists (
        select 1 from public.quest_completions c
        where c.user_id = current_user_id and c.quest_id = ch.quest_id
      ),
      'partnerCompleted', exists (
        select 1 from public.quest_completions c
        where c.user_id = prof.id and c.quest_id = ch.quest_id
      ),
      'isOutgoingPending', ch.status = 'pending' and ch.sender_id = current_user_id,
      'createdAt', ch.created_at
    ) as row
    from public.quest_challenges ch
    join public.profiles prof
      on prof.id = case when ch.sender_id = current_user_id then ch.recipient_id else ch.sender_id end
    join public.quests q on q.id = ch.quest_id
    where (ch.status = 'accepted' and current_user_id in (ch.sender_id, ch.recipient_id))
       or (ch.status = 'pending' and ch.sender_id = current_user_id)
  ) as rows;

  select coalesce(jsonb_agg(row order by row->>'createdAt' desc), '[]'::jsonb)
  into party_invites_json
  from (
    select jsonb_build_object(
      'id', pi.id,
      'partyId', p.id,
      'partyName', p.name,
      'partyEmoji', p.emoji,
      'senderName', coalesce(prof.display_name, 'Adventurer'),
      'createdAt', pi.created_at
    ) as row
    from public.party_invites pi
    join public.parties p on p.id = pi.party_id
    join public.profiles prof on prof.id = pi.sender_id
    where pi.recipient_id = current_user_id and pi.status = 'pending'
  ) as rows;

  select coalesce(jsonb_agg(row order by row->>'createdAt' desc), '[]'::jsonb)
  into parties_json
  from (
    select jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'emoji', p.emoji,
      'accentColor', p.accent_color,
      'gameMode', p.game_mode,
      'createdAt', p.created_at,
      'members', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'userId', prof.id,
          'displayName', coalesce(prof.display_name, 'Adventurer'),
          'emoji', prof.emoji,
          'avatarColor', prof.avatar_color,
          'role', pm.role
        ) order by pm.joined_at), '[]'::jsonb)
        from public.party_members pm
        join public.profiles prof on prof.id = pm.user_id
        where pm.party_id = p.id
      ),
      'quests', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'questId', pq.quest_id,
          'title', q.title,
          'xp', q.experience_points,
          'color', q.accent_color,
          'position', pq.position,
          'completedBy', (
            select coalesce(jsonb_agg(c.user_id), '[]'::jsonb)
            from public.quest_completions c
            join public.party_members pm2 on pm2.user_id = c.user_id and pm2.party_id = p.id
            where c.quest_id = pq.quest_id
              and c.created_at >= p.created_at
          )
        ) order by pq.position), '[]'::jsonb)
        from public.party_quests pq
        join public.quests q on q.id = pq.quest_id
        where pq.party_id = p.id
      )
    ) as row
    from public.parties p
    where public.is_party_member(p.id, current_user_id)
  ) as rows;

  return jsonb_build_object(
    'me', me,
    'friends', friends,
    'incomingRequests', incoming_requests,
    'outgoingRequests', outgoing_requests,
    'shares', shares,
    'incomingChallenges', incoming_challenges,
    'activeChallenges', active_challenges,
    'partyInvites', party_invites_json,
    'parties', parties_json
  );
end;
$$;

grant execute on function public.get_social_overview(date) to authenticated;
