-- Compact route geometry keeps live-map/replay reads light, while the raw
-- samples retain the additional GPS metadata needed for accurate replay.
alter table public.quest_session_snapshots
  add column if not exists render_route jsonb not null default '[]'::jsonb;

alter table public.quest_session_route_points
  add column if not exists altitude_meters double precision,
  add column if not exists heading_degrees double precision;
