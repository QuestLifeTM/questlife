# Active Quest route sync — manual Supabase SQL

This SQL is now tracked in the active-quest route metadata migration. It is retained here as a readable reference.

```sql
alter table public.quest_session_snapshots
  add column if not exists render_route jsonb not null default '[]'::jsonb;

alter table public.quest_session_route_points
  add column if not exists altitude_meters double precision,
  add column if not exists heading_degrees double precision;
```

This adds the complete route metadata synced by the iOS tracker: a compact route used for rendering, along with altitude and heading on every raw GPS sample.
