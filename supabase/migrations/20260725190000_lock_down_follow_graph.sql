-- The follow graph is only available through authenticated RPCs. An explicit
-- deny policy documents that decision and prevents accidental direct API use.
drop policy if exists "No direct profile follow access" on public.profile_follows;
create policy "No direct profile follow access"
on public.profile_follows for all to authenticated
using (false)
with check (false);

revoke all on function public.are_friends(uuid, uuid) from public, anon;
revoke all on function public.get_profile_overview(uuid, date) from public, anon;
revoke all on function public.get_social_overview(date) from public, anon;

grant execute on function public.are_friends(uuid, uuid), public.get_profile_overview(uuid, date), public.get_social_overview(date) to authenticated;
