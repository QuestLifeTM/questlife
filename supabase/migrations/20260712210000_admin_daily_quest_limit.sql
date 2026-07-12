-- Global quest-engine settings are only editable through admin RPCs. The daily
-- cap remains enabled by default, while super admins can temporarily disable it
-- for testing or special events.
create table if not exists public.quest_engine_settings (
  id boolean primary key default true check (id),
  daily_limit_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.quest_engine_settings enable row level security;

insert into public.quest_engine_settings (id, daily_limit_enabled)
values (true, true)
on conflict (id) do nothing;

create or replace function public.daily_quest_limit_is_enabled()
returns boolean language sql security definer set search_path = '' stable as $$
  select coalesce((select daily_limit_enabled from public.quest_engine_settings where id), true);
$$;

create or replace function public.get_daily_quest_limit_enabled()
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only super admins can view quest limit settings.';
  end if;
  return public.daily_quest_limit_is_enabled();
end;
$$;

create or replace function public.set_daily_quest_limit_enabled(p_enabled boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only super admins can change quest limit settings.';
  end if;

  update public.quest_engine_settings
  set daily_limit_enabled = coalesce(p_enabled, true), updated_at = now(), updated_by = auth.uid()
  where id;

  return public.daily_quest_limit_is_enabled();
end;
$$;

revoke all on function public.daily_quest_limit_is_enabled() from public;
revoke all on function public.get_daily_quest_limit_enabled() from public, anon;
revoke all on function public.set_daily_quest_limit_enabled(boolean) from public, anon;
grant execute on function public.daily_quest_limit_is_enabled() to authenticated;
grant execute on function public.get_daily_quest_limit_enabled() to authenticated;
grant execute on function public.set_daily_quest_limit_enabled(boolean) to authenticated;

-- Direct inserts (including admin tooling) must follow the same rule as the
-- completion RPCs. The advisory lock also prevents two near-simultaneous
-- completions from slipping past the five-quest cap.
create or replace function public.enforce_daily_quest_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.daily_quest_limit_is_enabled() then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || new.completed_on::text, 0));

  if (select count(*) from public.quest_completions where user_id = new.user_id and completed_on = new.completed_on) >= 5 then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;
  return new;
end;
$$;

drop trigger if exists quest_completions_enforce_daily_limit on public.quest_completions;
create trigger quest_completions_enforce_daily_limit
before insert on public.quest_completions
for each row execute function public.enforce_daily_quest_limit();

create or replace function public.start_quest_session(
  p_quest_id uuid, p_today date default current_date, p_source text default 'explore', p_pack_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); daily_used integer; session_id uuid;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.quest_sessions where user_id = current_user_id and status = 'active') then raise exception 'ACTIVE_SESSION_EXISTS'; end if;
  if exists (select 1 from public.quest_completions where user_id = current_user_id and quest_id = p_quest_id) then raise exception 'QUEST_ALREADY_COMPLETED'; end if;
  select count(*) into daily_used from public.quest_completions where user_id = current_user_id and completed_on = p_today;
  if public.daily_quest_limit_is_enabled() and daily_used >= 5 then raise exception 'DAILY_LIMIT_REACHED'; end if;
  if not exists (select 1 from public.quests where id = p_quest_id and status = 'published') then raise exception 'QUEST_NOT_AVAILABLE'; end if;
  insert into public.quest_sessions (user_id, quest_id, source, pack_id) values (current_user_id, p_quest_id, p_source, p_pack_id) returning id into session_id;
  return jsonb_build_object('sessionId', session_id);
end;
$$;

create or replace function public.complete_quest_v2(
  p_quest_id uuid, p_today date default current_date, p_logged boolean default true, p_reflection text default null,
  p_rating smallint default null, p_review text default null, p_review_public boolean default true, p_photo_urls text[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); quest record; daily_used integer; awarded integer; completion_id uuid;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  select * into quest from public.quests where id = p_quest_id and status = 'published';
  if quest.id is null then raise exception 'QUEST_NOT_AVAILABLE'; end if;
  if exists (select 1 from public.quest_completions where user_id = current_user_id and quest_id = p_quest_id) then raise exception 'QUEST_ALREADY_COMPLETED'; end if;
  select count(*) into daily_used from public.quest_completions where user_id = current_user_id and completed_on = p_today;
  if public.daily_quest_limit_is_enabled() and daily_used >= 5 then raise exception 'DAILY_LIMIT_REACHED'; end if;
  if p_logged and (p_rating is null or p_rating < 1 or p_rating > 5) then raise exception 'RATING_REQUIRED'; end if;
  awarded := case when p_logged then quest.experience_points else floor(quest.experience_points / 2.0)::integer end;
  insert into public.quest_completions (user_id, quest_id, completed_on, reflection, xp_awarded, logged, rating, review_text, review_public, photo_urls)
  values (current_user_id, p_quest_id, p_today, nullif(trim(coalesce(p_reflection, '')), ''), awarded, p_logged, case when p_logged then p_rating else null end, case when p_logged then nullif(trim(coalesce(p_review, '')), '') else null end, p_review_public, coalesce(p_photo_urls, '{}')) returning id into completion_id;
  update public.quest_sessions set status = 'completed', ended_at = now() where user_id = current_user_id and quest_id = p_quest_id and status = 'active';
  return jsonb_build_object('completionId', completion_id, 'xpAwarded', awarded, 'dailyUsed', daily_used + 1, 'dailyLimit', case when public.daily_quest_limit_is_enabled() then 5 else 0 end);
end;
$$;

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

create or replace function public.get_quest_engine_state(p_today date default current_date)
returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare current_user_id uuid := auth.uid(); daily_used integer; active_session jsonb; today_completions jsonb;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  select count(*) into daily_used from public.quest_completions where user_id = current_user_id and completed_on = p_today;
  select jsonb_build_object('id', s.id, 'questId', s.quest_id, 'source', s.source, 'packId', s.pack_id, 'startedAt', s.started_at) into active_session
  from public.quest_sessions s where s.user_id = current_user_id and s.status = 'active' limit 1;
  select coalesce(jsonb_agg(row order by row->>'completedAt' desc), '[]'::jsonb) into today_completions
  from (select jsonb_build_object('completionId', c.id, 'questId', c.quest_id, 'xpAwarded', c.xp_awarded, 'logged', c.logged, 'completedAt', c.created_at) as row from public.quest_completions c where c.user_id = current_user_id and c.completed_on = p_today) rows;
  return jsonb_build_object('dailyLimit', case when public.daily_quest_limit_is_enabled() then 5 else 0 end, 'dailyUsed', daily_used, 'activeSession', active_session, 'todayCompletions', today_completions);
end;
$$;
