drop policy if exists "Admins can delete their notifications" on public.admin_notifications;
create policy "Admins can delete their notifications"
on public.admin_notifications
for delete
to authenticated
using ((select auth.uid()) = user_id);
