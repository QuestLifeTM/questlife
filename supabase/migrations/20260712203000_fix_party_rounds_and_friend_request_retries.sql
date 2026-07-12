-- A shared Party quest can be played again after its earlier round has ended.
-- The previous full unique constraint also covered status = 'ended', which made
-- starting that later round fail with a duplicate-key error. Only a live round
-- needs exclusivity, and it is scoped to the Party rather than the quest.
alter table public.party_quest_rounds
  drop constraint if exists party_quest_rounds_party_id_quest_id_status_key;

create unique index if not exists party_quest_rounds_one_active_per_party_idx
  on public.party_quest_rounds (party_id)
  where status = 'active';

-- Sending an already-pending request is a no-op. This makes repeat taps and
-- delayed client refreshes safe instead of surfacing a database exception.
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

  select id into request_id
  from public.friend_requests
  where sender_id = p_user
    and recipient_id = current_user_id
    and status = 'pending';

  if request_id is not null then
    perform public.respond_friend_request(request_id, true);
    return request_id;
  end if;

  select id into request_id
  from public.friend_requests
  where sender_id = current_user_id
    and recipient_id = p_user
    and status = 'pending';

  if request_id is not null then
    return request_id;
  end if;

  insert into public.friend_requests (sender_id, recipient_id)
  values (current_user_id, p_user)
  returning id into request_id;

  return request_id;
end;
$$;

revoke execute on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
