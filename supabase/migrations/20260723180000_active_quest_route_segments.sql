-- Preserve pause/resume boundaries for replay while retaining the immutable raw
-- GPS path. Segment state is presentation metadata; no route is map-matched.
alter table public.quest_session_snapshots
  add column if not exists route_segments jsonb not null default '[]'::jsonb;

alter table public.quest_session_route_points
  add column if not exists segment_id text,
  add column if not exists segment_state text check (segment_state in ('active', 'paused'));

create index if not exists quest_session_route_points_session_segment_idx
  on public.quest_session_route_points(session_id, segment_id, captured_at);
