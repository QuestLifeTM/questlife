-- Durable mirrors for local-first Active Quest recording. The existing
-- quest_sessions table remains authoritative for whether a quest is active.
create table if not exists public.quest_session_snapshots (
  session_id uuid primary key references public.quest_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  recording_state text not null check (recording_state in ('recording', 'paused')),
  started_at timestamptz not null,
  paused_at timestamptz,
  active_duration_ms bigint not null default 0 check (active_duration_ms >= 0),
  distance_meters double precision not null default 0 check (distance_meters >= 0),
  entry_title text not null default '',
  entry_body text not null default '',
  last_location_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.quest_session_route_points (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quest_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_point_id text not null,
  captured_at timestamptz not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision,
  speed_meters_per_second double precision,
  created_at timestamptz not null default now(),
  unique (session_id, client_point_id)
);

create index if not exists quest_session_route_points_session_captured_idx
  on public.quest_session_route_points(session_id, captured_at);

create table if not exists public.quest_session_media (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quest_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_media_id text not null,
  captured_at timestamptz not null,
  storage_url text not null,
  created_at timestamptz not null default now(),
  unique (session_id, client_media_id)
);

alter table public.quest_session_snapshots enable row level security;
alter table public.quest_session_route_points enable row level security;
alter table public.quest_session_media enable row level security;

create policy "Users manage their active quest snapshots" on public.quest_session_snapshots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their active quest route" on public.quest_session_route_points
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage their active quest media" on public.quest_session_media
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
