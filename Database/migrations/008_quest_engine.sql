-- Quest engine: active quest sessions, the daily quest allowance, and rich
-- quest completion logging ("Log your lore").
--
-- Design notes:
-- * A user can have exactly ONE active quest session at a time (partial unique
--   index). Starting, abandoning, saving-for-later, and completing all go
--   through security-definer RPCs so the rules cannot be bypassed.
-- * The daily allowance is 5 completed quests per local calendar day. The app
--   passes its local date (p_today) so the allowance resets at the user's
--   midnight.
-- * quest_completions grows logging fields: xp_awarded (half XP when the lore
--   log is skipped), star rating, public review, and photo URLs.
-- * profiles.total_xp is denormalised and maintained by trigger so levels and
--   leaderboards never need to scan completions.

-- ---------------------------------------------------------------------------
-- quest_completions: lore logging fields
-- ---------------------------------------------------------------------------

alter table public.quest_completions
add column if not exists xp_awarded integer,
add column if not exists logged boolean not null default true,
add column if not exists rating smallint check (rating between 1 and 5),
add column if not exists review_text text,
add column if not exists review_public boolean not null default true,
add column if not exists photo_urls text[] not null default '{}';

update public.quest_completions completions
set xp_awarded = quests.experience_points
from public.quests
where quests.id = completions.quest_id
  and completions.xp_awarded is null;

update public.quest_completions
set xp_awarded = 0
where xp_awarded is null;

alter table public.quest_completions
alter column xp_awarded set not null;

alter table public.quest_completions
alter column xp_awarded set default 0;

-- ---------------------------------------------------------------------------
-- profiles: denormalised total XP + identity fields used across the app
-- ---------------------------------------------------------------------------

alter table public.profiles
add column if not exists total_xp integer not null default 0,
add column if not exists username text,
add column if not exists bio text,
add column if not exists emoji text not null default '😊',
add column if not exists avatar_color text not null default '#4da8ff',
add column if not exists title text;

-- Backfill usernames from the email prefix, de-duplicated with a short suffix.
update public.profiles
set username = lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '', 'g')) || '_' || substr(id::text, 1, 4)
where username is null;

create unique index if not exists profiles_username_idx on public.profiles(lower(username));

update public.profiles
set total_xp = coalesce(totals.xp, 0)
from (
  select user_id, sum(xp_awarded)::integer as xp
  from public.quest_completions
  group by user_id
) as totals
where totals.user_id = profiles.id;

create or replace function public.apply_completion_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set total_xp = total_xp + new.xp_awarded
  where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists quest_completions_apply_xp on public.quest_completions;
create trigger quest_completions_apply_xp
after insert on public.quest_completions
for each row
execute function public.apply_completion_xp();

-- ---------------------------------------------------------------------------
-- quest_sessions: one active quest at a time
-- ---------------------------------------------------------------------------

create table if not exists public.quest_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  source text not null default 'explore' check (source in ('explore', 'pack', 'plan', 'featured', 'saved', 'social')),
  pack_id uuid references public.adventure_packs(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned', 'saved_for_later')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create unique index if not exists quest_sessions_one_active_idx
on public.quest_sessions(user_id)
where status = 'active';

create index if not exists quest_sessions_user_idx on public.quest_sessions(user_id, started_at desc);

alter table public.quest_sessions enable row level security;

drop policy if exists "Users can read their quest sessions" on public.quest_sessions;
create policy "Users can read their quest sessions"
on public.quest_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- RPC: start a quest session
-- ---------------------------------------------------------------------------

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
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1 from public.quest_sessions
    where user_id = current_user_id and status = 'active'
  ) then
    raise exception 'ACTIVE_SESSION_EXISTS';
  end if;

  if exists (
    select 1 from public.quest_completions
    where user_id = current_user_id and quest_id = p_quest_id
  ) then
    raise exception 'QUEST_ALREADY_COMPLETED';
  end if;

  select count(*) into daily_used
  from public.quest_completions
  where user_id = current_user_id and completed_on = p_today;

  if daily_used >= 5 then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;

  if not exists (
    select 1 from public.quests
    where id = p_quest_id and status = 'published'
  ) then
    raise exception 'QUEST_NOT_AVAILABLE';
  end if;

  insert into public.quest_sessions (user_id, quest_id, source, pack_id)
  values (current_user_id, p_quest_id, p_source, p_pack_id)
  returning id into session_id;

  return jsonb_build_object('sessionId', session_id);
end;
$$;

grant execute on function public.start_quest_session(uuid, date, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: abandon the active session
-- ---------------------------------------------------------------------------

create or replace function public.abandon_quest_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.quest_sessions
  set status = 'abandoned', ended_at = now()
  where id = p_session_id
    and user_id = auth.uid()
    and status = 'active';
end;
$$;

grant execute on function public.abandon_quest_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: move the active session's quest to saved-for-later
-- ---------------------------------------------------------------------------

create or replace function public.save_quest_session_for_later(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  session record;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into session
  from public.quest_sessions
  where id = p_session_id
    and user_id = current_user_id
    and status = 'active';

  if session.id is null then
    raise exception 'SESSION_NOT_ACTIVE';
  end if;

  update public.quest_sessions
  set status = 'saved_for_later', ended_at = now()
  where id = session.id;

  insert into public.saved_quests (user_id, quest_id)
  values (current_user_id, session.quest_id)
  on conflict do nothing;
end;
$$;

grant execute on function public.save_quest_session_for_later(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: complete a quest (with or without a running session)
-- ---------------------------------------------------------------------------
-- When p_logged is false ("skip the lore"), half XP is awarded. When true, a
-- star rating (1-5) is required; the review is optional and public by default.

create or replace function public.complete_quest_v2(
  p_quest_id uuid,
  p_today date default current_date,
  p_logged boolean default true,
  p_reflection text default null,
  p_rating smallint default null,
  p_review text default null,
  p_review_public boolean default true,
  p_photo_urls text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  quest record;
  daily_used integer;
  awarded integer;
  completion_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into quest
  from public.quests
  where id = p_quest_id and status = 'published';

  if quest.id is null then
    raise exception 'QUEST_NOT_AVAILABLE';
  end if;

  if exists (
    select 1 from public.quest_completions
    where user_id = current_user_id and quest_id = p_quest_id
  ) then
    raise exception 'QUEST_ALREADY_COMPLETED';
  end if;

  select count(*) into daily_used
  from public.quest_completions
  where user_id = current_user_id and completed_on = p_today;

  if daily_used >= 5 then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;

  if p_logged and (p_rating is null or p_rating < 1 or p_rating > 5) then
    raise exception 'RATING_REQUIRED';
  end if;

  awarded := case when p_logged then quest.experience_points else floor(quest.experience_points / 2.0)::integer end;

  insert into public.quest_completions (
    user_id, quest_id, completed_on, reflection,
    xp_awarded, logged, rating, review_text, review_public, photo_urls
  )
  values (
    current_user_id, p_quest_id, p_today, nullif(trim(coalesce(p_reflection, '')), ''),
    awarded, p_logged,
    case when p_logged then p_rating else null end,
    case when p_logged then nullif(trim(coalesce(p_review, '')), '') else null end,
    p_review_public,
    coalesce(p_photo_urls, '{}')
  )
  returning id into completion_id;

  update public.quest_sessions
  set status = 'completed', ended_at = now()
  where user_id = current_user_id
    and quest_id = p_quest_id
    and status = 'active';

  return jsonb_build_object(
    'completionId', completion_id,
    'xpAwarded', awarded,
    'dailyUsed', daily_used + 1,
    'dailyLimit', 5
  );
end;
$$;

grant execute on function public.complete_quest_v2(uuid, date, boolean, text, smallint, text, boolean, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: engine state for the lobby (allowance, active session, today's quests)
-- ---------------------------------------------------------------------------

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
  active_session jsonb;
  today_completions jsonb;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select count(*) into daily_used
  from public.quest_completions
  where user_id = current_user_id and completed_on = p_today;

  select jsonb_build_object(
    'id', s.id,
    'questId', s.quest_id,
    'source', s.source,
    'packId', s.pack_id,
    'startedAt', s.started_at
  )
  into active_session
  from public.quest_sessions s
  where s.user_id = current_user_id and s.status = 'active'
  limit 1;

  select coalesce(jsonb_agg(row order by row->>'completedAt' desc), '[]'::jsonb)
  into today_completions
  from (
    select jsonb_build_object(
      'completionId', c.id,
      'questId', c.quest_id,
      'xpAwarded', c.xp_awarded,
      'logged', c.logged,
      'completedAt', c.created_at
    ) as row
    from public.quest_completions c
    where c.user_id = current_user_id and c.completed_on = p_today
  ) as rows;

  return jsonb_build_object(
    'dailyLimit', 5,
    'dailyUsed', daily_used,
    'activeSession', active_session,
    'todayCompletions', today_completions
  );
end;
$$;

grant execute on function public.get_quest_engine_state(date) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: public reviews for a quest's info page
-- ---------------------------------------------------------------------------

create or replace function public.get_quest_reviews(p_quest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  reviews jsonb;
  summary jsonb;
begin
  select jsonb_build_object(
    'averageRating', round(avg(rating)::numeric, 1),
    'ratingCount', count(rating)
  )
  into summary
  from public.quest_completions
  where quest_id = p_quest_id and rating is not null;

  select coalesce(jsonb_agg(row order by row->>'createdAt' desc), '[]'::jsonb)
  into reviews
  from (
    select jsonb_build_object(
      'reviewerName', coalesce(prof.display_name, 'Adventurer'),
      'reviewerEmoji', coalesce(prof.emoji, '😊'),
      'rating', c.rating,
      'reviewText', c.review_text,
      'photoUrls', c.photo_urls,
      'createdAt', c.created_at
    ) as row
    from public.quest_completions c
    join public.profiles prof on prof.id = c.user_id
    where c.quest_id = p_quest_id
      and c.rating is not null
      and c.review_public
    limit 25
  ) as rows;

  return jsonb_build_object('summary', summary, 'reviews', reviews);
end;
$$;

grant execute on function public.get_quest_reviews(uuid) to authenticated;
