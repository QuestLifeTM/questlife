-- Optional user-owned cover image for saved quest collections.
alter table public.user_adventure_packs
add column if not exists cover_image_url text;

insert into storage.buckets (id, name, public)
values ('collection-covers', 'collection-covers', true)
on conflict (id) do nothing;

drop policy if exists "Users can upload collection covers" on storage.objects;
create policy "Users can upload collection covers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'collection-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update collection covers" on storage.objects;
create policy "Users can update collection covers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'collection-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'collection-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete collection covers" on storage.objects;
create policy "Users can delete collection covers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'collection-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
