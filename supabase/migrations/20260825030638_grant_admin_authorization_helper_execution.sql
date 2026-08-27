-- Admin-table RLS policies call these SECURITY DEFINER authorization helpers.
-- The RPC hardening migration revoked their execution grant, which prevented
-- Postgres from evaluating the policies for legitimate signed-in admins.
-- These functions are authorization predicates only; they do not expose data.
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.admin_has_permission(text) to authenticated;
