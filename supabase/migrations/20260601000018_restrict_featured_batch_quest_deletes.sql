-- Featured batch updates replace their child rows. Keep creation available to
-- featured editors, but require the delete permission before existing rows can
-- be removed through the Data API.

drop policy if exists "Admins can manage upcoming featured batch quests" on public.featured_batch_quests;
drop policy if exists "Admins can add upcoming featured batch quests" on public.featured_batch_quests;
drop policy if exists "Admins can update upcoming featured batch quests" on public.featured_batch_quests;
drop policy if exists "Admins with delete content permission can delete upcoming featured batch quests" on public.featured_batch_quests;

create policy "Admins can add upcoming featured batch quests"
on public.featured_batch_quests
for insert
to authenticated
with check (
  exists (
    select 1 from public.featured_quest_batches
    where featured_quest_batches.id = featured_batch_quests.batch_id
      and featured_quest_batches.featured_on >= current_date
  )
  and public.admin_has_permission('quests.view_published')
);

create policy "Admins can update upcoming featured batch quests"
on public.featured_batch_quests
for update
to authenticated
using (
  exists (
    select 1 from public.featured_quest_batches
    where featured_quest_batches.id = featured_batch_quests.batch_id
      and featured_quest_batches.featured_on >= current_date
  )
  and public.admin_has_permission('quests.view_published')
)
with check (
  exists (
    select 1 from public.featured_quest_batches
    where featured_quest_batches.id = featured_batch_quests.batch_id
      and featured_quest_batches.featured_on >= current_date
  )
  and public.admin_has_permission('quests.view_published')
);

create policy "Admins with delete content permission can delete upcoming featured batch quests"
on public.featured_batch_quests
for delete
to authenticated
using (
  exists (
    select 1 from public.featured_quest_batches
    where featured_quest_batches.id = featured_batch_quests.batch_id
      and featured_quest_batches.featured_on >= current_date
  )
  and public.admin_has_permission('content.delete')
);
