-- Phase 1: server-owned progression, parent ownership and consistent audiences.
begin;
-- S1: replace table-wide writes with column grants; server reward functions retain access.
revoke insert, update on public.profiles from authenticated;
do $$ declare cols text; begin
 select string_agg(quote_ident(column_name), ', ') into cols from information_schema.columns
 where table_schema='public' and table_name='profiles' and column_name not in ('total_xp','created_at','updated_at');
 execute 'grant insert (' || cols || ') on public.profiles to authenticated';
 select string_agg(quote_ident(column_name), ', ') into cols from information_schema.columns
 where table_schema='public' and table_name='profiles' and column_name not in ('id','total_xp','created_at','updated_at');
 execute 'grant update (' || cols || ') on public.profiles to authenticated';
end $$;
-- S2: a self-owned child must also reference a self-owned parent.
create or replace function public.owns_quest_session(p_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.quest_sessions where id=p_session and user_id=auth.uid());
$$;
revoke all on function public.owns_quest_session(uuid) from public,anon;
grant execute on function public.owns_quest_session(uuid) to authenticated;
drop policy if exists "Users manage their active quest snapshots" on public.quest_session_snapshots;
create policy "Users manage their active quest snapshots" on public.quest_session_snapshots for all to authenticated
 using (user_id=(select auth.uid()) and public.owns_quest_session(session_id))
 with check (user_id=(select auth.uid()) and public.owns_quest_session(session_id));
drop policy if exists "Users manage their active quest route" on public.quest_session_route_points;
create policy "Users manage their active quest route" on public.quest_session_route_points for all to authenticated
 using (user_id=(select auth.uid()) and public.owns_quest_session(session_id))
 with check (user_id=(select auth.uid()) and public.owns_quest_session(session_id));
drop policy if exists "Users manage their active quest media" on public.quest_session_media;
create policy "Users manage their active quest media" on public.quest_session_media for all to authenticated
 using (user_id=(select auth.uid()) and public.owns_quest_session(session_id))
 with check (user_id=(select auth.uid()) and public.owns_quest_session(session_id));
drop policy if exists "Users manage their active quest activity" on public.quest_session_activity;
create policy "Users manage their active quest activity" on public.quest_session_activity for all to authenticated
 using (user_id=(select auth.uid()) and public.owns_quest_session(session_id))
 with check (user_id=(select auth.uid()) and public.owns_quest_session(session_id));

-- S3: canonical UTC reward day, independent of device clocks.
create or replace function public.start_quest_session(
  p_quest_id uuid,
  p_today date default current_date,
  p_source text default 'explore',
  p_pack_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  daily_used integer;
  session_id uuid;
  mode text;
  in_progress_count integer;
begin
  p_today := (now() at time zone 'UTC')::date;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 781));
  if current_user_id is null then raise exception 'Not authenticated'; end if;

  select quest_mode into mode
  from public.quests
  where id = p_quest_id and status = 'published';
  if mode is null then raise exception 'QUEST_NOT_AVAILABLE'; end if;

  select count(*) into daily_used
  from public.quest_completions
  where user_id = current_user_id and completed_on = p_today;
  if public.daily_quest_limit_is_enabled() and daily_used >= 5 then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;

  if mode = 'focused' and exists (
    select 1 from public.quest_sessions
    where user_id = current_user_id and status = 'doing_now'
  ) then
    raise exception 'DOING_NOW_SESSION_EXISTS';
  end if;

  if mode = 'flexible' then
    if exists (select 1 from public.quest_sessions where user_id = current_user_id and quest_id = p_quest_id and status = 'in_progress') then
      raise exception 'QUEST_ALREADY_IN_PROGRESS';
    end if;
    select count(*) into in_progress_count
    from public.quest_sessions
    where user_id = current_user_id and status = 'in_progress';
    if in_progress_count >= 3 then raise exception 'IN_PROGRESS_LIMIT_REACHED'; end if;
  end if;

  insert into public.quest_sessions (user_id, quest_id, source, pack_id, status)
  values (current_user_id, p_quest_id, p_source, p_pack_id,
    case when mode = 'focused' then 'doing_now' else 'in_progress' end)
  returning id into session_id;

  return jsonb_build_object('sessionId', session_id, 'mode', mode);
end;
$$;

-- S3: canonical UTC reward day, independent of device clocks.
create or replace function public.complete_quest_v2(
  p_quest_id uuid,
  p_today date default current_date,
  p_logged boolean default true,
  p_reflection text default null,
  p_rating smallint default null,
  p_review text default null,
  p_review_public boolean default true,
  p_photo_urls text[] default '{}',
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  quest record;
  active_session_id uuid;
  daily_used integer;
  previous_completions integer;
  awarded integer;
  new_completion_id uuid;
begin
  p_today := (now() at time zone 'UTC')::date;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 781));
  if current_user_id is null then raise exception 'Not authenticated'; end if;

  select session.id into active_session_id
  from public.quest_sessions as session
  where session.user_id = current_user_id
    and session.quest_id = p_quest_id
    and session.status in ('doing_now', 'in_progress')
    and (p_session_id is null or session.id = p_session_id)
  order by session.started_at desc
  limit 1
  for update;
  if active_session_id is null then raise exception 'ACTIVE_SESSION_NOT_FOUND'; end if;

  select * into quest from public.quests where id = p_quest_id;
  if quest.id is null then raise exception 'QUEST_NOT_FOUND'; end if;

  select count(*) into previous_completions from public.quest_completions
  where user_id = current_user_id and quest_id = p_quest_id;
  select count(*) into daily_used from public.quest_completions
  where user_id = current_user_id and completed_on = p_today;
  if public.daily_quest_limit_is_enabled() and daily_used >= 5 then raise exception 'DAILY_LIMIT_REACHED'; end if;
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then raise exception 'RATING_INVALID'; end if;

  awarded := case when previous_completions > 0 then round(quest.experience_points * 0.20)::integer
    when p_logged then quest.experience_points else floor(quest.experience_points / 2.0)::integer end;
  insert into public.quest_completions (user_id, quest_id, completed_on, reflection, xp_awarded, logged, rating, review_text, review_public, photo_urls)
  values (current_user_id, p_quest_id, p_today, nullif(trim(coalesce(p_reflection, '')), ''), awarded, p_logged, p_rating,
    case when p_logged then nullif(trim(coalesce(p_review, '')), '') else null end, p_review_public, coalesce(p_photo_urls, '{}'))
  returning id into new_completion_id;
  update public.quest_sessions set status = 'completed', ended_at = now(), completion_id = new_completion_id where id = active_session_id;
  return jsonb_build_object('completionId', new_completion_id, 'xpAwarded', awarded, 'dailyUsed', daily_used + 1,
    'dailyLimit', case when public.daily_quest_limit_is_enabled() then 5 else 0 end);
end;
$$;

-- S3: canonical UTC reward day, independent of device clocks.
create or replace function public.complete_party_quest_v2(
  p_party_id uuid, p_quest_id uuid, p_today date default current_date, p_reflection text default null,
  p_journal_photo_paths text[] default '{}', p_share_to_feed boolean default false,
  p_feed_caption text default null, p_shared_photo_paths text[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid(); party_row public.parties%rowtype; quest_row public.quests%rowtype;
  active_round public.party_quest_rounds%rowtype; active_session public.party_quest_sessions%rowtype;
  started timestamptz; base integer; completion_id uuid; new_party_completion_id uuid; daily_used integer;
  fastest jsonb; top_finishers jsonb; proof_mode text; should_share boolean; feed_type text; elapsed_seconds integer;
begin
  p_today := (now() at time zone 'UTC')::date;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 781));
  select * into party_row from public.parties where id = p_party_id;
  if party_row.status <> 'active' or not public.is_party_member(p_party_id, current_user_id) then raise exception 'This party is not active.'; end if;
  select * into quest_row from public.quests where id = p_quest_id and status = 'published';
  if quest_row.id is null then raise exception 'QUEST_NOT_AVAILABLE'; end if;
  if coalesce(array_length(p_journal_photo_paths, 1), 0) > 5 then raise exception 'You can add up to five Journal photos.'; end if;
  if coalesce(array_length(p_shared_photo_paths, 1), 0) > 5 then raise exception 'You can share up to five Party photos.'; end if;
  proof_mode := coalesce(party_row.photo_proof_mode, case when party_row.photo_proof_required then 'required' else 'disabled' end);
  if proof_mode = 'required' and (coalesce(array_length(p_journal_photo_paths, 1), 0) = 0 or coalesce(array_length(p_shared_photo_paths, 1), 0) = 0) then raise exception 'A proof photo is required for this Party quest.'; end if;
  select count(*) into daily_used from public.quest_completions where user_id = current_user_id and completed_on = p_today;
  if public.daily_quest_limit_is_enabled() and daily_used >= 5 then raise exception 'DAILY_LIMIT_REACHED'; end if;
  if party_row.game_mode = 'everyone_together' then
    select * into active_round from public.party_quest_rounds where party_id = p_party_id and quest_id = p_quest_id and status = 'active';
    if active_round.id is null then raise exception 'This shared quest has not started.'; end if;
    if exists (select 1 from public.party_completions where party_id = p_party_id and quest_id = p_quest_id and user_id = current_user_id and round_id = active_round.id) then raise exception 'You already completed this shared quest.'; end if;
    started := active_round.started_at;
  else
    select * into active_session from public.party_quest_sessions where party_id = p_party_id and quest_id = p_quest_id and user_id = current_user_id and status = 'active';
    if active_session.id is null then raise exception 'Start this Party quest before completing it.'; end if;
    started := active_session.started_at;
  end if;
  base := quest_row.experience_points;
  should_share := proof_mode = 'required' or (coalesce(p_share_to_feed, false) and coalesce(array_length(p_shared_photo_paths, 1), 0) > 0);
  feed_type := case when proof_mode = 'required' then 'proof' when should_share then 'adventure' else 'activity' end;
  elapsed_seconds := extract(epoch from now() - started)::integer;
  insert into public.quest_completions (user_id, quest_id, completed_on, reflection, xp_awarded, logged, review_public, photo_urls, party_id)
  values (current_user_id, p_quest_id, p_today, nullif(trim(coalesce(p_reflection, '')), ''), base, true, false, coalesce(p_journal_photo_paths, '{}'), p_party_id) returning id into completion_id;
  insert into public.party_completions (party_id, quest_id, user_id, round_id, session_id, quest_completion_id, base_xp, started_at, reflection, photo_paths, journal_photo_paths, shared_photo_paths)
  values (p_party_id, p_quest_id, current_user_id, active_round.id, active_session.id, completion_id, base, started, nullif(trim(coalesce(p_reflection, '')), ''), coalesce(p_shared_photo_paths, '{}'), coalesce(p_journal_photo_paths, '{}'), coalesce(p_shared_photo_paths, '{}')) returning id into new_party_completion_id;
  update public.quest_completions set party_completion_id = new_party_completion_id where id = completion_id;
  insert into public.party_feed_posts (party_id, completion_id, quest_id, user_id, caption, photo_paths, post_type, elapsed_seconds)
  values (p_party_id, new_party_completion_id, p_quest_id, current_user_id, case when should_share then nullif(trim(coalesce(p_feed_caption, '')), '') else null end, case when should_share then coalesce(p_shared_photo_paths, '{}') else '{}' end, feed_type, elapsed_seconds);
  if party_row.game_mode = 'free_for_all' then update public.party_quest_sessions set status = 'completed', completed_at = now() where id = active_session.id; end if;
  select jsonb_build_object('name', coalesce(pr.display_name, 'Adventurer'), 'emoji', pr.emoji, 'elapsedSeconds', extract(epoch from pc.completed_at - pc.started_at)::integer) into fastest
  from public.party_completions pc join public.profiles pr on pr.id = pc.user_id where pc.party_id = p_party_id and pc.quest_id = p_quest_id order by pc.completed_at - pc.started_at, pc.completed_at limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('name', ranked.name, 'emoji', ranked.emoji, 'elapsedSeconds', ranked.elapsed_seconds, 'rank', ranked.rank) order by ranked.rank), '[]'::jsonb) into top_finishers
  from (select coalesce(pr.display_name, 'Adventurer') as name, pr.emoji, extract(epoch from pc.completed_at - pc.started_at)::integer as elapsed_seconds, row_number() over (order by pc.completed_at - pc.started_at, pc.completed_at)::integer as rank from public.party_completions pc join public.profiles pr on pr.id = pc.user_id where pc.party_id = p_party_id and pc.quest_id = p_quest_id and (party_row.game_mode <> 'everyone_together' or pc.round_id = active_round.id) order by pc.completed_at - pc.started_at, pc.completed_at limit 3) ranked;
  return jsonb_build_object('completionId', new_party_completion_id, 'xpAwarded', base, 'dailyUsed', daily_used + 1, 'dailyLimit', case when public.daily_quest_limit_is_enabled() then 5 else 0 end, 'fastest', fastest, 'topFinishers', top_finishers, 'proofMode', proof_mode, 'feedShared', should_share, 'elapsedSeconds', elapsed_seconds);
end;
$$;

-- S3: canonical UTC reward day, independent of device clocks.
create or replace function public.get_quest_engine_state(p_today date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  current_user_id uuid := auth.uid();
  daily_used integer;
  doing_now jsonb;
  in_progress jsonb;
  today_completions jsonb;
begin
  p_today := (now() at time zone 'UTC')::date;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 781));
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  select count(*) into daily_used from public.quest_completions where user_id = current_user_id and completed_on = p_today;
  select jsonb_build_object(
    'id', s.id, 'questId', s.quest_id, 'source', s.source, 'startedAt', s.started_at,
    'lastAppOpenedAt', s.last_app_opened_at,
    'recoveryStartedAt', s.recovery_started_at, 'recoveryRequiredAt', s.recovery_required_at
  ) into doing_now
  from public.quest_sessions s
  where s.user_id = current_user_id and s.status = 'doing_now'
  limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'questId', s.quest_id, 'source', s.source, 'startedAt', s.started_at)
    order by s.started_at desc), '[]'::jsonb) into in_progress
  from public.quest_sessions s where s.user_id = current_user_id and s.status = 'in_progress';
  select coalesce(jsonb_agg(row order by row->>'completedAt' desc), '[]'::jsonb) into today_completions from (
    select jsonb_build_object('completionId', c.id, 'questId', c.quest_id, 'xpAwarded', c.xp_awarded, 'logged', c.logged, 'completedAt', c.created_at) row
    from public.quest_completions c where c.user_id = current_user_id and c.completed_on = p_today
  ) rows;
  return jsonb_build_object('dailyLimit', case when public.daily_quest_limit_is_enabled() then 5 else 0 end,
    'dailyUsed', daily_used, 'doingNowSession', doing_now, 'inProgressSessions', in_progress, 'todayCompletions', today_completions);
end;
$$;
revoke all on function public.complete_quest_v2(uuid,date,boolean,text,smallint,text,boolean,text[]) from public,anon,authenticated;

-- S8: history reset is an administrative operation.
create or replace function public.reset_todays_solo_quest_completions(
  p_today date default current_date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  removed_xp integer := 0;
  removed_count integer := 0;
  reset_quest_ids uuid[] := '{}';
begin
  if not public.is_super_admin() then raise exception 'Administrator required'; end if;
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    coalesce(sum(completion.xp_awarded), 0)::integer,
    count(*)::integer,
    coalesce(array_agg(completion.quest_id), '{}')
  into removed_xp, removed_count, reset_quest_ids
  from public.quest_completions as completion
  where completion.user_id = current_user_id
    and completion.completed_on = p_today
    and completion.party_id is null;

  if removed_count = 0 then
    return 0;
  end if;

  delete from public.quest_completions as completion
  where completion.user_id = current_user_id
    and completion.completed_on = p_today
    and completion.party_id is null;

  update public.quest_sessions as session
  set status = 'abandoned', ended_at = coalesce(session.ended_at, now())
  where session.user_id = current_user_id
    and session.quest_id = any(reset_quest_ids)
    and session.status = 'completed';

  update public.profiles
  set total_xp = greatest(0, total_xp - removed_xp)
  where id = current_user_id;

  return removed_count;
end;
$$;

-- S6: one-way follows never grant friends-only access.
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

  can_see_stats := is_self or privacy->>'stats' = 'public' or (privacy->>'stats' = 'followers' and is_friend);
  can_see_bio := is_self or privacy->>'bio' = 'public' or (privacy->>'bio' = 'followers' and is_friend);
  can_see_posts := is_self or privacy->>'posts' = 'public' or (privacy->>'posts' = 'followers' and is_friend);
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
      and (is_self or post.visibility = 'public' or (post.visibility = 'friends' and is_friend))
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

-- Shared audience predicate used inside privileged comment APIs.
create or replace function public.can_view_quest_post(p_post uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from public.quest_posts p join public.profiles pr on pr.id=p.user_id
 where p.id=p_post and (p.user_id=auth.uid() or (
 (p.visibility='public' or (p.visibility='friends' and public.are_friends(p.user_id,auth.uid())))
 and (coalesce(pr.profile_privacy->>'posts','public')='public' or
 (pr.profile_privacy->>'posts'='followers' and public.are_friends(p.user_id,auth.uid()))))));
$$;
revoke all on function public.can_view_quest_post(uuid) from public,anon;
grant execute on function public.can_view_quest_post(uuid) to authenticated;
create or replace function public.get_quest_post_comments(p_post_id uuid)
returns jsonb language sql security definer set search_path = '' stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'parentId', c.parent_id, 'body', c.body, 'createdAt', c.created_at,
    'userId', p.id, 'displayName', coalesce(p.display_name, 'Adventurer'), 'username', p.username,
    'emoji', p.emoji, 'avatarColor', p.avatar_color, 'avatarUrl', p.avatar_url
  ) order by c.created_at), '[]'::jsonb)
  from public.quest_post_comments c join public.profiles p on p.id = c.user_id where c.post_id = p_post_id and public.can_view_quest_post(p_post_id);
$$;
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
 if not public.can_view_quest_post(p_post_id) then raise exception 'Post not available'; end if;
 if p_parent_id is not null and not exists(select 1 from public.quest_post_comments where id=p_parent_id and post_id=p_post_id) then raise exception 'Invalid reply parent'; end if;

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
drop policy if exists "Authenticated users read post comments" on public.quest_post_comments;
create policy "Authenticated users read post comments" on public.quest_post_comments for select to authenticated using (public.can_view_quest_post(post_id));
drop policy if exists "Users add their own comments" on public.quest_post_comments;
-- Only the checked RPC may insert comments.
revoke insert on public.quest_post_comments from authenticated;

-- S7: privileged consumers must never trust caller-supplied Storage references.
create or replace function public.owned_storage_path(p_bucket text,p_path text,p_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from storage.objects o where bucket_id=p_bucket and name=p_path
 and coalesce(to_jsonb(o)->>'owner_id',to_jsonb(o)->>'owner')=p_owner::text);
$$;
revoke all on function public.owned_storage_path(text,text,uuid) from public,anon,authenticated;
create or replace function public.guard_party_media_references() returns trigger
language plpgsql security definer set search_path='' as $$
declare path text; paths text[]; owner_id uuid;
begin
 if tg_table_name='parties' then paths:=array[new.photo_path]; owner_id:=new.created_by;
 elsif tg_table_name='party_feed_posts' then paths:=new.photo_paths; owner_id:=new.user_id;
 else paths:=coalesce(new.photo_paths,'{}') || coalesce(new.shared_photo_paths,'{}'); owner_id:=new.user_id;
 end if;
 foreach path in array coalesce(paths,'{}') loop
  if path is not null and btrim(path)<>'' and not public.owned_storage_path('party-media',path,owner_id) then raise exception 'Invalid party media owner'; end if;
 end loop;
 if tg_table_name='party_completions' then
  foreach path in array coalesce(new.journal_photo_paths,'{}') loop
   if not public.owned_storage_path('journal-media',path,owner_id) then raise exception 'Invalid journal media owner'; end if;
  end loop;
 end if;
 return new;
end $$;
revoke all on function public.guard_party_media_references() from public,anon,authenticated;
create trigger guard_party_media before insert or update of photo_path on public.parties for each row execute function public.guard_party_media_references();
create trigger guard_party_feed_media before insert or update of photo_paths on public.party_feed_posts for each row execute function public.guard_party_media_references();
create trigger guard_party_completion_media before insert or update of photo_paths,shared_photo_paths,journal_photo_paths on public.party_completions for each row execute function public.guard_party_media_references();
create or replace function public.verified_party_media_for_deletion(p_user uuid,p_paths text[]) returns text[]
language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(path),'{}') from unnest(p_paths) path where public.owned_storage_path('party-media',path,p_user);
$$;
revoke all on function public.verified_party_media_for_deletion(uuid,text[]) from public,anon,authenticated;
grant execute on function public.verified_party_media_for_deletion(uuid,text[]) to service_role;
-- A party member may replace only their own uploaded objects.
drop policy if exists "Party members update their party media" on storage.objects;
create policy "Party members update their party media" on storage.objects for update to authenticated
 using (bucket_id='party-media' and owner_id=(select auth.uid())::text)
 with check (bucket_id='party-media' and owner_id=(select auth.uid())::text and public.is_party_member((storage.foldername(name))[1]::uuid,(select auth.uid())));
commit;
