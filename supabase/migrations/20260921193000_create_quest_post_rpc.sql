-- Social posts are created from a completed quest. Keeping this authorization
-- check in one RPC avoids client-side RLS/schema drift blocking the composer.
create or replace function public.create_quest_post(
  p_completion_id uuid,
  p_quest_id uuid,
  p_post_title text default null,
  p_caption text default null,
  p_photo_urls text[] default '{}'::text[],
  p_duration_seconds integer default null,
  p_post_stats jsonb default '{}'::jsonb,
  p_visibility text default 'friends',
  p_comments_enabled boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_post_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_visibility not in ('public', 'friends', 'private') then
    raise exception 'POST_VISIBILITY_INVALID';
  end if;

  if p_duration_seconds is not null and p_duration_seconds < 0 then
    raise exception 'POST_DURATION_INVALID';
  end if;

  if jsonb_typeof(coalesce(p_post_stats, '{}'::jsonb)) <> 'object' then
    raise exception 'POST_STATS_INVALID';
  end if;

  if not exists (
    select 1
    from public.quest_completions completion
    where completion.id = p_completion_id
      and completion.quest_id = p_quest_id
      and completion.user_id = auth.uid()
  ) then
    raise exception 'COMPLETED_QUEST_NOT_FOUND';
  end if;

  insert into public.quest_posts (
    user_id, quest_id, completion_id, post_title, caption, photo_urls,
    duration_seconds, post_stats, visibility, comments_enabled
  ) values (
    auth.uid(), p_quest_id, p_completion_id, nullif(trim(p_post_title), ''),
    nullif(trim(p_caption), ''), coalesce(p_photo_urls, '{}'::text[]),
    p_duration_seconds, coalesce(p_post_stats, '{}'::jsonb), p_visibility,
    coalesce(p_comments_enabled, true)
  )
  returning id into created_post_id;

  return created_post_id;
end;
$$;

revoke all on function public.create_quest_post(uuid, uuid, text, text, text[], integer, jsonb, text, boolean) from public, anon;
grant execute on function public.create_quest_post(uuid, uuid, text, text, text[], integer, jsonb, text, boolean) to authenticated;
