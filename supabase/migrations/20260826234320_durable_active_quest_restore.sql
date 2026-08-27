-- Activity notes and photo captions are part of an in-progress quest, not
-- merely device-local decoration. Persist them so an active quest survives a
-- logout, app reinstall, or a different device.
create table if not exists public.quest_session_activity (
  session_id uuid not null references public.quest_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_activity_id text not null,
  kind text not null check (kind in ('note', 'photo', 'badge')),
  created_at timestamptz not null,
  body text,
  caption text,
  badge_label text,
  client_photo_id text,
  primary key (session_id, client_activity_id)
);

create index if not exists quest_session_activity_session_created_idx
  on public.quest_session_activity (session_id, created_at);

alter table public.quest_session_activity enable row level security;

create policy "Users manage their active quest activity"
on public.quest_session_activity
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
