-- The profile Posts tab is a personal history, not a paged discovery feed.
-- Keep the same visibility rules while returning every post the profile owner
-- is allowed to see.
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
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  is_self := target_user = current_user_id;
  is_friend := public.are_friends(current_user_id, target_user);
  if not is_self and not is_friend then raise exception 'PROFILE_NOT_VISIBLE'; end if;

  select jsonb_build_object(
    'userId', prof.id, 'username', prof.username,
    'displayName', coalesce(prof.display_name, concat_ws(' ', prof.first_name, prof.last_name), 'Adventurer'),
    'avatarUrl', prof.avatar_url, 'coverUrl', prof.profile_cover_url,
    'email', case when is_self then prof.email else null end, 'bio', prof.bio,
    'emoji', prof.emoji, 'avatarColor', prof.avatar_color, 'title', prof.title,
    'totalXp', prof.total_xp, 'joinedAt', prof.created_at, 'streakVisibility', prof.streak_visibility
  ) into profile from public.profiles prof where prof.id = target_user;

  select jsonb_build_object(
    'totalQuests', (select count(*) from public.quest_completions where user_id = target_user),
    'currentStreak', coalesce((select case when streaks.last_quest_on >= p_today - 1 then streaks.current_streak else 0 end from public.user_streaks streaks where streaks.user_id = target_user), 0),
    'longestStreak', coalesce((select streaks.longest_streak from public.user_streaks streaks where streaks.user_id = target_user), 0),
    'friendsCount', (select count(*) from public.friendships where target_user in (user_a, user_b)),
    'daysOnApp', greatest(1, (p_today - (select prof.created_at::date from public.profiles prof where prof.id = target_user)) + 1)
  ) into stats;

  select coalesce(jsonb_agg(row order by row->>'createdAt' desc), '[]'::jsonb) into posts from (
    select jsonb_build_object(
      'id', posts_table.id, 'questId', posts_table.quest_id, 'questTitle', q.title,
      'questCategory', q.category, 'questColor', q.accent_color, 'questXp', q.experience_points,
      'postTitle', posts_table.post_title, 'caption', posts_table.caption, 'photoUrls', posts_table.photo_urls,
      'durationSeconds', posts_table.duration_seconds, 'stats', posts_table.post_stats, 'visibility', posts_table.visibility,
      'likeCount', (select count(*) from public.post_likes where post_id = posts_table.id),
      'likedByMe', exists (select 1 from public.post_likes where post_id = posts_table.id and user_id = current_user_id),
      'createdAt', posts_table.created_at
    ) as row from public.quest_posts posts_table join public.quests q on q.id = posts_table.quest_id
    where posts_table.user_id = target_user and (is_self or posts_table.visibility = 'public' or (posts_table.visibility = 'friends' and is_friend))
    order by posts_table.created_at desc
  ) as rows;

  select coalesce(jsonb_agg(row order by row->>'completedAt' desc), '[]'::jsonb) into recent from (
    select jsonb_build_object('completionId', c.id, 'questId', c.quest_id, 'questTitle', q.title, 'questColor', q.accent_color, 'xpAwarded', c.xp_awarded, 'completedAt', c.created_at) as row
    from public.quest_completions c join public.quests q on q.id = c.quest_id where c.user_id = target_user order by c.created_at desc limit 8
  ) as rows;

  return jsonb_build_object('isSelf', is_self, 'isFriend', is_friend, 'profile', profile, 'stats', stats, 'posts', posts, 'recentCompletions', recent);
end;
$$;

grant execute on function public.get_profile_overview(uuid, date) to authenticated;
