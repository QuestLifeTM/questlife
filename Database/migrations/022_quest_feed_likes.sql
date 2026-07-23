-- Return the viewer's own reaction state alongside each social feed post.
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
        'visibility', post.visibility,
        'likeCount', (select count(*)::integer from public.post_likes like_row where like_row.post_id = post.id),
        'likedByMe', exists (select 1 from public.post_likes like_row where like_row.post_id = post.id and like_row.user_id = current_user_id),
        'commentCount', 0, 'createdAt', post.created_at
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

revoke execute on function public.get_quest_social_feed(text, integer) from public, anon;
grant execute on function public.get_quest_social_feed(text, integer) to authenticated;
