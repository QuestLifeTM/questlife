-- Profile images are the canonical representation of a person across social
-- surfaces. The legacy emoji/color values stay in these payloads for older
-- clients, while every avatar-capable read model now carries avatarUrl.

create or replace function public.friend_discovery_profile(p_target uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'userId', prof.id,
    'username', prof.username,
    'displayName', coalesce(prof.display_name, 'Adventurer'),
    'avatarUrl', prof.avatar_url,
    'emoji', prof.emoji,
    'avatarColor', prof.avatar_color,
    'isFriend', public.are_friends(auth.uid(), prof.id),
    'requestStatus', (
      select request.status || ':' || case when request.sender_id = auth.uid() then 'outgoing' else 'incoming' end
      from public.friend_requests request
      where request.status = 'pending'
        and ((request.sender_id = auth.uid() and request.recipient_id = prof.id)
          or (request.sender_id = prof.id and request.recipient_id = auth.uid()))
      order by request.created_at desc
      limit 1
    )
  )
  from public.profiles prof
  where prof.id = p_target;
$$;

-- Keep the existing overview logic intact and enrich each person-shaped part
-- of the JSON response. This means profile changes propagate without changing
-- friend, invite, or Party behavior.
alter function public.get_social_overview(date) rename to get_social_overview_avatar_base;

create function public.get_social_overview(p_today date default current_date)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with payload as (
    select public.get_social_overview_avatar_base(p_today) as data
  )
  select data || jsonb_build_object(
    'me', coalesce(data->'me', '{}'::jsonb) || jsonb_build_object(
      'avatarUrl', (select avatar_url from public.profiles where id = auth.uid())
    ),
    'friends', coalesce((
      select jsonb_agg(item.value || jsonb_build_object('avatarUrl', profile.avatar_url) order by item.ordinality)
      from jsonb_array_elements(coalesce(data->'friends', '[]'::jsonb)) with ordinality item(value, ordinality)
      join public.profiles profile on profile.id = (item.value->>'userId')::uuid
    ), '[]'::jsonb),
    'incomingRequests', coalesce((
      select jsonb_agg(item.value || jsonb_build_object('avatarUrl', profile.avatar_url) order by item.ordinality)
      from jsonb_array_elements(coalesce(data->'incomingRequests', '[]'::jsonb)) with ordinality item(value, ordinality)
      join public.profiles profile on profile.id = (item.value->>'userId')::uuid
    ), '[]'::jsonb),
    'outgoingRequests', coalesce((
      select jsonb_agg(item.value || jsonb_build_object('avatarUrl', profile.avatar_url) order by item.ordinality)
      from jsonb_array_elements(coalesce(data->'outgoingRequests', '[]'::jsonb)) with ordinality item(value, ordinality)
      join public.profiles profile on profile.id = (item.value->>'userId')::uuid
    ), '[]'::jsonb),
    'parties', coalesce((
      select jsonb_agg(item.value || jsonb_build_object('members', coalesce((
        select jsonb_agg(member.value || jsonb_build_object('avatarUrl', profile.avatar_url) order by member.ordinality)
        from jsonb_array_elements(coalesce(item.value->'members', '[]'::jsonb)) with ordinality member(value, ordinality)
        join public.profiles profile on profile.id = (member.value->>'userId')::uuid
      ), '[]'::jsonb)) order by item.ordinality)
      from jsonb_array_elements(coalesce(data->'parties', '[]'::jsonb)) with ordinality item(value, ordinality)
    ), '[]'::jsonb)
  )
  from payload;
$$;

revoke execute on function public.get_social_overview_avatar_base(date) from public, anon, authenticated;
revoke execute on function public.get_social_overview(date) from public, anon;
grant execute on function public.get_social_overview(date) to authenticated;

-- The current Party detail function is a layered wrapper. Preserve its output
-- and replace only the person-shaped arrays with avatar-aware versions.
alter function public.get_party_detail(uuid) rename to get_party_detail_avatar_base;

create function public.get_party_detail(p_party_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with payload as (
    select public.get_party_detail_avatar_base(p_party_id) as data
  )
  select data || jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(item.value || jsonb_build_object('avatarUrl', profile.avatar_url) order by item.ordinality)
      from jsonb_array_elements(coalesce(data->'members', '[]'::jsonb)) with ordinality item(value, ordinality)
      join public.profiles profile on profile.id = (item.value->>'userId')::uuid
    ), '[]'::jsonb),
    'leaderboard', coalesce((
      select jsonb_agg(item.value || jsonb_build_object('avatarUrl', profile.avatar_url) order by item.ordinality)
      from jsonb_array_elements(coalesce(data->'leaderboard', '[]'::jsonb)) with ordinality item(value, ordinality)
      join public.profiles profile on profile.id = (item.value->>'userId')::uuid
    ), '[]'::jsonb),
    'feed', coalesce((
      select jsonb_agg(item.value || jsonb_build_object('userAvatarUrl', profile.avatar_url) order by item.ordinality)
      from jsonb_array_elements(coalesce(data->'feed', '[]'::jsonb)) with ordinality item(value, ordinality)
      join public.party_feed_posts post on post.id = (item.value->>'id')::uuid
      join public.profiles profile on profile.id = post.user_id
    ), '[]'::jsonb),
    'activeRound', case when coalesce(data->'activeRound', 'null'::jsonb) = 'null'::jsonb then null else
      data->'activeRound' || jsonb_build_object('topFinishers', coalesce((
        select jsonb_agg(item.value || jsonb_build_object('avatarUrl', profile.avatar_url) order by item.ordinality)
        from jsonb_array_elements(coalesce(data->'activeRound'->'topFinishers', '[]'::jsonb)) with ordinality item(value, ordinality)
        join public.profiles profile on profile.id = (item.value->>'userId')::uuid
      ), '[]'::jsonb)) end
  )
  from payload;
$$;

revoke execute on function public.get_party_detail_avatar_base(uuid) from public, anon, authenticated;
revoke execute on function public.get_party_detail(uuid) from public, anon;
grant execute on function public.get_party_detail(uuid) to authenticated;

create or replace function public.get_party_detail_live(p_party_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select public.get_party_detail(p_party_id) || jsonb_build_object(
    'partyStartedAt', case
      when party.game_mode = 'free_for_all' and party.quests_enabled then party.quests_enabled_at
      when party.game_mode = 'everyone_together' then (
        select round.started_at from public.party_quest_rounds round
        where round.party_id = party.id and round.status = 'active'
        order by round.started_at desc limit 1
      )
      else null
    end
  )
  from public.parties party where party.id = p_party_id;
$$;

revoke execute on function public.get_party_detail_live(uuid) from public, anon;
grant execute on function public.get_party_detail_live(uuid) to authenticated;
