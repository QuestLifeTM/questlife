-- Shared quest posts can opt out of comments. The default preserves the
-- existing social behavior for every previously-created post.
alter table public.quest_posts
  add column if not exists comments_enabled boolean not null default true;

-- Keep the social feed contract explicit so clients can omit the comment
-- affordance before attempting to open the comments sheet.
create or replace function public.get_quest_social_feed(
  p_scope text default 'public',
  p_limit integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  current_user_id uuid := auth.uid();
  safe_limit integer := greatest(1, least(coalesce(p_limit, 30), 50));
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if p_scope not in ('public', 'friends') then raise exception 'FEED_SCOPE_INVALID'; end if;

  return coalesce((
    select jsonb_agg(post_row order by post_row->>'createdAt' desc)
    from (
      select jsonb_build_object(
        'id', post.id, 'userId', profile.id, 'username', profile.username,
        'displayName', coalesce(profile.display_name, 'Adventurer'), 'emoji', profile.emoji,
        'avatarColor', profile.avatar_color, 'avatarUrl', profile.avatar_url,
        'questId', quest.id, 'questTitle', quest.title, 'questCategory', quest.category,
        'questColor', quest.accent_color, 'postTitle', post.post_title, 'caption', post.caption,
        'photoUrls', post.photo_urls, 'rating', completion.rating,
        'durationSeconds', post.duration_seconds, 'stats', post.post_stats,
        'visibility', post.visibility, 'commentsEnabled', post.comments_enabled,
        'likeCount', (select count(*)::integer from public.post_likes like_row where like_row.post_id = post.id),
        'likedByMe', exists (select 1 from public.post_likes like_row where like_row.post_id = post.id and like_row.user_id = current_user_id),
        'commentCount', case when post.comments_enabled then (select count(*)::integer from public.quest_post_comments comment_row where comment_row.post_id = post.id) else 0 end,
        'createdAt', post.created_at
      ) as post_row
      from public.quest_posts post
      join public.profiles profile on profile.id = post.user_id
      join public.quests quest on quest.id = post.quest_id
      left join public.quest_completions completion on completion.id = post.completion_id
      where case
        when p_scope = 'public' then post.visibility = 'public'
        else post.user_id = current_user_id and post.visibility in ('public', 'friends')
          or post.user_id <> current_user_id and post.visibility in ('public', 'friends')
            and public.are_friends(post.user_id, current_user_id)
      end
      order by post.created_at desc
      limit safe_limit
    ) as feed_rows
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_quest_social_feed(text, integer) from public, anon;
grant execute on function public.get_quest_social_feed(text, integer) to authenticated;

-- The memory view needs only the current user's post associated with one
-- completion; keeping this owner-scoped avoids making quest_posts writable or
-- broadly readable through the Data API.
create or replace function public.get_my_quest_post_for_completion(p_completion_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'id', post.id,
    'completionId', post.completion_id,
    'caption', post.caption,
    'visibility', post.visibility,
    'commentsEnabled', post.comments_enabled,
    'createdAt', post.created_at
  )
  from public.quest_posts post
  where post.completion_id = p_completion_id
    and post.user_id = auth.uid()
  order by post.created_at desc
  limit 1;
$$;

revoke all on function public.get_my_quest_post_for_completion(uuid) from public, anon;
grant execute on function public.get_my_quest_post_for_completion(uuid) to authenticated;

-- API callers cannot bypass the compose toggle. Existing comments remain in
-- place, but no new comment can be created after the author disables them.
create or replace function public.add_quest_post_comment(
  p_post_id uuid,
  p_body text,
  p_parent_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.quest_post_comments;
  comments_are_enabled boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select post.comments_enabled into comments_are_enabled
  from public.quest_posts post
  where post.id = p_post_id;

  if comments_are_enabled is distinct from true then
    raise exception 'COMMENTS_DISABLED';
  end if;

  insert into public.quest_post_comments(post_id, user_id, parent_id, body)
  values (p_post_id, auth.uid(), p_parent_id, trim(p_body))
  returning * into row;

  return jsonb_build_object('id', row.id);
end;
$$;

revoke all on function public.add_quest_post_comment(uuid, text, uuid) from public, anon;
grant execute on function public.add_quest_post_comment(uuid, text, uuid) to authenticated;
