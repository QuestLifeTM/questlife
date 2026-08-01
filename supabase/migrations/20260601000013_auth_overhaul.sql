-- Authentication overhaul: normalized admin permissions, audit logging,
-- username validation, and hardened admin account lifecycle helpers.

create schema if not exists private;
revoke all on schema private from anon, authenticated;

alter table public.profiles
add column if not exists username text,
add column if not exists display_name text,
add column if not exists avatar_url text;

create unique index if not exists profiles_username_idx
on public.profiles (lower(username))
where username is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_username_format_chk'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_username_format_chk
    check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$');
  end if;
end;
$$;

create or replace function public.is_username_available(raw_username text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    raw_username is not null
    and trim(raw_username) ~ '^[A-Za-z0-9_]{3,20}$'
    and not exists (
      select 1
      from public.profiles
      where lower(username) = lower(trim(raw_username))
    );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.get_public_account_registration_state(raw_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  normalized_email text := lower(trim(raw_email));
  user_record record;
begin
  if normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('status', 'invalid_email');
  end if;

  select id, email_confirmed_at, confirmed_at
  into user_record
  from auth.users
  where lower(email) = normalized_email
  limit 1;

  if user_record.id is null then
    return jsonb_build_object('status', 'available');
  end if;

  if coalesce(user_record.email_confirmed_at, user_record.confirmed_at) is null then
    return jsonb_build_object('status', 'unverified');
  end if;

  return jsonb_build_object('status', 'verified');
end;
$$;

revoke all on function public.get_public_account_registration_state(text) from public;
grant execute on function public.get_public_account_registration_state(text) to anon, authenticated;

create or replace function private.profile_username_from_user(user_id uuid, email text, metadata jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := trim(coalesce(metadata->>'username', ''));
  fallback text := lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
begin
  if requested ~ '^[A-Za-z0-9_]{3,20}$'
    and not exists (
      select 1
      from public.profiles
      where lower(username) = lower(requested)
        and id <> user_id
    )
  then
    return requested;
  end if;

  if length(fallback) < 3 then
    fallback := 'user';
  end if;

  return left(fallback, 15) || '_' || substr(user_id::text, 1, 4);
end;
$$;

create or replace function private.create_profile_after_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    insert into public.profiles (id, email, username)
    values (
      new.id,
      lower(new.email),
      private.profile_username_from_user(new.id, new.email, new.raw_user_meta_data)
    )
    on conflict (id) do update
    set
      email = excluded.email,
      username = coalesce(public.profiles.username, excluded.username),
      updated_at = now();
  end if;

  return new;
end;
$$;

alter table public.admin_memberships
add column if not exists is_active boolean not null default true,
add column if not exists disabled_at timestamptz,
add column if not exists deleted_at timestamptz,
add column if not exists last_login timestamptz,
add column if not exists updated_at timestamptz not null default now();

drop trigger if exists admin_memberships_set_updated_at on public.admin_memberships;
create trigger admin_memberships_set_updated_at
before update on public.admin_memberships
for each row
execute function public.set_updated_at();

create table if not exists public.admin_permissions (
  admin_id uuid not null references public.admin_memberships(user_id) on delete cascade,
  permission_name text not null check (permission_name ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  created_at timestamptz not null default now(),
  primary key (admin_id, permission_name)
);

insert into public.admin_permissions (admin_id, permission_name)
select membership.user_id, permission_name
from public.admin_memberships membership
cross join lateral unnest(coalesce(membership.permissions, array[]::text[])) permission_name
on conflict do nothing;

alter table public.admin_permissions enable row level security;

drop policy if exists "Admins can read normalized permissions" on public.admin_permissions;
create policy "Admins can read normalized permissions"
on public.admin_permissions
for select
to authenticated
using (public.is_admin());

drop policy if exists "Super admins can manage normalized permissions" on public.admin_permissions;
create policy "Super admins can manage normalized permissions"
on public.admin_permissions
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx
on public.admin_audit_logs(created_at desc);

create index if not exists admin_audit_logs_actor_idx
on public.admin_audit_logs(actor_id, created_at desc);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "Super admins can read audit logs" on public.admin_audit_logs;
create policy "Super admins can read audit logs"
on public.admin_audit_logs
for select
to authenticated
using (public.is_super_admin());

alter table public.admin_invites
add column if not exists expires_at timestamptz not null default (now() + interval '7 days'),
add column if not exists revoked_at timestamptz;

create or replace function private.write_admin_audit(
  action_name text,
  target_user uuid default null,
  target_email text default null,
  details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_audit_logs (actor_id, target_user_id, target_email, action, metadata)
  values ((select auth.uid()), target_user, lower(target_email), action_name, coalesce(details, '{}'::jsonb));
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.admin_memberships
    where user_id = (select auth.uid())
      and is_active = true
      and deleted_at is null
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.admin_memberships
    where user_id = (select auth.uid())
      and role = 'super_admin'
      and is_active = true
      and deleted_at is null
  );
$$;

create or replace function public.admin_has_permission(permission text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.admin_memberships membership
      join public.admin_permissions permission_row
        on permission_row.admin_id = membership.user_id
      where membership.user_id = (select auth.uid())
        and membership.is_active = true
        and membership.deleted_at is null
        and permission_row.permission_name = permission
    );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.admin_has_permission(text) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.admin_has_permission(text) to authenticated;

create or replace view public.admin_users
with (security_invoker = true)
as
select
  membership.user_id,
  membership.role,
  membership.is_active,
  membership.created_by as invited_by,
  membership.last_login,
  membership.created_at,
  membership.updated_at
from public.admin_memberships membership
where membership.deleted_at is null;

grant select on public.admin_users to authenticated;

create or replace function private.sync_admin_permission_array(target_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.admin_memberships membership
  set permissions = coalesce((
    select array_agg(permission_name order by permission_name)
    from public.admin_permissions
    where admin_id = target_user
  ), array[]::text[])
  where membership.user_id = target_user;
$$;

create or replace function public.list_admin_accounts()
returns table (
  user_id uuid,
  email text,
  display_name text,
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
  group by membership.user_id, profile.email, auth_user.email, profile.display_name, membership.role,
    membership.is_active, membership.last_login, membership.created_at
  order by membership.created_at;
$$;

revoke all on function public.list_admin_accounts() from public;
grant execute on function public.list_admin_accounts() to authenticated;

create or replace function public.record_admin_login()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  membership_record public.admin_memberships%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into membership_record
  from public.admin_memberships
  where user_id = current_user_id
    and deleted_at is null;

  if membership_record.user_id is null then
    raise exception 'ADMIN_ACCESS_REQUIRED';
  end if;

  if membership_record.is_active is not true then
    perform private.write_admin_audit('admin_login_blocked_disabled', current_user_id, null, '{}'::jsonb);
    raise exception 'ADMIN_ACCOUNT_DISABLED';
  end if;

  update public.admin_memberships
  set last_login = now()
  where user_id = current_user_id;

  perform private.write_admin_audit('admin_login', current_user_id, null, '{}'::jsonb);

  return jsonb_build_object('role', membership_record.role);
end;
$$;

revoke all on function public.record_admin_login() from public;
grant execute on function public.record_admin_login() to authenticated;

create or replace function public.record_admin_logout()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_admin_audit('admin_logout', (select auth.uid()), null, '{}'::jsonb);
end;
$$;

revoke all on function public.record_admin_logout() from public;
grant execute on function public.record_admin_logout() to authenticated;

drop policy if exists "Published quests are readable" on public.quests;
create policy "Published quests are readable"
on public.quests
for select
to authenticated
using (
  status = 'published'
  or public.admin_has_permission('quests.view_all')
);

drop policy if exists "Admins can create quests" on public.quests;
create policy "Admins can create quests"
on public.quests
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    public.admin_has_permission('quests.create_draft')
    and (
      status = 'draft'
      or (
        status = 'in_review'
        and public.admin_has_permission('quests.submit_review')
      )
    )
  )
);

drop policy if exists "Admins can update quests" on public.quests;
create policy "Admins can update quests"
on public.quests
for update
to authenticated
using (
  public.is_super_admin()
  or (
    public.admin_has_permission('quests.create_draft')
    and status in ('draft', 'in_review')
  )
)
with check (
  public.is_super_admin()
  or (
    public.admin_has_permission('quests.create_draft')
    and (
      status = 'draft'
      or (
        status = 'in_review'
        and public.admin_has_permission('quests.submit_review')
      )
    )
  )
);

drop policy if exists "Admins can delete draft quests" on public.quests;
create policy "Admins can delete draft quests"
on public.quests
for delete
to authenticated
using (
  status = 'draft'
  and (
    public.is_super_admin()
    or public.admin_has_permission('quests.create_draft')
  )
);

drop policy if exists "Super admins can delete quests" on public.quests;
create policy "Super admins can delete quests"
on public.quests
for delete
to authenticated
using (
  status = 'draft'
  and (
    public.is_super_admin()
    or public.admin_has_permission('quests.create_draft')
  )
);

drop policy if exists "Published adventure packs are readable" on public.adventure_packs;
create policy "Published adventure packs are readable"
on public.adventure_packs
for select
to authenticated
using (
  status = 'published'
  or public.admin_has_permission('quests.view_published')
);

drop policy if exists "Admins can create adventure packs" on public.adventure_packs;
create policy "Admins can create adventure packs"
on public.adventure_packs
for insert
to authenticated
with check (
  public.is_super_admin()
  or (
    public.admin_has_permission('quests.view_published')
    and status = 'draft'
  )
);

drop policy if exists "Admins can update adventure packs" on public.adventure_packs;
create policy "Admins can update adventure packs"
on public.adventure_packs
for update
to authenticated
using (
  public.is_super_admin()
  or (
    public.admin_has_permission('quests.view_published')
    and status = 'draft'
  )
)
with check (
  public.is_super_admin()
  or (
    public.admin_has_permission('quests.view_published')
    and status = 'draft'
  )
);

drop policy if exists "Super admins can delete adventure packs" on public.adventure_packs;
create policy "Super admins can delete adventure packs"
on public.adventure_packs
for delete
to authenticated
using (
  public.is_super_admin()
  or (
    public.admin_has_permission('quests.view_published')
    and status = 'draft'
  )
);

drop policy if exists "Published adventure pack quests are readable" on public.adventure_pack_quests;
create policy "Published adventure pack quests are readable"
on public.adventure_pack_quests
for select
to authenticated
using (
  public.admin_has_permission('quests.view_published')
  or exists (
    select 1
    from public.adventure_packs
    where adventure_packs.id = adventure_pack_quests.adventure_pack_id
      and adventure_packs.status = 'published'
  )
);

drop policy if exists "Admins can manage adventure pack quests" on public.adventure_pack_quests;
create policy "Admins can manage adventure pack quests"
on public.adventure_pack_quests
for all
to authenticated
using (
  public.is_super_admin()
  or public.admin_has_permission('quests.view_published')
)
with check (
  public.is_super_admin()
  or public.admin_has_permission('quests.view_published')
);

drop policy if exists "Admins can create upcoming featured batches" on public.featured_quest_batches;
create policy "Admins can create upcoming featured batches"
on public.featured_quest_batches
for insert
to authenticated
with check (
  featured_on >= current_date
  and (
    public.is_super_admin()
    or public.admin_has_permission('quests.view_published')
  )
);

drop policy if exists "Admins can update upcoming featured batches" on public.featured_quest_batches;
create policy "Admins can update upcoming featured batches"
on public.featured_quest_batches
for update
to authenticated
using (
  featured_on >= current_date
  and (
    public.is_super_admin()
    or public.admin_has_permission('quests.view_published')
  )
)
with check (
  featured_on >= current_date
  and (
    public.is_super_admin()
    or public.admin_has_permission('quests.view_published')
  )
);

drop policy if exists "Admins can delete upcoming featured batches" on public.featured_quest_batches;
create policy "Admins can delete upcoming featured batches"
on public.featured_quest_batches
for delete
to authenticated
using (
  featured_on >= current_date
  and (
    public.is_super_admin()
    or public.admin_has_permission('quests.view_published')
  )
);

drop policy if exists "Admins can manage upcoming featured batch quests" on public.featured_batch_quests;
create policy "Admins can manage upcoming featured batch quests"
on public.featured_batch_quests
for all
to authenticated
using (
  exists (
    select 1 from public.featured_quest_batches
    where featured_quest_batches.id = featured_batch_quests.batch_id
      and featured_quest_batches.featured_on >= current_date
  )
  and (
    public.is_super_admin()
    or public.admin_has_permission('quests.view_published')
  )
)
with check (
  exists (
    select 1 from public.featured_quest_batches
    where featured_quest_batches.id = featured_batch_quests.batch_id
      and featured_quest_batches.featured_on >= current_date
  )
  and (
    public.is_super_admin()
    or public.admin_has_permission('quests.view_published')
  )
);

drop policy if exists "Admins can upload pack covers" on storage.objects;
create policy "Admins can upload pack covers"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'pack-covers'
  and (
    public.is_super_admin()
    or public.admin_has_permission('quests.view_published')
  )
);

drop policy if exists "Admins can update pack covers" on storage.objects;
create policy "Admins can update pack covers"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'pack-covers'
  and (
    public.is_super_admin()
    or public.admin_has_permission('quests.view_published')
  )
)
with check (
  bucket_id = 'pack-covers'
  and (
    public.is_super_admin()
    or public.admin_has_permission('quests.view_published')
  )
);

drop policy if exists "Admins can delete pack covers" on storage.objects;
create policy "Admins can delete pack covers"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'pack-covers'
  and (
    public.is_super_admin()
    or public.admin_has_permission('quests.view_published')
  )
);

create or replace function public.get_admin_login_state(raw_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  normalized_email text := lower(trim(raw_email));
  invite_record public.admin_invites%rowtype;
  membership_record record;
begin
  select *
  into invite_record
  from public.admin_invites
  where lower(email) = normalized_email
    and status = 'pending'
  limit 1;

  select membership.user_id, membership.is_active
  into membership_record
  from public.admin_memberships membership
  join auth.users auth_user on auth_user.id = membership.user_id
  where lower(auth_user.email) = normalized_email
    and membership.deleted_at is null
  limit 1;

  if membership_record.user_id is not null then
    return jsonb_build_object(
      'allowed', membership_record.is_active,
      'email', normalized_email,
      'firstTime', false,
      'message', case when membership_record.is_active then 'Continue with your admin password.' else 'Continue with your admin password.' end
    );
  end if;

  if invite_record.id is not null and invite_record.expires_at <= now() then
    return jsonb_build_object(
      'allowed', false,
      'email', normalized_email,
      'firstTime', true,
      'message', 'Unable to continue with this admin email.'
    );
  end if;

  if invite_record.id is not null then
    return jsonb_build_object(
      'allowed', true,
      'email', normalized_email,
      'firstTime', true,
      'message', 'Admin invitation found. Create your password.'
    );
  end if;

  return jsonb_build_object(
    'allowed', false,
    'email', normalized_email,
    'firstTime', false,
    'message', 'Unable to continue with this admin email.'
  );
end;
$$;

revoke all on function public.get_admin_login_state(text) from public;
grant execute on function public.get_admin_login_state(text) to anon, authenticated;

create or replace function public.accept_admin_invite()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  invite_record public.admin_invites%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select lower(email)
  into current_email
  from auth.users
  where id = current_user_id;

  select *
  into invite_record
  from public.admin_invites
  where lower(email) = current_email
    and status = 'pending'
  limit 1;

  if invite_record.id is null then
    return;
  end if;

  if invite_record.expires_at <= now() then
    raise exception 'INVITATION_EXPIRED';
  end if;

  insert into public.admin_memberships (user_id, role, permissions, created_by, is_active)
  values (current_user_id, invite_record.role, invite_record.permissions, invite_record.invited_by, true)
  on conflict (user_id) do update
  set role = excluded.role,
      permissions = excluded.permissions,
      is_active = true,
      disabled_at = null,
      deleted_at = null;

  delete from public.admin_permissions where admin_id = current_user_id;

  insert into public.admin_permissions (admin_id, permission_name)
  select current_user_id, permission_name
  from unnest(invite_record.permissions) permission_name
  on conflict do nothing;

  update public.admin_invites
  set status = 'accepted',
      accepted_by = current_user_id,
      accepted_at = now()
  where id = invite_record.id;

  perform private.write_admin_audit('admin_invite_accepted', current_user_id, current_email, '{}'::jsonb);
end;
$$;

revoke all on function public.accept_admin_invite() from public;
grant execute on function public.accept_admin_invite() to authenticated;

-- Trigger helpers should not be callable through PostgREST/RPC.
revoke all on function private.create_profile_after_email_confirmation() from public;
revoke all on function private.profile_username_from_user(uuid, text, jsonb) from public;
revoke all on function private.write_admin_audit(text, uuid, text, jsonb) from public;
revoke all on function private.sync_admin_permission_array(uuid) from public;
