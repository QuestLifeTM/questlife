-- The Admin client reads its own membership immediately after authentication.
-- RLS limits this table to admins, but an explicit table grant is also
-- required before the policy can be evaluated.
revoke all on table public.admin_memberships from anon, authenticated;
grant select on table public.admin_memberships to authenticated;
