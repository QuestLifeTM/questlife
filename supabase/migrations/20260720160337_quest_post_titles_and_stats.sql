-- A post can use the quest name as a starting point, but it is now an editable
-- social title. post_stats deliberately contains only the values the author
-- opted to share; omitted keys must not be rendered by any feed client.
alter table public.quest_posts
  add column if not exists post_title text,
  add column if not exists post_stats jsonb not null default '{}'::jsonb;

alter table public.quest_posts
  drop constraint if exists quest_posts_post_stats_object_check;

alter table public.quest_posts
  add constraint quest_posts_post_stats_object_check
  check (jsonb_typeof(post_stats) = 'object');

-- Preserve the useful elapsed-time display on posts created before this
-- feature. New posts store exactly the stats selected in the composer.
update public.quest_posts
set post_stats = jsonb_strip_nulls(jsonb_build_object(
  'photos', coalesce(cardinality(photo_urls), 0),
  'durationSeconds', duration_seconds
))
where post_stats = '{}'::jsonb;

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
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_scope not in ('public', 'friends') then
    raise exception 'FEED_SCOPE_INVALID';
  end if;

  return coalesce((
    select jsonb_agg(post_row order by post_row->>'createdAt' desc)
    from (
      select jsonb_build_object(
        'id', post.id,
        'userId', profile.id,
        'username', profile.username,
        'displayName', coalesce(profile.display_name, 'Adventurer'),
        'emoji', profile.emoji,
        'avatarColor', profile.avatar_color,
        'questId', quest.id,
        'questTitle', quest.title,
        'questCategory', quest.category,
        'questColor', quest.accent_color,
        'postTitle', post.post_title,
        'caption', post.caption,
        'photoUrls', post.photo_urls,
        'durationSeconds', post.duration_seconds,
        'stats', post.post_stats,
        'visibility', post.visibility,
        'likeCount', (select count(*)::integer from public.post_likes like_row where like_row.post_id = post.id),
        'commentCount', 0,
        'createdAt', post.created_at
      ) as post_row
      from public.quest_posts post
      join public.profiles profile on profile.id = post.user_id
      join public.quests quest on quest.id = post.quest_id
      where case
        when p_scope = 'public' then post.visibility = 'public'
        else post.user_id = current_user_id and post.visibility in ('public', 'friends')
          or post.user_id <> current_user_id
            and post.visibility in ('public', 'friends')
            and public.are_friends(post.user_id, current_user_id)
      end
      order by post.created_at desc
      limit safe_limit
    ) as feed_rows
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_profile_overview(
  p_user uuid default null,
  p_today date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  current_user_id uuid := auth.uid();
  target_user uuid := coalesce(p_user, auth.uid());
  is_self boolean;
  is_friend boolean;
  profile jsonb;
  stats jsonb;
  posts jsonb;
  recent jsonb;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  is_self := target_user = current_user_id;
  is_friend := public.are_friends(current_user_id, target_user);

  if not is_self and not is_friend then
    raise exception 'PROFILE_NOT_VISIBLE';
  end if;

  select jsonb_build_object(
    'userId', prof.id,
    'username', prof.username,
    'displayName', coalesce(prof.display_name, 'Adventurer'),
    'email', case when is_self then prof.email else null end,
    'bio', prof.bio,
    'emoji', prof.emoji,
    'avatarColor', prof.avatar_color,
    'title', prof.title,
    'totalXp', prof.total_xp,
    'joinedAt', prof.created_at,
    'streakVisibility', prof.streak_visibility
  )
  into profile
  from public.profiles prof
  where prof.id = target_user;

  select jsonb_build_object(
    'totalQuests', (select count(*) from public.quest_completions where user_id = target_user),
    'currentStreak', coalesce((
      select case when streaks.last_quest_on >= p_today - 1 then streaks.current_streak else 0 end
      from public.user_streaks streaks
      where streaks.user_id = target_user
    ), 0),
    'longestStreak', coalesce((
      select streaks.longest_streak from public.user_streaks streaks where streaks.user_id = target_user
    ), 0),
    'friendsCount', (
      select count(*) from public.friendships
      where target_user in (user_a, user_b)
    ),
    'daysOnApp', greatest(1, (p_today - (
      select prof.created_at::date from public.profiles prof where prof.id = target_user
    )) + 1)
  )
  into stats;

  select coalesce(jsonb_agg(row order by row->>'createdAt' desc), '[]'::jsonb)
  into posts
  from (
    select jsonb_build_object(
      'id', posts_table.id,
      'questId', posts_table.quest_id,
      'questTitle', q.title,
      'questCategory', q.category,
      'questColor', q.accent_color,
      'questXp', q.experience_points,
      'postTitle', posts_table.post_title,
      'caption', posts_table.caption,
      'photoUrls', posts_table.photo_urls,
      'durationSeconds', posts_table.duration_seconds,
      'stats', posts_table.post_stats,
      'visibility', posts_table.visibility,
      'likeCount', (select count(*) from public.post_likes where post_id = posts_table.id),
      'likedByMe', exists (
        select 1 from public.post_likes
        where post_id = posts_table.id and user_id = current_user_id
      ),
      'createdAt', posts_table.created_at
    ) as row
    from public.quest_posts posts_table
    join public.quests q on q.id = posts_table.quest_id
    where posts_table.user_id = target_user
      and (
        is_self
        or posts_table.visibility = 'public'
        or (posts_table.visibility = 'friends' and is_friend)
      )
    order by posts_table.created_at desc
    limit 30
  ) as rows;

  select coalesce(jsonb_agg(row order by row->>'completedAt' desc), '[]'::jsonb)
  into recent
  from (
    select jsonb_build_object(
      'completionId', c.id,
      'questId', c.quest_id,
      'questTitle', q.title,
      'questColor', q.accent_color,
      'xpAwarded', c.xp_awarded,
      'completedAt', c.created_at
    ) as row
    from public.quest_completions c
    join public.quests q on q.id = c.quest_id
    where c.user_id = target_user
    order by c.created_at desc
    limit 8
  ) as rows;

  return jsonb_build_object(
    'isSelf', is_self,
    'isFriend', is_friend,
    'profile', profile,
    'stats', stats,
    'posts', posts,
    'recentCompletions', recent
  );
end;
$$;

revoke execute on function public.get_quest_social_feed(text, integer) from public, anon;
grant execute on function public.get_quest_social_feed(text, integer) to authenticated;
grant execute on function public.get_profile_overview(uuid, date) to authenticated;
