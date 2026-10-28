-- Restore the local-first recorder's Data API access after privilege hardening.
-- Owner-only RLS remains enabled; no user records are modified.
alter table public.quest_session_route_points enable row level security;
alter table public.quest_session_snapshots enable row level security;
alter table public.quest_session_media enable row level security;
alter table public.quest_session_activity enable row level security;

grant select, insert, update on table
  public.quest_session_route_points,
  public.quest_session_snapshots,
  public.quest_session_media,
  public.quest_session_activity
to authenticated;

-- Some environments missed the separate completion-rating migration.
-- End Quest saves the memory immediately. Rating is required before the
-- completion screen may be dismissed, so it is recorded as a separate,
-- owner-only mutation once the user chooses Done or Share.
create or replace function public.rate_quest_completion(
  p_completion_id uuid,
  p_rating smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'RATING_INVALID';
  end if;

  update public.quest_completions
  set rating = p_rating,
      logged = true
  where id = p_completion_id
    and user_id = auth.uid();

  if not found then
    raise exception 'COMPLETION_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.rate_quest_completion(uuid, smallint) from public, anon;
grant execute on function public.rate_quest_completion(uuid, smallint) to authenticated;
