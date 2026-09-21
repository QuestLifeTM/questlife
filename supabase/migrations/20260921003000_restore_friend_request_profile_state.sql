-- Public profile and discovery surfaces use the established friend-request
-- workflow. Keep the newer follow fields for compatibility, while returning
-- the pending-request state needed by the client.
create or replace function public.friend_discovery_profile(p_target uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'userId', profile.id,
    'username', profile.username,
    'displayName', coalesce(profile.display_name, 'Adventurer'),
    'avatarUrl', profile.avatar_url,
    'emoji', profile.emoji,
    'avatarColor', profile.avatar_color,
    'isFollowing', exists (
      select 1 from public.profile_follows follow
      where follow.follower_id = auth.uid() and follow.following_id = profile.id
    ),
    'followsYou', exists (
      select 1 from public.profile_follows follow
      where follow.follower_id = profile.id and follow.following_id = auth.uid()
    ),
    'isFriend', public.are_friends(auth.uid(), profile.id),
    'requestStatus', (
      select request.status || ':' || case when request.sender_id = auth.uid() then 'outgoing' else 'incoming' end
      from public.friend_requests request
      where request.status = 'pending'
        and ((request.sender_id = auth.uid() and request.recipient_id = profile.id)
          or (request.sender_id = profile.id and request.recipient_id = auth.uid()))
      order by request.created_at desc
      limit 1
    )
  )
  from public.profiles profile
  where profile.id = p_target;
$$;

create or replace function public.get_social_overview(p_today date default current_date)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with payload as (
    select public.get_social_overview_follow_base(p_today) as data
  )
  select data || jsonb_build_object(
    'incomingRequests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', request.id, 'userId', profile.id, 'username', profile.username,
        'displayName', coalesce(profile.display_name, 'Adventurer'),
        'avatarUrl', profile.avatar_url, 'emoji', profile.emoji,
        'avatarColor', profile.avatar_color, 'createdAt', request.created_at
      ) order by request.created_at desc)
      from public.friend_requests request
      join public.profiles profile on profile.id = request.sender_id
      where request.recipient_id = auth.uid() and request.status = 'pending'
    ), '[]'::jsonb),
    'outgoingRequests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', request.id, 'userId', profile.id, 'username', profile.username,
        'displayName', coalesce(profile.display_name, 'Adventurer'),
        'avatarUrl', profile.avatar_url, 'emoji', profile.emoji,
        'avatarColor', profile.avatar_color, 'createdAt', request.created_at
      ) order by request.created_at desc)
      from public.friend_requests request
      join public.profiles profile on profile.id = request.recipient_id
      where request.sender_id = auth.uid() and request.status = 'pending'
    ), '[]'::jsonb)
  )
  from payload;
$$;

revoke all on function public.friend_discovery_profile(uuid), public.get_social_overview(date) from public, anon;
grant execute on function public.friend_discovery_profile(uuid), public.get_social_overview(date) to authenticated;
