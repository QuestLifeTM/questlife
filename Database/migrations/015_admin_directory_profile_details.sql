-- Keep the admin directory behind the existing super-admin-only RPC while
-- including the public profile bio required by the management detail view.
-- PostgreSQL treats the returned table columns as part of a function's type,
-- so adding `bio` requires replacing the existing no-argument function.
drop function if exists public.list_admin_accounts();

create or replace function public.list_admin_accounts()
returns table (
  user_id uuid,
  email text,
  display_name text,
  bio text,
  role text,
  is_active boolean,
  last_login timestamptz,
  created_at timestamptz,
  permissions text[]
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    membership.user_id,
    coalesce(profile.email, auth_user.email) as email,
    profile.display_name,
    profile.bio,
    membership.role,
    membership.is_active,
    membership.last_login,
    membership.created_at,
    coalesce(array_agg(permission_row.permission_name order by permission_row.permission_name)
      filter (where permission_row.permission_name is not null), array[]::text[]) as permissions
  from public.admin_memberships membership
  left join public.profiles profile on profile.id = membership.user_id
  left join auth.users auth_user on auth_user.id = membership.user_id
  left join public.admin_permissions permission_row on permission_row.admin_id = membership.user_id
  where public.is_super_admin()
    and membership.deleted_at is null
  group by membership.user_id, profile.email, auth_user.email, profile.display_name, profile.bio, membership.role,
    membership.is_active, membership.last_login, membership.created_at
  order by membership.created_at;
$$;

revoke all on function public.list_admin_accounts() from public;
grant execute on function public.list_admin_accounts() to authenticated;
