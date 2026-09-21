-- Journal photo/reflection edits are user-facing, but quest_completions must
-- not be generally writable: it also contains XP, ownership, and completion
-- state. Keep the table read-only to the Data API and expose only the two
-- owner-scoped edits the Journal supports.

-- The remote project was missing the Journal access restoration migration.
-- Restore the minimal table privileges needed for its read and entry-edit
-- paths; RLS remains the authorization boundary for every table below.
revoke all on table public.journal_entries from anon, authenticated;
grant select, insert, update on table public.journal_entries to authenticated;

revoke all on table public.quest_completions from anon, authenticated;
grant select on table public.quest_completions to authenticated;

revoke all on table public.quest_sessions from anon, authenticated;
grant select on table public.quest_sessions to authenticated;

create or replace function public.update_journal_memory_reflection(
  p_completion_id uuid,
  p_reflection text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.quest_completions
  set reflection = nullif(trim(coalesce(p_reflection, '')), '')
  where id = p_completion_id
    and user_id = current_user_id;

  if not found then
    raise exception 'JOURNAL_MEMORY_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.replace_journal_memory_photos(
  p_completion_id uuid,
  p_photo_paths text[]
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_paths text[] := coalesce(p_photo_paths, '{}');
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(array_length(normalized_paths, 1), 0) > 5 then
    raise exception 'You can add up to five Journal photos.';
  end if;

  -- New private objects always live under the authenticated user's folder.
  -- Public HTTPS URLs are retained only for legacy quest-photo records.
  if exists (
    select 1
    from unnest(normalized_paths) as path
    where path is null
      or btrim(path) = ''
      or (path !~ '^https?://' and path not like current_user_id::text || '/%')
  ) then
    raise exception 'Invalid Journal photo path.';
  end if;

  update public.quest_completions
  set photo_urls = normalized_paths
  where id = p_completion_id
    and user_id = current_user_id;

  if not found then
    raise exception 'JOURNAL_MEMORY_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.update_journal_memory_reflection(uuid, text) from public;
revoke all on function public.replace_journal_memory_photos(uuid, text[]) from public;
grant execute on function public.update_journal_memory_reflection(uuid, text) to authenticated;
grant execute on function public.replace_journal_memory_photos(uuid, text[]) to authenticated;

-- Reassert the private-media bucket policies. This makes the Journal repair
-- safe for installations that received the UI before the original bucket
-- migration, which otherwise fail while creating signed URLs and show an
-- empty Album.
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

drop policy if exists "Users delete their own journal media" on storage.objects;
create policy "Users delete their own journal media"
on storage.objects for delete to authenticated
using (bucket_id = 'journal-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
