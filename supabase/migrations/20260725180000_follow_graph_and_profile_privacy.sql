-- A follow is directional. A QuestLife friendship is created only when both
-- people follow each other; this makes Friend Streaks, Parties, and
-- follower-only profile content safe to base on the same relationship.

alter table public.profiles
  add column if not exists profile_privacy jsonb not null default jsonb_build_object(
    'stats', 'public',
    'bio', 'public',
    'posts', 'public'
  );

create table if not exists public.profile_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint profile_follows_no_self_follow check (follower_id <> following_id)
);

alter table public.profile_follows enable row level security;

-- Preserve existing friendships as reciprocal follows during the transition.
insert into public.profile_follows (follower_id, following_id)
select friendship.user_a, friendship.user_b from public.friendships friendship
union
select friendship.user_b, friendship.user_a from public.friendships friendship
on conflict do nothing;

create or replace function public.are_friends(first_user uuid, second_user uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select first_user is not null
    and second_user is not null
    and first_user <> second_user
    and exists (
      select 1 from public.profile_follows mine
      where mine.follower_id = first_user and mine.following_id = second_user
    )
    and exists (
      select 1 from public.profile_follows theirs
      where theirs.follower_id = second_user and theirs.following_id = first_user
    );
$$;

create or replace function public.notify_profile_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare follower_name text;
begin
  select coalesce(nullif(display_name, ''), nullif(username, ''), 'A fellow adventurer')
  into follower_name from public.profiles where id = new.follower_id;
  perform public.create_app_notification(
    new.following_id, 'social', 'friend_request', 'New follower',
    coalesce(follower_name, 'A fellow adventurer') || ' started following you.',
    'person-add', '#00BBF9', 'profile-follow:' || new.follower_id::text || ':' || new.following_id::text,
    jsonb_build_object('followerId', new.follower_id), 'push_eligible'
  );
  return new;
end;
$$;

drop trigger if exists app_notifications_profile_follows on public.profile_follows;
create trigger app_notifications_profile_follows
after insert on public.profile_follows
for each row execute function public.notify_profile_follow();

create or replace function public.follow_profile(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if p_user = current_user_id then raise exception 'You cannot follow yourself.'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'This adventurer does not exist.'; end if;
  insert into public.profile_follows (follower_id, following_id)
  values (current_user_id, p_user) on conflict do nothing;
end;
$$;

create or replace function public.unfollow_profile(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from public.profile_follows
  where follower_id = auth.uid() and following_id = p_user;
end;
$$;

create or replace function public.remove_profile_follower(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from public.profile_follows
  where follower_id = p_user and following_id = auth.uid();
end;
$$;

create or replace function public.get_profile_followers()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', profile.id,
    'username', profile.username,
    'displayName', coalesce(profile.display_name, concat_ws(' ', profile.first_name, profile.last_name), 'Adventurer'),
    'avatarUrl', profile.avatar_url,
    'emoji', profile.emoji,
    'avatarColor', profile.avatar_color,
    'followedAt', follow.created_at
  ) order by follow.created_at desc), '[]'::jsonb)
  from public.profile_follows follow
  join public.profiles profile on profile.id = follow.follower_id
  where follow.following_id = auth.uid();
$$;

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
    'displayName', coalesce(profile.display_name, concat_ws(' ', profile.first_name, profile.last_name), 'Adventurer'),
    'avatarUrl', profile.avatar_url,
    'emoji', profile.emoji,
    'avatarColor', profile.avatar_color,
    'isFollowing', exists (select 1 from public.profile_follows follow where follow.follower_id = auth.uid() and follow.following_id = profile.id),
    'followsYou', exists (select 1 from public.profile_follows follow where follow.follower_id = profile.id and follow.following_id = auth.uid()),
    'isFriend', public.are_friends(auth.uid(), profile.id),
    'requestStatus', null
  )
  from public.profiles profile where profile.id = p_target;
$$;

create or replace function public.get_friend_suggestions()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(row), '[]'::jsonb)
  from (
    select public.friend_discovery_profile(profile.id) as row
    from public.profiles profile
    where profile.id <> auth.uid()
      and not exists (
        select 1 from public.profile_follows follow
        where follow.follower_id = auth.uid() and follow.following_id = profile.id
      )
    order by profile.total_xp desc, profile.created_at desc
    limit 24
  ) suggestions;
$$;

-- Public profiles are always discoverable by name and handle. The private
-- fields below are independently filtered by the profile owner's audience.
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
  is_following boolean;
  follows_you boolean;
  is_friend boolean;
  privacy jsonb;
  stored_visibility jsonb;
  effective_visibility jsonb;
  profile jsonb;
  stats jsonb;
  posts jsonb;
  top_categories jsonb;
  recent jsonb;
  can_see_stats boolean;
  can_see_bio boolean;
  can_see_posts boolean;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles where id = target_user) then raise exception 'PROFILE_NOT_VISIBLE'; end if;
  is_self := target_user = current_user_id;
  is_following := exists (select 1 from public.profile_follows follow where follow.follower_id = current_user_id and follow.following_id = target_user);
  follows_you := exists (select 1 from public.profile_follows follow where follow.follower_id = target_user and follow.following_id = current_user_id);
  is_friend := is_following and follows_you;

  select coalesce(profile_privacy, jsonb_build_object('stats', 'public', 'bio', 'public', 'posts', 'public')),
    coalesce(stat_visibility, jsonb_build_object('highestStreak', true, 'level', true, 'questsDone', true, 'timeSpent', true, 'totalXp', true, 'followers', true, 'following', true))
  into privacy, stored_visibility from public.profiles where id = target_user;

  can_see_stats := is_self or privacy->>'stats' = 'public' or (privacy->>'stats' = 'followers' and is_following);
  can_see_bio := is_self or privacy->>'bio' = 'public' or (privacy->>'bio' = 'followers' and is_following);
  can_see_posts := is_self or privacy->>'posts' = 'public' or (privacy->>'posts' = 'followers' and is_following);
  effective_visibility := case when can_see_stats then stored_visibility else jsonb_build_object('highestStreak', false, 'level', false, 'questsDone', false, 'timeSpent', false, 'totalXp', false, 'followers', false, 'following', false) end;

  select jsonb_build_object(
    'userId', profile_row.id, 'username', profile_row.username,
    'displayName', coalesce(profile_row.display_name, concat_ws(' ', profile_row.first_name, profile_row.last_name), 'Adventurer'),
    'avatarUrl', profile_row.avatar_url, 'email', case when is_self then profile_row.email else null end,
    'bio', case when can_see_bio then profile_row.bio else null end,
    'emoji', profile_row.emoji, 'avatarColor', profile_row.avatar_color, 'title', profile_row.title,
    'totalXp', case when can_see_stats then profile_row.total_xp else 0 end,
    'joinedAt', profile_row.created_at, 'streakVisibility', profile_row.streak_visibility,
    'statVisibility', effective_visibility, 'privacy', privacy
  ) into profile from public.profiles profile_row where profile_row.id = target_user;

  select coalesce(jsonb_agg(row order by (row->>'completedQuests')::integer desc, row->>'category'), '[]'::jsonb) into top_categories from (
    select jsonb_build_object('category', quest.category, 'completedQuests', count(*)::integer) as row
    from public.quest_completions completion join public.quests quest on quest.id = completion.quest_id
    where completion.user_id = target_user group by quest.category order by count(*) desc, quest.category limit 3
  ) category_rows;

  select jsonb_build_object(
    'totalQuests', case when can_see_stats then (select count(*) from public.quest_completions where user_id = target_user) else 0 end,
    'currentStreak', case when can_see_stats then coalesce((select case when streak.last_quest_on >= p_today - 1 then streak.current_streak else 0 end from public.user_streaks streak where streak.user_id = target_user), 0) else 0 end,
    'longestStreak', case when can_see_stats then coalesce((select streak.longest_streak from public.user_streaks streak where streak.user_id = target_user), 0) else 0 end,
    'friendsCount', (select count(*) from public.profile_follows follow where follow.follower_id = target_user and exists (select 1 from public.profile_follows reverse_follow where reverse_follow.follower_id = follow.following_id and reverse_follow.following_id = target_user)),
    'daysOnApp', greatest(1, p_today - (select created_at::date from public.profiles where id = target_user) + 1),
    'totalQuestDurationSeconds', case when can_see_stats then coalesce((select sum(extract(epoch from session.ended_at - session.started_at)::bigint) from public.quest_sessions session where session.user_id = target_user and session.status = 'completed' and session.ended_at is not null), 0) else 0 end,
    'followers', case when can_see_stats then (select count(*) from public.profile_follows where following_id = target_user) else 0 end,
    'following', case when can_see_stats then (select count(*) from public.profile_follows where follower_id = target_user) else 0 end,
    'topCategories', case when can_see_stats then top_categories else '[]'::jsonb end
  ) into stats;

  select coalesce(jsonb_agg(row order by row->>'createdAt' desc), '[]'::jsonb) into posts from (
    select jsonb_build_object(
      'id', post.id, 'questId', post.quest_id, 'questTitle', quest.title, 'questCategory', quest.category,
      'questColor', quest.accent_color, 'questXp', quest.experience_points, 'postTitle', post.post_title,
      'caption', post.caption, 'photoUrls', post.photo_urls, 'durationSeconds', post.duration_seconds,
      'stats', post.post_stats, 'visibility', post.visibility,
      'likeCount', (select count(*) from public.post_likes where post_id = post.id),
      'likedByMe', exists (select 1 from public.post_likes where post_id = post.id and user_id = current_user_id),
      'createdAt', post.created_at
    ) as row
    from public.quest_posts post join public.quests quest on quest.id = post.quest_id
    where post.user_id = target_user and can_see_posts
      and (is_self or post.visibility <> 'private')
      and (is_self or post.visibility = 'public' or (post.visibility = 'friends' and is_following))
    order by post.created_at desc
  ) post_rows;

  select coalesce(jsonb_agg(row order by row->>'completedAt' desc), '[]'::jsonb) into recent from (
    select jsonb_build_object('completionId', completion.id, 'questId', completion.quest_id, 'questTitle', quest.title, 'questColor', quest.accent_color, 'xpAwarded', completion.xp_awarded, 'completedAt', completion.created_at) as row
    from public.quest_completions completion join public.quests quest on quest.id = completion.quest_id
    where completion.user_id = target_user and can_see_posts order by completion.created_at desc limit 8
  ) recent_rows;

  return jsonb_build_object('isSelf', is_self, 'isFriend', is_friend, 'isFollowing', is_following, 'followsYou', follows_you, 'profile', profile, 'stats', stats, 'posts', posts, 'recentCompletions', recent);
end;
$$;

alter function public.get_social_overview(date) rename to get_social_overview_follow_base;

create function public.get_social_overview(p_today date default current_date)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with payload as (select public.get_social_overview_follow_base(p_today) as data)
  select data || jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', profile.id, 'username', profile.username,
        'displayName', coalesce(profile.display_name, concat_ws(' ', profile.first_name, profile.last_name), 'Adventurer'),
        'avatarUrl', profile.avatar_url, 'emoji', profile.emoji, 'avatarColor', profile.avatar_color,
        'totalXp', profile.total_xp,
        'currentStreak', coalesce((select case when streak.last_quest_on >= p_today - 1 then streak.current_streak else 0 end from public.user_streaks streak where streak.user_id = profile.id), 0),
        'questedToday', exists (select 1 from public.quest_completions completion where completion.user_id = profile.id and completion.created_at::date = p_today),
        'lastQuestTitle', (select quest.title from public.quest_completions completion join public.quests quest on quest.id = completion.quest_id where completion.user_id = profile.id order by completion.created_at desc limit 1),
        'lastQuestAt', (select completion.created_at from public.quest_completions completion where completion.user_id = profile.id order by completion.created_at desc limit 1)
      ) order by profile.total_xp desc, profile.created_at desc)
      from public.profiles profile
      where profile.id <> auth.uid()
        and exists (select 1 from public.profile_follows mine where mine.follower_id = auth.uid() and mine.following_id = profile.id)
        and exists (select 1 from public.profile_follows theirs where theirs.follower_id = profile.id and theirs.following_id = auth.uid())
    ), '[]'::jsonb),
    'incomingRequests', '[]'::jsonb,
    'outgoingRequests', '[]'::jsonb
  ) from payload;
$$;

revoke all on function public.follow_profile(uuid) from public, anon;
revoke all on function public.unfollow_profile(uuid) from public, anon;
revoke all on function public.remove_profile_follower(uuid) from public, anon;
revoke all on function public.get_profile_followers() from public, anon;
grant execute on function public.follow_profile(uuid), public.unfollow_profile(uuid), public.remove_profile_follower(uuid), public.get_profile_followers(), public.get_profile_overview(uuid, date), public.get_social_overview(date) to authenticated;
