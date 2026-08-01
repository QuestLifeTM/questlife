-- User-created adventure packs, daily quest plans for the lobby, official pack
-- cover photos, and the storage buckets used for uploads.

-- ---------------------------------------------------------------------------
-- adventure_packs: cover photo
-- ---------------------------------------------------------------------------

alter table public.adventure_packs
add column if not exists cover_image_url text;

-- ---------------------------------------------------------------------------
-- user_adventure_packs: personal quest collections
-- ---------------------------------------------------------------------------

create table if not exists public.user_adventure_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  icon text not null default '🎒',
  accent_color text not null default '#4da8ff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_adventure_packs_user_idx on public.user_adventure_packs(user_id);

alter table public.user_adventure_packs enable row level security;

drop trigger if exists user_adventure_packs_set_updated_at on public.user_adventure_packs;
create trigger user_adventure_packs_set_updated_at
before update on public.user_adventure_packs
for each row
execute function public.set_updated_at();

drop policy if exists "Users manage their own packs" on public.user_adventure_packs;
create policy "Users manage their own packs"
on public.user_adventure_packs
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.user_adventure_pack_quests (
  user_pack_id uuid not null references public.user_adventure_packs(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_pack_id, quest_id)
);

alter table public.user_adventure_pack_quests enable row level security;

drop policy if exists "Users manage their own pack quests" on public.user_adventure_pack_quests;
create policy "Users manage their own pack quests"
on public.user_adventure_pack_quests
for all
to authenticated
using (
  exists (
    select 1 from public.user_adventure_packs
    where user_adventure_packs.id = user_adventure_pack_quests.user_pack_id
      and user_adventure_packs.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.user_adventure_packs
    where user_adventure_packs.id = user_adventure_pack_quests.user_pack_id
      and user_adventure_packs.user_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- daily_plans: "Create a plan" in the lobby
-- ---------------------------------------------------------------------------
-- One plan per user per local day. A plan is a small ordered list of quests
-- picked by hand or seeded from an adventure pack.

create table if not exists public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_on date not null,
  source_pack_id uuid references public.adventure_packs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_on)
);

alter table public.daily_plans enable row level security;

drop trigger if exists daily_plans_set_updated_at on public.daily_plans;
create trigger daily_plans_set_updated_at
before update on public.daily_plans
for each row
execute function public.set_updated_at();

drop policy if exists "Users manage their own plans" on public.daily_plans;
create policy "Users manage their own plans"
on public.daily_plans
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.daily_plan_quests (
  plan_id uuid not null references public.daily_plans(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (plan_id, quest_id)
);

alter table public.daily_plan_quests enable row level security;

drop policy if exists "Users manage their own plan quests" on public.daily_plan_quests;
create policy "Users manage their own plan quests"
on public.daily_plan_quests
for all
to authenticated
using (
  exists (
    select 1 from public.daily_plans
    where daily_plans.id = daily_plan_quests.plan_id
      and daily_plans.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.daily_plans
    where daily_plans.id = daily_plan_quests.plan_id
      and daily_plans.user_id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Storage buckets: pack covers (admin uploads) and quest photos (user uploads)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('pack-covers', 'pack-covers', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('quest-photos', 'quest-photos', true)
on conflict (id) do nothing;

drop policy if exists "Admins can upload pack covers" on storage.objects;
create policy "Admins can upload pack covers"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'pack-covers' and public.is_admin());

drop policy if exists "Admins can update pack covers" on storage.objects;
create policy "Admins can update pack covers"
on storage.objects
for update
to authenticated
using (bucket_id = 'pack-covers' and public.is_admin())
with check (bucket_id = 'pack-covers' and public.is_admin());

drop policy if exists "Admins can delete pack covers" on storage.objects;
create policy "Admins can delete pack covers"
on storage.objects
for delete
to authenticated
using (bucket_id = 'pack-covers' and public.is_admin());

drop policy if exists "Users can upload quest photos" on storage.objects;
create policy "Users can upload quest photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'quest-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their quest photos" on storage.objects;
create policy "Users can delete their quest photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'quest-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
