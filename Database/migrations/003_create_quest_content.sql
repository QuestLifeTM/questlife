create extension if not exists pgcrypto;

create table if not exists public.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'super_admin')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.admin_memberships enable row level security;

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
  );
$$;

drop policy if exists "Admins can read admin memberships" on public.admin_memberships;
create policy "Admins can read admin memberships"
on public.admin_memberships
for select
to authenticated
using (public.is_admin());

drop policy if exists "Super admins can manage admin memberships" on public.admin_memberships;
create policy "Super admins can manage admin memberships"
on public.admin_memberships
for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id or public.is_admin());

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in (
    'ADVENTURE',
    'FOOD AND DRINKS',
    'FITNESS',
    'NATURE',
    'CREATIVITY',
    'EVENTS',
    'SKILLS',
    'SOCIAL',
    'WILD CARD'
  )),
  experience_points integer not null check (experience_points >= 0 and experience_points <= 100000),
  description text not null,
  steps text[] not null default '{}',
  estimated_minutes integer not null check (estimated_minutes > 0 and estimated_minutes <= 1440),
  difficulty text not null check (difficulty in ('EASY', 'MEDIUM', 'HARD', 'FORMIDABLE')),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived')),
  featured boolean not null default false,
  accent_color text not null default '#4da8ff',
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists quests_status_idx on public.quests(status);
create index if not exists quests_category_idx on public.quests(category);
create index if not exists quests_featured_idx on public.quests(featured);

alter table public.quests enable row level security;

drop trigger if exists quests_set_updated_at on public.quests;
create trigger quests_set_updated_at
before update on public.quests
for each row
execute function public.set_updated_at();

drop policy if exists "Published quests are readable" on public.quests;
create policy "Published quests are readable"
on public.quests
for select
to authenticated
using (status = 'published' or public.is_admin());

drop policy if exists "Admins can create quests" on public.quests;
create policy "Admins can create quests"
on public.quests
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update quests" on public.quests;
create policy "Admins can update quests"
on public.quests
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Super admins can delete quests" on public.quests;
create policy "Super admins can delete quests"
on public.quests
for delete
to authenticated
using (public.is_super_admin());

create table if not exists public.adventure_packs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  accent_color text not null default '#00bbf9',
  background_color text not null default '#eef9ff',
  icon text not null default '🧭',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists adventure_packs_status_idx on public.adventure_packs(status);

alter table public.adventure_packs enable row level security;

drop trigger if exists adventure_packs_set_updated_at on public.adventure_packs;
create trigger adventure_packs_set_updated_at
before update on public.adventure_packs
for each row
execute function public.set_updated_at();

drop policy if exists "Published adventure packs are readable" on public.adventure_packs;
create policy "Published adventure packs are readable"
on public.adventure_packs
for select
to authenticated
using (status = 'published' or public.is_admin());

drop policy if exists "Admins can create adventure packs" on public.adventure_packs;
create policy "Admins can create adventure packs"
on public.adventure_packs
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update adventure packs" on public.adventure_packs;
create policy "Admins can update adventure packs"
on public.adventure_packs
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Super admins can delete adventure packs" on public.adventure_packs;
create policy "Super admins can delete adventure packs"
on public.adventure_packs
for delete
to authenticated
using (public.is_super_admin());

create table if not exists public.adventure_pack_quests (
  adventure_pack_id uuid not null references public.adventure_packs(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (adventure_pack_id, quest_id)
);

create index if not exists adventure_pack_quests_pack_position_idx
on public.adventure_pack_quests(adventure_pack_id, position);

alter table public.adventure_pack_quests enable row level security;

drop policy if exists "Published adventure pack quests are readable" on public.adventure_pack_quests;
create policy "Published adventure pack quests are readable"
on public.adventure_pack_quests
for select
to authenticated
using (
  public.is_admin()
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
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.saved_quests (
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, quest_id)
);

alter table public.saved_quests enable row level security;

drop policy if exists "Users can read their saved quests" on public.saved_quests;
create policy "Users can read their saved quests"
on public.saved_quests
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can save quests" on public.saved_quests;
create policy "Users can save quests"
on public.saved_quests
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can unsave quests" on public.saved_quests;
create policy "Users can unsave quests"
on public.saved_quests
for delete
to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.quest_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  reflection text,
  created_at timestamptz not null default now()
);

create index if not exists quest_completions_user_created_idx
on public.quest_completions(user_id, created_at desc);

alter table public.quest_completions enable row level security;

drop policy if exists "Users can read their quest completions" on public.quest_completions;
create policy "Users can read their quest completions"
on public.quest_completions
for select
to authenticated
using ((select auth.uid()) = user_id or public.is_admin());

drop policy if exists "Users can complete quests" on public.quest_completions;
create policy "Users can complete quests"
on public.quest_completions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

drop policy if exists "Admins can read audit log" on public.admin_audit_log;
create policy "Admins can read audit log"
on public.admin_audit_log
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can write audit log" on public.admin_audit_log;
create policy "Admins can write audit log"
on public.admin_audit_log
for insert
to authenticated
with check (public.is_admin());
