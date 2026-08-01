-- Destructive content actions are separately grantable to regular admins.
-- public.admin_has_permission() already grants every permission to active
-- super admins, so they retain access without an explicit permission row.

drop policy if exists "Super admins can delete adventure packs" on public.adventure_packs;
drop policy if exists "Admins with delete content permission can delete adventure packs" on public.adventure_packs;
create policy "Admins with delete content permission can delete adventure packs"
on public.adventure_packs
for delete
to authenticated
using (public.admin_has_permission('content.delete'));

drop policy if exists "Admins can delete upcoming featured batches" on public.featured_quest_batches;
drop policy if exists "Admins with delete content permission can delete upcoming featured batches" on public.featured_quest_batches;
create policy "Admins with delete content permission can delete upcoming featured batches"
on public.featured_quest_batches
for delete
to authenticated
using (
  featured_on >= current_date
  and public.admin_has_permission('content.delete')
);
