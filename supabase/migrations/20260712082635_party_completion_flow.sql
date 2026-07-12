-- Party completion flow: private Journal media, explicit proof policy, and Feed sharing.
-- This migration keeps the legacy boolean during the transition so existing clients stay safe.

alter table public.parties
  add column if not exists photo_proof_mode text;

alter table public.parties
  add column if not exists quests_enabled boolean;

-- Existing Parties were already playable. New Parties explicitly open their quest list
-- when the host is ready, so members cannot begin a free-for-all prematurely.
update public.parties set quests_enabled = true where quests_enabled is null;
alter table public.parties
  alter column quests_enabled set default false,
  alter column quests_enabled set not null;

update public.parties
set photo_proof_mode = case when photo_proof_required then 'required' else 'disabled' end
where photo_proof_mode is null;

alter table public.parties
  alter column photo_proof_mode set default 'disabled',
  alter column photo_proof_mode set not null;

alter table public.parties drop constraint if exists parties_photo_proof_mode_check;
alter table public.parties
  add constraint parties_photo_proof_mode_check
  check (photo_proof_mode in ('disabled', 'optional', 'required'));

alter table public.party_completions
  add column if not exists journal_photo_paths text[] not null default '{}',
  add column if not exists shared_photo_paths text[] not null default '{}';

alter table public.party_feed_posts
  add column if not exists post_type text not null default 'activity',
  add column if not exists elapsed_seconds integer;

update public.party_feed_posts
set post_type = case when coalesce(array_length(photo_paths, 1), 0) > 0 or caption is not null then 'adventure' else 'activity' end
where post_type = 'activity';

alter table public.party_feed_posts drop constraint if exists party_feed_posts_post_type_check;
alter table public.party_feed_posts
  add constraint party_feed_posts_post_type_check
  check (post_type in ('activity', 'adventure', 'proof'));

create index if not exists party_feed_posts_party_created_idx
  on public.party_feed_posts (party_id, created_at desc);

-- Journal media is deliberately separate from Party media. A private Journal image must
-- never become readable by the rest of a Party merely because it was uploaded during a Party quest.
insert into storage.buckets (id, name, public)
values ('journal-media', 'journal-media', false)
on conflict (id) do update set public = false;

drop policy if exists "Users read their own journal media" on storage.objects;
create policy "Users read their own journal media"
on storage.objects for select to authenticated
using (bucket_id = 'journal-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users upload their own journal media" on storage.objects;
create policy "Users upload their own journal media"
on storage.objects for insert to authenticated
with check (bucket_id = 'journal-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users update their own journal media" on storage.objects;
create policy "Users update their own journal media"
on storage.objects for update to authenticated
using (bucket_id = 'journal-media' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'journal-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete their own journal media" on storage.objects;
create policy "Users delete their own journal media"
on storage.objects for delete to authenticated
using (bucket_id = 'journal-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.create_party_v3(
  p_name text,
  p_goal text,
  p_photo_path text,
  p_max_members smallint,
  p_member_invites_enabled boolean,
  p_photo_proof_mode text,
  p_game_mode text,
  p_location_type text,
  p_location_label text,
  p_rules text[],
  p_quest_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  party_id uuid;
  party_code text;
  next_rule text;
  i integer := 0;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 50 then raise exception 'Party name must be 2–50 characters.'; end if;
  if p_game_mode not in ('everyone_together', 'free_for_all') then raise exception 'Invalid party mode.'; end if;
  if p_location_type not in ('online', 'nearby', 'specific_place', 'flexible') then raise exception 'Invalid location type.'; end if;
  if coalesce(p_photo_proof_mode, 'disabled') not in ('disabled', 'optional', 'required') then raise exception 'Invalid photo proof setting.'; end if;
  if p_max_members is not null and p_max_members not between 2 and 20 then raise exception 'Party limit must be 2–20 or unlimited.'; end if;
  if coalesce(array_length(p_quest_ids, 1), 0) = 0 then raise exception 'Choose at least one quest.'; end if;

  loop
    party_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.parties where code = party_code);
  end loop;

  insert into public.parties (
    name, code, goal, photo_path, max_members, member_invites_enabled,
    photo_proof_required, photo_proof_mode, game_mode, location_type, location_label, created_by
  ) values (
    trim(p_name), party_code, nullif(trim(coalesce(p_goal, '')), ''), nullif(trim(coalesce(p_photo_path, '')), ''),
    p_max_members, coalesce(p_member_invites_enabled, false), coalesce(p_photo_proof_mode, 'disabled') = 'required',
    coalesce(p_photo_proof_mode, 'disabled'), p_game_mode, p_location_type, nullif(trim(coalesce(p_location_label, '')), ''), current_user_id
  ) returning id into party_id;

  insert into public.party_members (party_id, user_id, role) values (party_id, current_user_id, 'leader');
  insert into public.party_quests (party_id, quest_id, position, added_by)
  select party_id, quest_id, ordinality - 1, current_user_id
  from unnest(p_quest_ids) with ordinality as list(quest_id, ordinality);

  foreach next_rule in array coalesce(p_rules, '{}') loop
    if char_length(trim(next_rule)) > 0 then
      insert into public.party_rules (party_id, body, position) values (party_id, trim(next_rule), i);
      i := i + 1;
    end if;
  end loop;

  return jsonb_build_object('id', party_id, 'code', party_code);
end;
$$;

create or replace function public.update_party_v3(
  p_party_id uuid,
  p_name text,
  p_goal text,
  p_photo_path text,
  p_max_members smallint,
  p_member_invites_enabled boolean,
  p_photo_proof_mode text,
  p_game_mode text,
  p_location_type text,
  p_location_label text,
  p_rules text[]
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  next_rule text;
  i integer := 0;
begin
  if not public.is_party_host(p_party_id, current_user_id) then raise exception 'Only the host can edit this party.'; end if;
  if coalesce(p_photo_proof_mode, 'disabled') not in ('disabled', 'optional', 'required') then raise exception 'Invalid photo proof setting.'; end if;
  if p_max_members is not null and p_max_members < public.party_member_count(p_party_id) then raise exception 'Member limit cannot be below current members.'; end if;

  update public.parties
  set name = trim(p_name),
      goal = nullif(trim(coalesce(p_goal, '')), ''),
      photo_path = nullif(trim(coalesce(p_photo_path, '')), ''),
      max_members = p_max_members,
      member_invites_enabled = coalesce(p_member_invites_enabled, false),
      photo_proof_required = coalesce(p_photo_proof_mode, 'disabled') = 'required',
      photo_proof_mode = coalesce(p_photo_proof_mode, 'disabled'),
      game_mode = p_game_mode,
      location_type = p_location_type,
      location_label = nullif(trim(coalesce(p_location_label, '')), '')
  where id = p_party_id;

  delete from public.party_rules where party_id = p_party_id;
  foreach next_rule in array coalesce(p_rules, '{}') loop
    if char_length(trim(next_rule)) > 0 then
      insert into public.party_rules (party_id, body, position) values (p_party_id, trim(next_rule), i);
      i := i + 1;
    end if;
  end loop;
end;
$$;

create or replace function public.complete_party_quest_v2(
  p_party_id uuid,
  p_quest_id uuid,
  p_today date default current_date,
  p_reflection text default null,
  p_journal_photo_paths text[] default '{}',
  p_share_to_feed boolean default false,
  p_feed_caption text default null,
  p_shared_photo_paths text[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  party_row public.parties%rowtype;
  quest_row public.quests%rowtype;
  active_round public.party_quest_rounds%rowtype;
  active_session public.party_quest_sessions%rowtype;
  started timestamptz;
  base integer;
  completion_id uuid;
  new_party_completion_id uuid;
  daily_used integer;
  fastest jsonb;
  proof_mode text;
  should_share boolean;
  feed_type text;
  elapsed_seconds integer;
begin
  select * into party_row from public.parties where id = p_party_id;
  if party_row.status <> 'active' or not public.is_party_member(p_party_id, current_user_id) then raise exception 'This party is not active.'; end if;
  select * into quest_row from public.quests where id = p_quest_id and status = 'published';
  if quest_row.id is null then raise exception 'QUEST_NOT_AVAILABLE'; end if;
  if coalesce(array_length(p_journal_photo_paths, 1), 0) > 5 then raise exception 'You can add up to five Journal photos.'; end if;
  if coalesce(array_length(p_shared_photo_paths, 1), 0) > 5 then raise exception 'You can share up to five Party photos.'; end if;

  proof_mode := coalesce(party_row.photo_proof_mode, case when party_row.photo_proof_required then 'required' else 'disabled' end);
  if proof_mode = 'required' and (coalesce(array_length(p_journal_photo_paths, 1), 0) = 0 or coalesce(array_length(p_shared_photo_paths, 1), 0) = 0) then
    raise exception 'A proof photo is required for this Party quest.';
  end if;

  select count(*) into daily_used from public.quest_completions where user_id = current_user_id and completed_on = p_today;
  if daily_used >= 5 then raise exception 'DAILY_LIMIT_REACHED'; end if;

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

  insert into public.quest_completions (
    user_id, quest_id, completed_on, reflection, xp_awarded, logged, review_public, photo_urls, party_id
  ) values (
    current_user_id, p_quest_id, p_today, nullif(trim(coalesce(p_reflection, '')), ''), base, true, false,
    coalesce(p_journal_photo_paths, '{}'), p_party_id
  ) returning id into completion_id;

  insert into public.party_completions (
    party_id, quest_id, user_id, round_id, session_id, quest_completion_id, base_xp, started_at,
    reflection, photo_paths, journal_photo_paths, shared_photo_paths
  ) values (
    p_party_id, p_quest_id, current_user_id, active_round.id, active_session.id, completion_id, base, started,
    nullif(trim(coalesce(p_reflection, '')), ''), coalesce(p_shared_photo_paths, '{}'),
    coalesce(p_journal_photo_paths, '{}'), coalesce(p_shared_photo_paths, '{}')
  ) returning id into new_party_completion_id;

  update public.quest_completions set party_completion_id = new_party_completion_id where id = completion_id;
  insert into public.party_feed_posts (
    party_id, completion_id, quest_id, user_id, caption, photo_paths, post_type, elapsed_seconds
  ) values (
    p_party_id, new_party_completion_id, p_quest_id, current_user_id,
    case when should_share then nullif(trim(coalesce(p_feed_caption, '')), '') else null end,
    case when should_share then coalesce(p_shared_photo_paths, '{}') else '{}' end,
    feed_type, elapsed_seconds
  );

  if party_row.game_mode = 'free_for_all' then
    update public.party_quest_sessions set status = 'completed', completed_at = now() where id = active_session.id;
  end if;

  select jsonb_build_object(
    'name', coalesce(pr.display_name, 'Adventurer'),
    'emoji', pr.emoji,
    'elapsedSeconds', extract(epoch from pc.completed_at - pc.started_at)::integer
  ) into fastest
  from public.party_completions pc
  join public.profiles pr on pr.id = pc.user_id
  where pc.party_id = p_party_id and pc.quest_id = p_quest_id
  order by pc.completed_at - pc.started_at, pc.completed_at
  limit 1;

  return jsonb_build_object(
    'completionId', new_party_completion_id,
    'xpAwarded', base,
    'dailyUsed', daily_used + 1,
    'dailyLimit', 5,
    'fastest', fastest,
    'proofMode', proof_mode,
    'feedShared', should_share,
    'elapsedSeconds', elapsed_seconds
  );
end;
$$;

revoke execute on function public.create_party_v3(text, text, text, smallint, boolean, text, text, text, text, text[], uuid[]) from public;
revoke execute on function public.update_party_v3(uuid, text, text, text, smallint, boolean, text, text, text, text, text[]) from public;
revoke execute on function public.complete_party_quest_v2(uuid, uuid, date, text, text[], boolean, text, text[]) from public;
grant execute on function public.create_party_v3(text, text, text, smallint, boolean, text, text, text, text, text[], uuid[]) to authenticated;
grant execute on function public.update_party_v3(uuid, text, text, text, smallint, boolean, text, text, text, text, text[]) to authenticated;
grant execute on function public.complete_party_quest_v2(uuid, uuid, date, text, text[], boolean, text, text[]) to authenticated;

-- Read state is per Party/member so Feed and Leaderboard tabs can show a useful, durable badge.
create table if not exists public.party_member_notifications (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('feed', 'leaderboard')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (party_id, user_id, kind, created_at)
);
create index if not exists party_member_notifications_unread_idx
  on public.party_member_notifications (party_id, user_id, kind, created_at desc)
  where read_at is null;
alter table public.party_member_notifications enable row level security;
create policy "Party members read own party notifications"
on public.party_member_notifications for select to authenticated
using (user_id = (select auth.uid()) and public.is_party_participant(party_id, (select auth.uid())));

create or replace function public.mark_party_notifications_read(p_party_id uuid, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_kind not in ('feed', 'leaderboard') then raise exception 'Invalid Party notification type.'; end if;
  if not public.is_party_participant(p_party_id, auth.uid()) then raise exception 'You are not part of this Party.'; end if;
  update public.party_member_notifications
  set read_at = now()
  where party_id = p_party_id and user_id = auth.uid() and kind = p_kind and read_at is null;
end;
$$;
revoke execute on function public.mark_party_notifications_read(uuid, text) from public;
grant execute on function public.mark_party_notifications_read(uuid, text) to authenticated;

-- Every completion creates a Feed activity, so create durable unread markers for every
-- active member (including the person who completed the quest). Keeping this in a trigger
-- means completion, Feed visibility, and the read state commit together.
create or replace function public.notify_party_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.party_member_notifications (party_id, user_id, kind)
  select new.party_id, pm.user_id, notice.kind
  from public.party_members pm
  cross join (values ('feed'::text), ('leaderboard'::text)) as notice(kind)
  where pm.party_id = new.party_id and pm.status = 'active';
  return new;
end;
$$;
drop trigger if exists party_feed_posts_create_notifications on public.party_feed_posts;
create trigger party_feed_posts_create_notifications
after insert on public.party_feed_posts
for each row execute function public.notify_party_completion();

-- The Party screen requires a viewer-specific read model. This replacement deliberately
-- keeps private Journal paths out of the payload: only Party Feed media is returned.
create or replace function public.party_summary(p_party_id uuid, p_viewer uuid)
returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'code', p.code, 'goal', p.goal, 'photoPath', p.photo_path,
    'gameMode', p.game_mode, 'status', p.status, 'memberCount', public.party_member_count(p.id),
    'maxMembers', p.max_members, 'endedAt', p.ended_at,
    'viewerLeftEarly', exists (
      select 1 from public.party_members pm
      where pm.party_id = p.id and pm.user_id = p_viewer and pm.status = 'left' and p.status = 'ended'
    ),
    'myRank', coalesce((
      select ranked.rank from (
        select member.user_id,
          dense_rank() over (order by coalesce(sum(case when p.game_mode = 'free_for_all' then pc.base_xp else pc.base_xp + pc.bonus_xp end), 0) desc) as rank
        from public.party_members member
        left join public.party_completions pc on pc.party_id = p.id and pc.user_id = member.user_id
        where member.party_id = p.id
        group by member.user_id
      ) ranked where ranked.user_id = p_viewer
    ), null),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', prof.id, 'displayName', coalesce(prof.display_name, 'Adventurer'),
        'emoji', prof.emoji, 'avatarColor', prof.avatar_color, 'role', pm.role, 'status', pm.status
      ) order by (pm.user_id = p_viewer) desc, pm.role desc, pm.joined_at)
      from public.party_members pm
      join public.profiles prof on prof.id = pm.user_id
      where pm.party_id = p.id
    ), '[]'::jsonb)
  ) from public.parties p where p.id = p_party_id;
$$;

create or replace function public.get_party_detail(p_party_id uuid)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not public.is_party_participant(p_party_id, current_user_id) then
    raise exception 'You are not part of this party.';
  end if;

  return (
    select public.party_summary(p.id, current_user_id) || jsonb_build_object(
      'isHost', public.is_party_host(p.id, current_user_id),
      'questsEnabled', p.quests_enabled,
      'memberInvitesEnabled', p.member_invites_enabled,
      'photoProofMode', coalesce(p.photo_proof_mode, case when p.photo_proof_required then 'required' else 'disabled' end),
      'locationType', p.location_type,
      'locationLabel', p.location_label,
      'rules', coalesce((select jsonb_agg(body order by position) from public.party_rules where party_id = p.id), '[]'::jsonb),
      'myActiveQuestId', case when p.game_mode = 'free_for_all' then (
        select session.quest_id from public.party_quest_sessions session
        where session.party_id = p.id and session.user_id = current_user_id and session.status = 'active'
        order by session.started_at desc limit 1
      ) else null end,
      'quests', coalesce((
        select jsonb_agg(jsonb_build_object(
          'questId', q.id, 'title', q.title, 'description', q.description,
          'xp', q.experience_points, 'color', q.accent_color, 'position', pq.position,
          'suggestionCount', (select count(*)::integer from public.party_quest_suggestions suggestion where suggestion.party_id = p.id and suggestion.quest_id = q.id),
          'myCompletion', case when p.game_mode = 'everyone_together' then exists (
            select 1 from public.party_completions completion
            join public.party_quest_rounds round on round.id = completion.round_id
            where completion.party_id = p.id and completion.quest_id = q.id and completion.user_id = current_user_id
              and round.status = 'active'
          ) else false end,
          'fastest', (
            select jsonb_build_object(
              'name', coalesce(profile.display_name, 'Adventurer'),
              'elapsedSeconds', extract(epoch from completion.completed_at - completion.started_at)::integer
            )
            from public.party_completions completion
            join public.profiles profile on profile.id = completion.user_id
            where completion.party_id = p.id and completion.quest_id = q.id
              and (p.game_mode = 'free_for_all' or completion.round_id = (
                select round.id from public.party_quest_rounds round
                where round.party_id = p.id and round.quest_id = q.id and round.status = 'active'
                order by round.started_at desc limit 1
              ))
            order by completion.completed_at - completion.started_at, completion.completed_at
            limit 1
          )
        ) order by pq.position)
        from public.party_quests pq
        join public.quests q on q.id = pq.quest_id
        where pq.party_id = p.id and pq.status = 'available'
      ), '[]'::jsonb),
      'activeRound', (
        select jsonb_build_object(
          'id', round.id, 'questId', round.quest_id, 'startedAt', round.started_at, 'status', round.status,
          'completedCount', (select count(*)::integer from public.party_completions completion where completion.round_id = round.id),
          'totalMembers', public.party_member_count(p.id),
          'topFinishers', coalesce((
            select jsonb_agg(jsonb_build_object(
              'userId', finisher.user_id, 'name', finisher.display_name, 'emoji', finisher.emoji,
              'elapsedSeconds', finisher.elapsed_seconds, 'rank', finisher.rank
            ) order by finisher.rank)
            from (
              select completion.user_id, coalesce(profile.display_name, 'Adventurer') as display_name,
                profile.emoji, extract(epoch from completion.completed_at - completion.started_at)::integer as elapsed_seconds,
                row_number() over (order by completion.completed_at, completion.id) as rank
              from public.party_completions completion
              join public.profiles profile on profile.id = completion.user_id
              where completion.round_id = round.id
            ) finisher
          ), '[]'::jsonb)
        )
        from public.party_quest_rounds round
        where round.party_id = p.id and round.status = 'active'
        order by round.started_at desc limit 1
      ),
      'unreadFeedCount', (select count(*)::integer from public.party_member_notifications notification where notification.party_id = p.id and notification.user_id = current_user_id and notification.kind = 'feed' and notification.read_at is null),
      'unreadLeaderboardCount', (select count(*)::integer from public.party_member_notifications notification where notification.party_id = p.id and notification.user_id = current_user_id and notification.kind = 'leaderboard' and notification.read_at is null),
      'leaderboard', coalesce((
        select jsonb_agg(jsonb_build_object(
          'userId', score.user_id, 'displayName', coalesce(profile.display_name, 'Adventurer'),
          'emoji', profile.emoji, 'avatarColor', profile.avatar_color, 'xp', score.xp, 'rank', score.rank
        ) order by score.rank, score.user_id)
        from (
          select member.user_id,
            coalesce(sum(case when p.game_mode = 'free_for_all' then completion.base_xp else completion.base_xp + completion.bonus_xp end), 0)::integer as xp,
            dense_rank() over (order by coalesce(sum(case when p.game_mode = 'free_for_all' then completion.base_xp else completion.base_xp + completion.bonus_xp end), 0) desc) as rank
          from public.party_members member
          left join public.party_completions completion on completion.party_id = p.id and completion.user_id = member.user_id
          where member.party_id = p.id
          group by member.user_id
        ) score
        join public.profiles profile on profile.id = score.user_id
      ), '[]'::jsonb),
      'feed', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', post.id, 'questId', post.quest_id, 'questTitle', q.title,
          'userName', coalesce(profile.display_name, 'Adventurer'), 'userEmoji', profile.emoji,
          'caption', post.caption, 'photoPaths', post.photo_paths, 'postType', post.post_type,
          'elapsedSeconds', post.elapsed_seconds, 'createdAt', post.created_at,
          'reactions', coalesce((
            select jsonb_agg(jsonb_build_object('emoji', reaction.emoji, 'count', reaction.count, 'reacted', reaction.reacted))
            from (
              select emoji, count(*)::integer as count, bool_or(user_id = current_user_id) as reacted
              from public.party_feed_reactions where post_id = post.id group by emoji
            ) reaction
          ), '[]'::jsonb)
        ) order by post.created_at desc)
        from public.party_feed_posts post
        join public.quests q on q.id = post.quest_id
        join public.profiles profile on profile.id = post.user_id
        where post.party_id = p.id
      ), '[]'::jsonb)
    )
    from public.parties p
    where p.id = p_party_id
  );
end;
$$;

revoke execute on function public.get_party_detail(uuid) from public;
grant execute on function public.get_party_detail(uuid) to authenticated;

create or replace function public.set_party_quests_enabled(p_party_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_party_host(p_party_id, auth.uid()) then
    raise exception 'Only the host can open or pause the Party quest list.';
  end if;
  update public.parties set quests_enabled = coalesce(p_enabled, false) where id = p_party_id and status = 'active';
end;
$$;
revoke execute on function public.set_party_quests_enabled(uuid, boolean) from public;
grant execute on function public.set_party_quests_enabled(uuid, boolean) to authenticated;

create or replace function public.start_party_quest(p_party_id uuid, p_quest_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare party_row public.parties%rowtype; round_id uuid; session_id uuid; started timestamptz;
begin
  select * into party_row from public.parties where id = p_party_id;
  if party_row.status <> 'active' or not public.is_party_member(p_party_id, auth.uid()) then
    raise exception 'This party is not active.';
  end if;
  if public.party_member_count(p_party_id) < 2 then
    raise exception 'A party needs two active members to start a quest.';
  end if;
  if not exists (select 1 from public.party_quests where party_id = p_party_id and quest_id = p_quest_id and status = 'available') then
    raise exception 'This quest is not in the party.';
  end if;
  if party_row.game_mode = 'free_for_all' and not party_row.quests_enabled then
    raise exception 'The host has not opened the Party quest list yet.';
  end if;
  if party_row.game_mode = 'everyone_together' then
    if not public.is_party_host(p_party_id, auth.uid()) then raise exception 'Only the host starts shared quests.'; end if;
    if exists (select 1 from public.party_quest_rounds where party_id = p_party_id and status = 'active') then raise exception 'End the current shared quest first.'; end if;
    insert into public.party_quest_rounds (party_id, quest_id, started_by)
    values (p_party_id, p_quest_id, auth.uid()) returning id, started_at into round_id, started;
    return jsonb_build_object('roundId', round_id, 'startedAt', started);
  end if;
  insert into public.party_quest_sessions (party_id, quest_id, user_id)
  values (p_party_id, p_quest_id, auth.uid()) returning id, started_at into session_id, started;
  return jsonb_build_object('sessionId', session_id, 'startedAt', started);
end;
$$;
revoke execute on function public.start_party_quest(uuid, uuid) from public;
grant execute on function public.start_party_quest(uuid, uuid) to authenticated;

create or replace function public.get_party_journal_history()
returns jsonb language sql security definer set search_path = '' stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'partyId', p.id, 'name', p.name, 'status', p.status, 'endedAt', p.ended_at,
    'leftEarly', pm.status = 'left' and p.status = 'ended',
    'entryCount', (select count(*)::integer from public.party_completions pc where pc.party_id = p.id and pc.user_id = auth.uid()),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(profile.display_name, 'Adventurer'), 'emoji', profile.emoji, 'color', profile.avatar_color) order by member.joined_at)
      from public.party_members member join public.profiles profile on profile.id = member.user_id where member.party_id = p.id
    ), '[]'::jsonb),
    'rankings', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(profile.display_name, 'Adventurer'), 'emoji', profile.emoji, 'xp', score.xp, 'rank', score.rank) order by score.rank)
      from (
        select completion.user_id,
          sum(case when p.game_mode = 'free_for_all' then completion.base_xp else completion.base_xp + completion.bonus_xp end)::integer as xp,
          dense_rank() over (order by sum(case when p.game_mode = 'free_for_all' then completion.base_xp else completion.base_xp + completion.bonus_xp end) desc) as rank
        from public.party_completions completion where completion.party_id = p.id group by completion.user_id
      ) score join public.profiles profile on profile.id = score.user_id
    ), '[]'::jsonb)
  ) order by coalesce(p.ended_at, p.created_at) desc), '[]'::jsonb)
  from public.parties p
  join public.party_members pm on pm.party_id = p.id and pm.user_id = auth.uid()
  where exists (select 1 from public.party_completions completion where completion.party_id = p.id and completion.user_id = auth.uid());
$$;
revoke execute on function public.get_party_journal_history() from public;
grant execute on function public.get_party_journal_history() to authenticated;
