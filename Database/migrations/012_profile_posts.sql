-- Profile quest posts: share completed quests as photo posts on your profile,
-- with likes and friend visibility, plus a profile overview RPC that powers
-- both your own profile and friends' public profiles.

-- ---------------------------------------------------------------------------
-- quest_posts
-- ---------------------------------------------------------------------------

create table if not exists public.quest_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  completion_id uuid references public.quest_completions(id) on delete set null,
  caption text,
  photo_urls text[] not null default '{}',
  visibility text not null default 'friends' check (visibility in ('public', 'friends', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quest_posts_user_idx on public.quest_posts(user_id, created_at desc);

alter table public.quest_posts enable row level security;

drop trigger if exists quest_posts_set_updated_at on public.quest_posts;
create trigger quest_posts_set_updated_at
before update on public.quest_posts
for each row
execute function public.set_updated_at();

drop policy if exists "Post visibility" on public.quest_posts;
create policy "Post visibility"
on public.quest_posts
for select
to authenticated
using (
  user_id = (select auth.uid())
  or visibility = 'public'
  or (visibility = 'friends' and public.are_friends(user_id, (select auth.uid())))
);

drop policy if exists "Users manage their own posts" on public.quest_posts;
create policy "Users manage their own posts"
on public.quest_posts
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.quest_completions
    where quest_completions.user_id = (select auth.uid())
      and quest_completions.quest_id = quest_posts.quest_id
  )
);

drop policy if exists "Users update their own posts" on public.quest_posts;
create policy "Users update their own posts"
on public.quest_posts
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users delete their own posts" on public.quest_posts;
create policy "Users delete their own posts"
on public.quest_posts
for delete
to authenticated
using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- post_likes
-- ---------------------------------------------------------------------------

create table if not exists public.post_likes (
  post_id uuid not null references public.quest_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

drop policy if exists "Likes are readable where the post is" on public.post_likes;
create policy "Likes are readable where the post is"
on public.post_likes
for select
to authenticated
using (
  exists (
    select 1 from public.quest_posts
    where quest_posts.id = post_likes.post_id
  )
);

drop policy if exists "Users can like visible posts" on public.post_likes;
create policy "Users can like visible posts"
on public.post_likes
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.quest_posts
    where quest_posts.id = post_likes.post_id
  )
);

drop policy if exists "Users can unlike" on public.post_likes;
create policy "Users can unlike"
on public.post_likes
for delete
to authenticated
using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- RPC: profile overview (own profile or a friend's public profile)
-- ---------------------------------------------------------------------------

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
      'caption', posts_table.caption,
      'photoUrls', posts_table.photo_urls,
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

grant execute on function public.get_profile_overview(uuid, date) to authenticated;
