-- Friend discovery: suggestions, private contact matching, and QR/deep-link
-- profile cards. All profile data is returned through security-definer RPCs so
-- the existing profiles RLS policy remains intact.

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

create or replace function public.get_friend_suggestions()
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return coalesce((
    select jsonb_agg(row)
    from (
      select public.friend_discovery_profile(prof.id) as row
      from public.profiles prof
      where prof.id <> current_user_id
        and not public.are_friends(current_user_id, prof.id)
        and not exists (
          select 1
          from public.friend_requests request
          where request.status = 'pending'
            and ((request.sender_id = current_user_id and request.recipient_id = prof.id)
              or (request.sender_id = prof.id and request.recipient_id = current_user_id))
        )
      order by prof.total_xp desc, prof.created_at desc
      limit 24
    ) candidates
  ), '[]'::jsonb);
end;
$$;

create or replace function public.find_profiles_by_contact_emails(p_emails text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(array_length(p_emails, 1), 0) = 0 then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(row)
    from (
      select public.friend_discovery_profile(prof.id) as row
      from public.profiles prof
      where prof.id <> current_user_id
        and lower(prof.email) = any (array(select lower(trim(email)) from unnest(p_emails) as email))
      order by prof.display_name nulls last, prof.created_at desc
      limit 50
    ) matches
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_friend_profile(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_user = current_user_id then
    return public.friend_discovery_profile(p_user);
  end if;

  return public.friend_discovery_profile(p_user);
end;
$$;

revoke execute on function public.friend_discovery_profile(uuid) from public, anon;
revoke execute on function public.get_friend_suggestions() from public, anon;
revoke execute on function public.find_profiles_by_contact_emails(text[]) from public, anon;
revoke execute on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.friend_discovery_profile(uuid) to authenticated;
grant execute on function public.get_friend_suggestions() to authenticated;
grant execute on function public.find_profiles_by_contact_emails(text[]) to authenticated;
grant execute on function public.get_friend_profile(uuid) to authenticated;
