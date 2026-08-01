-- Private Parties: collaborative quest sessions, scoring, media and history.
-- All mutations are RPCs so member/host permissions and XP remain authoritative.

alter table public.parties
  add column if not exists code text,
  add column if not exists goal text,
  add column if not exists photo_path text,
  add column if not exists max_members smallint,
  add column if not exists member_invites_enabled boolean not null default false,
  add column if not exists photo_proof_required boolean not null default false,
  add column if not exists location_type text not null default 'flexible',
  add column if not exists location_label text,
  add column if not exists status text not null default 'active',
  add column if not exists ended_at timestamptz;

alter table public.parties drop constraint if exists parties_game_mode_check;
update public.parties
set game_mode = case game_mode when 'together' then 'everyone_together' else 'free_for_all' end
where game_mode in ('together', 'relay');
alter table public.parties
  add constraint parties_game_mode_check check (game_mode in ('everyone_together', 'free_for_all')),
  add constraint parties_status_check check (status in ('active', 'ended')),
  add constraint parties_member_limit_check check (max_members is null or max_members between 2 and 20),
  add constraint parties_location_check check (location_type in ('online', 'nearby', 'specific_place', 'flexible'));

update public.parties set code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)) where code is null;
alter table public.parties alter column code set not null;
create unique index if not exists parties_code_idx on public.parties(code);
create index if not exists parties_active_created_idx on public.parties(status, created_at desc);
create unique index if not exists party_invites_pending_unique on public.party_invites(party_id, recipient_id) where status = 'pending';

alter table public.party_members
  add column if not exists status text not null default 'active',
  add column if not exists left_at timestamptz;
alter table public.party_members drop constraint if exists party_members_status_check;
alter table public.party_members add constraint party_members_status_check check (status in ('active', 'left'));
create index if not exists party_members_active_idx on public.party_members(party_id, status, joined_at);

create or replace function public.is_party_member(p_party_id uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.party_members
    where party_id = p_party_id and user_id = p_user and status = 'active'
  );
$$;

create or replace function public.is_party_participant(p_party_id uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.party_members where party_id = p_party_id and user_id = p_user);
$$;

create or replace function public.is_party_host(p_party_id uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.party_members
    where party_id = p_party_id and user_id = p_user and role = 'leader' and status = 'active'
  );
$$;

create table if not exists public.party_rules (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 180),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (party_id, position)
);
create index if not exists party_rules_party_idx on public.party_rules(party_id, position);
alter table public.party_rules enable row level security;
create policy "Party participants read rules" on public.party_rules for select to authenticated using (public.is_party_participant(party_id, (select auth.uid())));

create table if not exists public.party_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text not null,
  description text not null,
  icon text not null default '🎉',
  accent_color text not null default '#4da8ff',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists party_templates_title_idx on public.party_templates(lower(title));
create table if not exists public.party_template_quests (
  template_id uuid not null references public.party_templates(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  position smallint not null,
  primary key (template_id, quest_id),
  unique (template_id, position)
);
alter table public.party_templates enable row level security;
alter table public.party_template_quests enable row level security;
create policy "Authenticated users read party templates" on public.party_templates for select to authenticated using (active);
create policy "Authenticated users read party template quests" on public.party_template_quests for select to authenticated using (exists (select 1 from public.party_templates t where t.id = template_id and t.active));

insert into public.party_templates (title, subtitle, description, icon, accent_color)
select seed.title, seed.subtitle, seed.description, seed.icon, seed.accent_color
from (values
  ('Weekend Wanderers', 'A bright shared weekend', 'A friendly mix of low-pressure quests for a weekend together.', '🗺️', '#4da8ff'),
  ('Feel-Good Crew', 'Small wins, shared', 'A gentle set of quests for friends who want to keep each other moving.', '✨', '#27ae60'),
  ('After-Work Adventure', 'Make an evening memorable', 'A playful collection for colleagues and friends after the day is done.', '🌇', '#f39c12')
) as seed(title, subtitle, description, icon, accent_color)
where not exists (select 1 from public.party_templates t where lower(t.title) = lower(seed.title));

insert into public.party_template_quests (template_id, quest_id, position)
select t.id, q.id, q.position - 1
from public.party_templates t
cross join lateral (
  select id, row_number() over (order by title)::smallint as position
  from public.quests where status = 'published' order by title limit 3
) q
where not exists (select 1 from public.party_template_quests ptq where ptq.template_id = t.id);

alter table public.party_quests add column if not exists status text not null default 'available';
alter table public.party_quests drop constraint if exists party_quests_status_check;
alter table public.party_quests add constraint party_quests_status_check check (status in ('available', 'archived'));
drop policy if exists "Members can manage party quests" on public.party_quests;

create table if not exists public.party_quest_suggestions (
  party_id uuid not null references public.parties(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (party_id, quest_id, user_id)
);
create index if not exists party_suggestions_party_idx on public.party_quest_suggestions(party_id, created_at desc);
alter table public.party_quest_suggestions enable row level security;
create policy "Party members read suggestions" on public.party_quest_suggestions for select to authenticated using (public.is_party_member(party_id, (select auth.uid())));
create policy "Party members suggest quests" on public.party_quest_suggestions for insert to authenticated with check (user_id = (select auth.uid()) and public.is_party_member(party_id, (select auth.uid())));

create table if not exists public.party_quest_rounds (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  started_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active', 'ended')),
  unique nulls not distinct (party_id, quest_id, status)
);
create index if not exists party_rounds_party_idx on public.party_quest_rounds(party_id, status, started_at desc);
alter table public.party_quest_rounds enable row level security;
create policy "Party participants read rounds" on public.party_quest_rounds for select to authenticated using (public.is_party_participant(party_id, (select auth.uid())));

create table if not exists public.party_quest_sessions (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed')),
  unique nulls not distinct (party_id, quest_id, user_id, status)
);
create index if not exists party_sessions_user_idx on public.party_quest_sessions(user_id, status, started_at desc);
alter table public.party_quest_sessions enable row level security;
create policy "Party participants read personal sessions" on public.party_quest_sessions for select to authenticated using (public.is_party_participant(party_id, (select auth.uid())));

alter table public.quest_completions
  add column if not exists party_id uuid references public.parties(id) on delete set null,
  add column if not exists party_completion_id uuid;
create index if not exists quest_completions_party_idx on public.quest_completions(party_id, created_at desc) where party_id is not null;

create table if not exists public.party_completions (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  round_id uuid references public.party_quest_rounds(id) on delete set null,
  session_id uuid references public.party_quest_sessions(id) on delete set null,
  quest_completion_id uuid unique references public.quest_completions(id) on delete cascade,
  base_xp integer not null check (base_xp >= 0),
  bonus_xp integer not null default 0 check (bonus_xp >= 0),
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  reflection text,
  photo_paths text[] not null default '{}',
  unique nulls not distinct (party_id, quest_id, user_id, round_id),
  unique nulls not distinct (party_id, quest_id, user_id, session_id)
);
create index if not exists party_completions_party_idx on public.party_completions(party_id, completed_at desc);
create index if not exists party_completions_round_idx on public.party_completions(round_id, completed_at);
alter table public.party_completions enable row level security;
create policy "Party participants read completions" on public.party_completions for select to authenticated using (public.is_party_participant(party_id, (select auth.uid())));

create table if not exists public.party_feed_posts (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references public.parties(id) on delete cascade,
  completion_id uuid references public.party_completions(id) on delete set null,
  quest_id uuid not null references public.quests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  caption text,
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists party_feed_party_idx on public.party_feed_posts(party_id, created_at desc);
alter table public.party_feed_posts enable row level security;
create policy "Party participants read feed" on public.party_feed_posts for select to authenticated using (public.is_party_participant(party_id, (select auth.uid())));

create table if not exists public.party_feed_reactions (
  post_id uuid not null references public.party_feed_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
alter table public.party_feed_reactions enable row level security;
create policy "Party participants read feed reactions" on public.party_feed_reactions for select to authenticated using (exists (select 1 from public.party_feed_posts p where p.id = post_id and public.is_party_participant(p.party_id, (select auth.uid()))));

-- Private bucket: object paths are stored in Party rows, signed URLs are returned by the client.
insert into storage.buckets (id, name, public) values ('party-media', 'party-media', false) on conflict (id) do update set public = false;
create policy "Party members read party media" on storage.objects for select to authenticated using (
  bucket_id = 'party-media' and public.is_party_participant((storage.foldername(name))[1]::uuid, (select auth.uid()))
);
create policy "Party members upload party media" on storage.objects for insert to authenticated with check (
  bucket_id = 'party-media' and public.is_party_member((storage.foldername(name))[1]::uuid, (select auth.uid()))
);
create policy "Party members update their party media" on storage.objects for update to authenticated using (
  bucket_id = 'party-media' and public.is_party_member((storage.foldername(name))[1]::uuid, (select auth.uid()))
) with check (bucket_id = 'party-media' and public.is_party_member((storage.foldername(name))[1]::uuid, (select auth.uid())));

create or replace function public.party_member_count(p_party_id uuid)
returns integer language sql security definer set search_path = '' stable as $$
  select count(*)::integer from public.party_members where party_id = p_party_id and status = 'active';
$$;

create or replace function public.create_party_v2(
  p_name text, p_goal text, p_photo_path text, p_max_members smallint, p_member_invites_enabled boolean, p_photo_proof_required boolean,
  p_game_mode text, p_location_type text, p_location_label text, p_rules text[], p_quest_ids uuid[]
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); party_id uuid; party_code text; next_rule text; i integer := 0;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 50 then raise exception 'Party name must be 2–50 characters.'; end if;
  if p_game_mode not in ('everyone_together', 'free_for_all') then raise exception 'Invalid party mode.'; end if;
  if p_location_type not in ('online', 'nearby', 'specific_place', 'flexible') then raise exception 'Invalid location type.'; end if;
  if p_max_members is not null and p_max_members not between 2 and 20 then raise exception 'Party limit must be 2–20 or unlimited.'; end if;
  if coalesce(array_length(p_quest_ids, 1), 0) = 0 then raise exception 'Choose at least one quest.'; end if;
  loop
    party_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.parties where code = party_code);
  end loop;
  insert into public.parties (name, code, goal, photo_path, max_members, member_invites_enabled, photo_proof_required, game_mode, location_type, location_label, created_by)
  values (trim(p_name), party_code, nullif(trim(coalesce(p_goal, '')), ''), nullif(trim(coalesce(p_photo_path, '')), ''), p_max_members, coalesce(p_member_invites_enabled, false), coalesce(p_photo_proof_required, false), p_game_mode, p_location_type, nullif(trim(coalesce(p_location_label, '')), ''), current_user_id)
  returning id into party_id;
  insert into public.party_members (party_id, user_id, role) values (party_id, current_user_id, 'leader');
  insert into public.party_quests (party_id, quest_id, position, added_by)
  select party_id, quest_id, ordinality - 1, current_user_id from unnest(p_quest_ids) with ordinality as list(quest_id, ordinality);
  foreach next_rule in array coalesce(p_rules, '{}') loop
    if char_length(trim(next_rule)) > 0 then insert into public.party_rules (party_id, body, position) values (party_id, trim(next_rule), i); i := i + 1; end if;
  end loop;
  return jsonb_build_object('id', party_id, 'code', party_code);
end; $$;
grant execute on function public.create_party_v2(text, text, text, smallint, boolean, boolean, text, text, text, text[], uuid[]) to authenticated;

create or replace function public.join_party_by_code(p_code text) returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); party_row public.parties%rowtype;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  select * into party_row from public.parties where code = upper(trim(p_code)) and status = 'active';
  if party_row.id is null then raise exception 'Party not found or has ended.'; end if;
  if public.is_party_member(party_row.id, current_user_id) then return party_row.id; end if;
  if party_row.max_members is not null and public.party_member_count(party_row.id) >= party_row.max_members then raise exception 'This party is full.'; end if;
  insert into public.party_members (party_id, user_id, role, status, left_at) values (party_row.id, current_user_id, 'member', 'active', null)
  on conflict (party_id, user_id) do update set status = 'active', left_at = null;
  return party_row.id;
end; $$;
grant execute on function public.join_party_by_code(text) to authenticated;

create or replace function public.update_party_v2(p_party_id uuid, p_name text, p_goal text, p_photo_path text, p_max_members smallint, p_member_invites_enabled boolean, p_photo_proof_required boolean, p_game_mode text, p_location_type text, p_location_label text, p_rules text[])
returns void language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); next_rule text; i integer := 0;
begin
  if not public.is_party_host(p_party_id, current_user_id) then raise exception 'Only the host can edit this party.'; end if;
  if p_max_members is not null and p_max_members < public.party_member_count(p_party_id) then raise exception 'Member limit cannot be below current members.'; end if;
  update public.parties set name = trim(p_name), goal = nullif(trim(coalesce(p_goal, '')), ''), photo_path = nullif(trim(coalesce(p_photo_path, '')), ''), max_members = p_max_members, member_invites_enabled = coalesce(p_member_invites_enabled, false), photo_proof_required = coalesce(p_photo_proof_required, false), game_mode = p_game_mode, location_type = p_location_type, location_label = nullif(trim(coalesce(p_location_label, '')), '') where id = p_party_id;
  delete from public.party_rules where party_id = p_party_id;
  foreach next_rule in array coalesce(p_rules, '{}') loop
    if char_length(trim(next_rule)) > 0 then insert into public.party_rules (party_id, body, position) values (p_party_id, trim(next_rule), i); i := i + 1; end if;
  end loop;
end; $$;
grant execute on function public.update_party_v2(uuid, text, text, text, smallint, boolean, boolean, text, text, text, text[]) to authenticated;

create or replace function public.end_party_v2(p_party_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_party_host(p_party_id, auth.uid()) then raise exception 'Only the host can end this party.'; end if;
  perform public.end_party_round(p_party_id, null);
  update public.parties set status = 'ended', ended_at = now() where id = p_party_id and status = 'active';
end; $$;

create or replace function public.leave_party(p_party_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.is_party_host(p_party_id, auth.uid()) then raise exception 'Hosts must end the party before leaving.'; end if;
  update public.party_members set status = 'left', left_at = now() where party_id = p_party_id and user_id = auth.uid() and status = 'active';
end; $$;

create or replace function public.invite_to_party(p_party_id uuid, p_recipient uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); invite_id uuid; party_row public.parties%rowtype;
begin
  select * into party_row from public.parties where id = p_party_id and status = 'active';
  if party_row.id is null then raise exception 'This party has ended.'; end if;
  if not public.is_party_member(p_party_id, current_user_id) or (not public.is_party_host(p_party_id, current_user_id) and not party_row.member_invites_enabled) then raise exception 'Only the host can invite people to this party.'; end if;
  if not public.are_friends(current_user_id, p_recipient) then raise exception 'You can only invite QuestLife friends.'; end if;
  if party_row.max_members is not null and public.party_member_count(p_party_id) >= party_row.max_members then raise exception 'This party is full.'; end if;
  insert into public.party_invites (party_id, sender_id, recipient_id, status) values (p_party_id, current_user_id, p_recipient, 'pending')
  on conflict do nothing returning id into invite_id;
  if invite_id is null then raise exception 'They already have a pending invite.'; end if;
  return invite_id;
end; $$;

create or replace function public.respond_party_invite(p_invite_id uuid, p_accept boolean) returns void language plpgsql security definer set search_path = '' as $$
declare invite public.party_invites%rowtype;
begin
  select * into invite from public.party_invites where id = p_invite_id and recipient_id = auth.uid() and status = 'pending';
  if invite.id is null then raise exception 'This invite is no longer available.'; end if;
  if p_accept then perform public.join_party_by_code((select code from public.parties where id = invite.party_id)); end if;
  update public.party_invites set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = invite.id;
end; $$;

create or replace function public.add_party_quests(p_party_id uuid, p_quest_ids uuid[]) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_party_host(p_party_id, auth.uid()) then raise exception 'Only the host can add quests.'; end if;
  insert into public.party_quests (party_id, quest_id, position, added_by)
  select p_party_id, quest_id, coalesce((select max(position) + 1 from public.party_quests where party_id = p_party_id), 0) + ordinality - 1, auth.uid()
  from unnest(p_quest_ids) with ordinality as x(quest_id, ordinality)
  on conflict (party_id, quest_id) do nothing;
end; $$;

create or replace function public.suggest_party_quests(p_party_id uuid, p_quest_ids uuid[]) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_party_member(p_party_id, auth.uid()) then raise exception 'Only party members can suggest quests.'; end if;
  insert into public.party_quest_suggestions (party_id, quest_id, user_id)
  select p_party_id, quest_id, auth.uid() from unnest(p_quest_ids) as x(quest_id)
  where not exists (select 1 from public.party_quests pq where pq.party_id = p_party_id and pq.quest_id = x.quest_id)
  on conflict do nothing;
end; $$;

create or replace function public.start_party_quest(p_party_id uuid, p_quest_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare party_row public.parties%rowtype; round_id uuid; session_id uuid; started timestamptz;
begin
  select * into party_row from public.parties where id = p_party_id;
  if party_row.status <> 'active' or not public.is_party_member(p_party_id, auth.uid()) then raise exception 'This party is not active.'; end if;
  if public.party_member_count(p_party_id) < 2 then raise exception 'A party needs two active members to start a quest.'; end if;
  if not exists (select 1 from public.party_quests where party_id = p_party_id and quest_id = p_quest_id and status = 'available') then raise exception 'This quest is not in the party.'; end if;
  if party_row.photo_proof_required and coalesce(array_length(p_photo_paths, 1), 0) = 0 then raise exception 'A photo is required for this Party quest.'; end if;
  if party_row.game_mode = 'everyone_together' then
    if not public.is_party_host(p_party_id, auth.uid()) then raise exception 'Only the host starts shared quests.'; end if;
    if exists (select 1 from public.party_quest_rounds where party_id = p_party_id and status = 'active') then raise exception 'End the current shared quest first.'; end if;
    insert into public.party_quest_rounds (party_id, quest_id, started_by) values (p_party_id, p_quest_id, auth.uid()) returning id, started_at into round_id, started;
    return jsonb_build_object('roundId', round_id, 'startedAt', started);
  end if;
  insert into public.party_quest_sessions (party_id, quest_id, user_id) values (p_party_id, p_quest_id, auth.uid()) returning id, started_at into session_id, started;
  return jsonb_build_object('sessionId', session_id, 'startedAt', started);
end; $$;

create or replace function public.complete_party_quest(p_party_id uuid, p_quest_id uuid, p_today date default current_date, p_reflection text default null, p_photo_paths text[] default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); party_row public.parties%rowtype; quest_row public.quests%rowtype; active_round public.party_quest_rounds%rowtype; active_session public.party_quest_sessions%rowtype; started timestamptz; base integer; completion_id uuid; new_party_completion_id uuid; daily_used integer; fastest jsonb;
begin
  select * into party_row from public.parties where id = p_party_id;
  if party_row.status <> 'active' or not public.is_party_member(p_party_id, current_user_id) then raise exception 'This party is not active.'; end if;
  select * into quest_row from public.quests where id = p_quest_id and status = 'published';
  if quest_row.id is null then raise exception 'QUEST_NOT_AVAILABLE'; end if;
  select count(*) into daily_used from public.quest_completions where user_id = current_user_id and completed_on = p_today;
  if daily_used >= 5 then raise exception 'DAILY_LIMIT_REACHED'; end if;
  if party_row.game_mode = 'everyone_together' then
    select * into active_round from public.party_quest_rounds where party_id = p_party_id and quest_id = p_quest_id and status = 'active';
    if active_round.id is null then raise exception 'This shared quest has not started.'; end if;
    if exists (select 1 from public.party_completions where party_id = p_party_id and quest_id = p_quest_id and user_id = current_user_id and round_id = active_round.id) then raise exception 'You already completed this shared quest.'; end if;
    started := active_round.started_at;
  else
    select * into active_session from public.party_quest_sessions where party_id = p_party_id and quest_id = p_quest_id and user_id = current_user_id and status = 'active';
    if active_session.id is null then raise exception 'Start this party quest before completing it.'; end if;
    started := active_session.started_at;
  end if;
  base := quest_row.experience_points;
  insert into public.quest_completions (user_id, quest_id, completed_on, reflection, xp_awarded, logged, review_public, photo_urls, party_id)
  values (current_user_id, p_quest_id, p_today, nullif(trim(coalesce(p_reflection, '')), ''), base, true, false, '{}', p_party_id)
  returning id into completion_id;
  insert into public.party_completions (party_id, quest_id, user_id, round_id, session_id, quest_completion_id, base_xp, started_at, reflection, photo_paths)
  values (p_party_id, p_quest_id, current_user_id, active_round.id, active_session.id, completion_id, base, started, nullif(trim(coalesce(p_reflection, '')), ''), coalesce(p_photo_paths, '{}'))
  returning id into new_party_completion_id;
  update public.quest_completions set party_completion_id = new_party_completion_id where id = completion_id;
  insert into public.party_feed_posts (party_id, completion_id, quest_id, user_id, caption, photo_paths) values (p_party_id, new_party_completion_id, p_quest_id, current_user_id, nullif(trim(coalesce(p_reflection, '')), ''), coalesce(p_photo_paths, '{}'));
  if party_row.game_mode = 'free_for_all' then update public.party_quest_sessions set status = 'completed', completed_at = now() where id = active_session.id; end if;
  select jsonb_build_object('name', coalesce(pr.display_name, 'Adventurer'), 'emoji', pr.emoji, 'elapsedSeconds', extract(epoch from pc.completed_at - pc.started_at)::integer)
  into fastest from public.party_completions pc join public.profiles pr on pr.id = pc.user_id where pc.party_id = p_party_id and pc.quest_id = p_quest_id order by pc.completed_at - pc.started_at, pc.completed_at limit 1;
  return jsonb_build_object('completionId', new_party_completion_id, 'xpAwarded', base, 'dailyUsed', daily_used + 1, 'dailyLimit', 5, 'fastest', fastest);
end; $$;

create or replace function public.end_party_round(p_party_id uuid, p_quest_id uuid default null) returns void language plpgsql security definer set search_path = '' as $$
declare round_row public.party_quest_rounds%rowtype; bonus integer; ranked record;
begin
  if not public.is_party_host(p_party_id, auth.uid()) then raise exception 'Only the host can end a shared quest.'; end if;
  select * into round_row from public.party_quest_rounds where party_id = p_party_id and status = 'active' and (p_quest_id is null or quest_id = p_quest_id) order by started_at desc limit 1;
  if round_row.id is null then return; end if;
  for ranked in select pc.id, pc.quest_completion_id, pc.base_xp, row_number() over (order by pc.completed_at, pc.id) as rank from public.party_completions pc where pc.round_id = round_row.id loop
    bonus := case ranked.rank when 1 then ceil(ranked.base_xp * .5)::integer when 2 then ceil(ranked.base_xp * .25)::integer when 3 then ceil(ranked.base_xp * .1)::integer else 0 end;
    if bonus > 0 then
      update public.party_completions set bonus_xp = bonus where id = ranked.id and bonus_xp = 0;
      update public.quest_completions set xp_awarded = xp_awarded + bonus where id = ranked.quest_completion_id;
      update public.profiles set total_xp = total_xp + bonus where id = (select user_id from public.party_completions where id = ranked.id);
    end if;
  end loop;
  update public.party_quest_rounds set status = 'ended', ended_at = now() where id = round_row.id;
end; $$;
grant execute on function public.start_party_quest(uuid, uuid), public.complete_party_quest(uuid, uuid, date, text, text[]), public.end_party_round(uuid, uuid), public.end_party_v2(uuid) to authenticated;

-- This replacement follows end_party_round so function resolution is explicit.
create or replace function public.end_party_v2(p_party_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_party_host(p_party_id, auth.uid()) then raise exception 'Only the host can end this party.'; end if;
  perform public.end_party_round(p_party_id, null);
  update public.parties set status = 'ended', ended_at = now() where id = p_party_id and status = 'active';
end; $$;

create or replace function public.react_to_party_post(p_post_id uuid, p_emoji text) returns void language plpgsql security definer set search_path = '' as $$
declare party_id uuid;
begin
  select p.party_id into party_id from public.party_feed_posts p where p.id = p_post_id;
  if not public.is_party_member(party_id, auth.uid()) then raise exception 'Only party members can react.'; end if;
  insert into public.party_feed_reactions (post_id, user_id, emoji) values (p_post_id, auth.uid(), p_emoji) on conflict do nothing;
end; $$;
grant execute on function public.react_to_party_post(uuid, text) to authenticated;

create or replace function public.get_party_hub() returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  return jsonb_build_object(
    'templates', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'subtitle', t.subtitle, 'description', t.description, 'icon', t.icon, 'accentColor', t.accent_color, 'questIds', (select coalesce(jsonb_agg(ptq.quest_id order by ptq.position), '[]'::jsonb) from public.party_template_quests ptq where ptq.template_id = t.id)) order by t.created_at) from public.party_templates t where t.active), '[]'::jsonb),
    'active', coalesce((select jsonb_agg(public.party_summary(p.id, current_user_id) order by p.created_at desc) from public.parties p join public.party_members pm on pm.party_id = p.id where pm.user_id = current_user_id and pm.status = 'active' and p.status = 'active'), '[]'::jsonb),
    'past', coalesce((select jsonb_agg(public.party_summary(p.id, current_user_id) order by coalesce(p.ended_at, pm.left_at, p.created_at) desc) from public.parties p join public.party_members pm on pm.party_id = p.id where pm.user_id = current_user_id and (pm.status = 'left' or p.status = 'ended')), '[]'::jsonb)
  );
end; $$;

create or replace function public.party_summary(p_party_id uuid, p_viewer uuid) returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'code', p.code, 'goal', p.goal, 'photoPath', p.photo_path, 'gameMode', p.game_mode, 'status', p.status, 'memberCount', public.party_member_count(p.id), 'maxMembers', p.max_members, 'endedAt', p.ended_at,
    'viewerLeftEarly', exists (select 1 from public.party_members pm where pm.party_id = p.id and pm.user_id = p_viewer and pm.status = 'left' and p.status = 'ended'),
    'myRank', coalesce((select ranked.rank from (select pc.user_id, dense_rank() over (order by sum(pc.base_xp + pc.bonus_xp) desc) as rank from public.party_completions pc where pc.party_id = p.id group by pc.user_id) ranked where ranked.user_id = p_viewer), null),
    'members', coalesce((select jsonb_agg(jsonb_build_object('userId', prof.id, 'displayName', coalesce(prof.display_name, 'Adventurer'), 'emoji', prof.emoji, 'avatarColor', prof.avatar_color, 'role', pm.role, 'status', pm.status) order by pm.role desc, pm.joined_at) from public.party_members pm join public.profiles prof on prof.id = pm.user_id where pm.party_id = p.id), '[]'::jsonb)
  ) from public.parties p where p.id = p_party_id;
$$;

-- Recreate after party_summary is defined so the hub resolves on every Postgres version.
create or replace function public.get_party_hub() returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  return jsonb_build_object(
    'templates', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'subtitle', t.subtitle, 'description', t.description, 'icon', t.icon, 'accentColor', t.accent_color, 'questIds', (select coalesce(jsonb_agg(ptq.quest_id order by ptq.position), '[]'::jsonb) from public.party_template_quests ptq where ptq.template_id = t.id)) order by t.created_at) from public.party_templates t where t.active), '[]'::jsonb),
    'active', coalesce((select jsonb_agg(public.party_summary(p.id, current_user_id) order by p.created_at desc) from public.parties p join public.party_members pm on pm.party_id = p.id where pm.user_id = current_user_id and pm.status = 'active' and p.status = 'active'), '[]'::jsonb),
    'past', coalesce((select jsonb_agg(public.party_summary(p.id, current_user_id) order by coalesce(p.ended_at, pm.left_at, p.created_at) desc) from public.parties p join public.party_members pm on pm.party_id = p.id where pm.user_id = current_user_id and (pm.status = 'left' or p.status = 'ended')), '[]'::jsonb)
  );
end; $$;

create or replace function public.get_party_detail(p_party_id uuid) returns jsonb language plpgsql security definer set search_path = '' stable as $$
declare current_user_id uuid := auth.uid();
begin
  if not public.is_party_participant(p_party_id, current_user_id) then raise exception 'You are not part of this party.'; end if;
  return (select public.party_summary(p.id, current_user_id) || jsonb_build_object(
    'isHost', public.is_party_host(p.id, current_user_id), 'memberInvitesEnabled', p.member_invites_enabled, 'photoProofRequired', p.photo_proof_required, 'locationType', p.location_type, 'locationLabel', p.location_label,
    'rules', coalesce((select jsonb_agg(body order by position) from public.party_rules where party_id = p.id), '[]'::jsonb),
    'quests', coalesce((select jsonb_agg(jsonb_build_object('questId', q.id, 'title', q.title, 'description', q.description, 'xp', q.experience_points, 'color', q.accent_color, 'position', pq.position, 'suggestionCount', (select count(*) from public.party_quest_suggestions s where s.party_id = p.id and s.quest_id = q.id), 'myCompletion', exists(select 1 from public.party_completions pc where pc.party_id = p.id and pc.quest_id = q.id and pc.user_id = current_user_id), 'fastest', (select jsonb_build_object('name', coalesce(prof.display_name, 'Adventurer'), 'elapsedSeconds', extract(epoch from pc.completed_at - pc.started_at)::integer) from public.party_completions pc join public.profiles prof on prof.id = pc.user_id where pc.party_id = p.id and pc.quest_id = q.id order by pc.completed_at - pc.started_at, pc.completed_at limit 1)) order by pq.position) from public.party_quests pq join public.quests q on q.id = pq.quest_id where pq.party_id = p.id and pq.status = 'available'), '[]'::jsonb),
    'activeRound', (select jsonb_build_object('id', r.id, 'questId', r.quest_id, 'startedAt', r.started_at, 'status', r.status) from public.party_quest_rounds r where r.party_id = p.id and r.status = 'active' order by r.started_at desc limit 1),
    'leaderboard', coalesce((select jsonb_agg(jsonb_build_object('userId', prof.id, 'displayName', coalesce(prof.display_name, 'Adventurer'), 'emoji', prof.emoji, 'avatarColor', prof.avatar_color, 'xp', scores.xp, 'rank', scores.rank) order by scores.rank) from (select pc.user_id, sum(pc.base_xp + pc.bonus_xp)::integer as xp, dense_rank() over (order by sum(pc.base_xp + pc.bonus_xp) desc) as rank from public.party_completions pc where pc.party_id = p.id group by pc.user_id) scores join public.profiles prof on prof.id = scores.user_id), '[]'::jsonb),
    'feed', coalesce((select jsonb_agg(jsonb_build_object('id', fp.id, 'questId', fp.quest_id, 'questTitle', q.title, 'userName', coalesce(prof.display_name, 'Adventurer'), 'userEmoji', prof.emoji, 'caption', fp.caption, 'photoPaths', fp.photo_paths, 'createdAt', fp.created_at, 'reactions', coalesce((select jsonb_agg(jsonb_build_object('emoji', r.emoji, 'count', r.count, 'reacted', r.reacted)) from (select emoji, count(*)::integer as count, bool_or(user_id = current_user_id) as reacted from public.party_feed_reactions where post_id = fp.id group by emoji) r), '[]'::jsonb)) order by fp.created_at desc) from public.party_feed_posts fp join public.quests q on q.id = fp.quest_id join public.profiles prof on prof.id = fp.user_id where fp.party_id = p.id), '[]'::jsonb)
  ) from public.parties p where p.id = p_party_id);
end; $$;
grant execute on function public.get_party_hub(), public.get_party_detail(uuid) to authenticated;

create or replace function public.get_party_journal_history() returns jsonb language sql security definer set search_path = '' stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'partyId', p.id, 'name', p.name, 'status', p.status, 'endedAt', p.ended_at,
    'leftEarly', pm.status = 'left' and p.status = 'ended',
    'members', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(prof.display_name, 'Adventurer'), 'emoji', prof.emoji, 'color', prof.avatar_color) order by member.joined_at) from public.party_members member join public.profiles prof on prof.id = member.user_id where member.party_id = p.id), '[]'::jsonb),
    'rankings', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(prof.display_name, 'Adventurer'), 'emoji', prof.emoji, 'xp', score.xp, 'rank', score.rank) order by score.rank) from (select pc.user_id, sum(pc.base_xp + pc.bonus_xp)::integer as xp, dense_rank() over (order by sum(pc.base_xp + pc.bonus_xp) desc) as rank from public.party_completions pc where pc.party_id = p.id group by pc.user_id) score join public.profiles prof on prof.id = score.user_id), '[]'::jsonb)
  ) order by coalesce(p.ended_at, p.created_at) desc), '[]'::jsonb)
  from public.parties p join public.party_members pm on pm.party_id = p.id
  where pm.user_id = auth.uid() and (p.status = 'ended' or pm.status = 'left');
$$;
grant execute on function public.get_party_journal_history() to authenticated;
