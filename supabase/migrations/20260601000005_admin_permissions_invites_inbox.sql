alter table public.admin_memberships
add column if not exists permissions text[] not null default array[
  'quests.view_published',
  'quests.view_all',
  'quests.create_draft',
  'quests.submit_review',
  'profile.manage',
  'inbox.view'
];

alter table public.admin_memberships
alter column permissions set default array[
  'quests.view_published',
  'quests.view_all',
  'quests.create_draft',
  'quests.submit_review',
  'profile.manage',
  'inbox.view'
];

update public.admin_memberships
set permissions = array[
  'quests.view_published',
  'quests.view_all',
  'quests.create_draft',
  'quests.submit_review',
  'profile.manage',
  'inbox.view'
]
where role = 'admin'
  and permissions @> array[
    'quests.view_published',
    'quests.view_all',
    'quests.create_draft',
    'quests.submit_review',
    'quests.review_publish',
    'admins.manage',
    'profile.manage',
    'inbox.view'
  ];

update public.admin_memberships
set permissions = array[
  'quests.view_published',
  'quests.view_all',
  'quests.create_draft',
  'quests.submit_review',
  'quests.review_publish',
  'admins.manage',
  'profile.manage',
  'inbox.view'
]
where role = 'super_admin';

drop policy if exists "Admins can create quests" on public.quests;
create policy "Admins can create quests"
on public.quests
for insert
to authenticated
with check (
  public.is_admin()
  and (
    status in ('draft', 'in_review')
    or public.is_super_admin()
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
    public.is_admin()
    and status in ('draft', 'in_review')
  )
)
with check (
  public.is_super_admin()
  or (
    public.is_admin()
    and status in ('draft', 'in_review')
  )
);

create or replace function public.enforce_quest_admin_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_super_admin() then
    if old.status <> 'published' and new.status = 'archived' then
      raise exception 'Only published quests can be archived.';
    end if;

    return new;
  end if;

  if new.status in ('published', 'archived') then
    raise exception 'Only the super admin can publish or archive quests.';
  end if;

  return new;
end;
$$;

drop trigger if exists quests_enforce_admin_transition on public.quests;
create trigger quests_enforce_admin_transition
before update on public.quests
for each row
execute function public.enforce_quest_admin_transition();

drop policy if exists "Admins can delete draft quests" on public.quests;
create policy "Admins can delete draft quests"
on public.quests
for delete
to authenticated
using (status = 'draft' and public.is_admin());

create table if not exists public.admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'admin' check (role = 'admin'),
  permissions text[] not null default array['quests.view_published', 'inbox.view', 'profile.manage'],
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists admin_invites_set_updated_at on public.admin_invites;
create trigger admin_invites_set_updated_at
before update on public.admin_invites
for each row
execute function public.set_updated_at();

alter table public.admin_invites enable row level security;

drop policy if exists "Super admins can manage admin invites" on public.admin_invites;
create policy "Super admins can manage admin invites"
on public.admin_invites
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'system' check (type in ('quest_approved', 'quest_denied', 'admin_invite', 'system')),
  title text not null,
  body text not null,
  related_quest_id uuid references public.quests(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_user_created_idx
on public.admin_notifications(user_id, created_at desc);

alter table public.admin_notifications enable row level security;

drop policy if exists "Admins can read their notifications" on public.admin_notifications;
create policy "Admins can read their notifications"
on public.admin_notifications
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Admins can update their notifications" on public.admin_notifications;
create policy "Admins can update their notifications"
on public.admin_notifications
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Super admins can write admin notifications" on public.admin_notifications;
create policy "Super admins can write admin notifications"
on public.admin_notifications
for insert
to authenticated
with check (public.is_super_admin());

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
  profile_record public.profiles%rowtype;
begin
  select *
  into invite_record
  from public.admin_invites
  where lower(email) = normalized_email
    and status in ('pending', 'accepted')
  limit 1;

  select *
  into profile_record
  from public.profiles
  where lower(email) = normalized_email
  limit 1;

  if profile_record.id is not null and exists (
    select 1 from public.admin_memberships where user_id = profile_record.id
  ) then
    return jsonb_build_object(
      'allowed', true,
      'email', normalized_email,
      'firstTime', false,
      'message', 'Admin account found.'
    );
  end if;

  if invite_record.id is not null and invite_record.status = 'pending' then
    return jsonb_build_object(
      'allowed', true,
      'email', normalized_email,
      'firstTime', true,
      'message', 'Admin invite found. Create your password.'
    );
  end if;

  return jsonb_build_object(
    'allowed', false,
    'email', normalized_email,
    'firstTime', false,
    'message', 'This email does not have admin access.'
  );
end;
$$;

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

  insert into public.admin_memberships (user_id, role, permissions, created_by)
  values (current_user_id, invite_record.role, invite_record.permissions, invite_record.invited_by)
  on conflict (user_id) do update
  set role = excluded.role,
      permissions = excluded.permissions;

  update public.admin_invites
  set status = 'accepted',
      accepted_by = current_user_id,
      accepted_at = now()
  where id = invite_record.id;
end;
$$;

grant execute on function public.accept_admin_invite() to authenticated;
