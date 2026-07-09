-- Featured quest scheduling: admins pick a batch of 6 quests for each calendar
-- date. The app shows today's batch in Explore's "Featured Today" section.
--
-- Rules:
-- * One batch per date (unique featured_on).
-- * Exactly 6 quests per batch is enforced in the admin UI; the schema caps
--   positions at 0-5 so a batch can never exceed 6.
-- * Past batches are read-only: admin write policies only allow rows whose
--   date is today or later.

create table if not exists public.featured_quest_batches (
  id uuid primary key default gen_random_uuid(),
  featured_on date not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.featured_quest_batches enable row level security;

drop trigger if exists featured_quest_batches_set_updated_at on public.featured_quest_batches;
create trigger featured_quest_batches_set_updated_at
before update on public.featured_quest_batches
for each row
execute function public.set_updated_at();

drop policy if exists "Authenticated users can read featured batches" on public.featured_quest_batches;
create policy "Authenticated users can read featured batches"
on public.featured_quest_batches
for select
to authenticated
using (true);

drop policy if exists "Admins can create upcoming featured batches" on public.featured_quest_batches;
create policy "Admins can create upcoming featured batches"
on public.featured_quest_batches
for insert
to authenticated
with check (public.is_admin() and featured_on >= current_date);

drop policy if exists "Admins can update upcoming featured batches" on public.featured_quest_batches;
create policy "Admins can update upcoming featured batches"
on public.featured_quest_batches
for update
to authenticated
using (public.is_admin() and featured_on >= current_date)
with check (public.is_admin() and featured_on >= current_date);

drop policy if exists "Admins can delete upcoming featured batches" on public.featured_quest_batches;
create policy "Admins can delete upcoming featured batches"
on public.featured_quest_batches
for delete
to authenticated
using (public.is_admin() and featured_on >= current_date);

create table if not exists public.featured_batch_quests (
  batch_id uuid not null references public.featured_quest_batches(id) on delete cascade,
  quest_id uuid not null references public.quests(id) on delete cascade,
  position integer not null check (position >= 0 and position <= 5),
  created_at timestamptz not null default now(),
  primary key (batch_id, quest_id),
  unique (batch_id, position)
);

alter table public.featured_batch_quests enable row level security;

drop policy if exists "Authenticated users can read featured batch quests" on public.featured_batch_quests;
create policy "Authenticated users can read featured batch quests"
on public.featured_batch_quests
for select
to authenticated
using (true);

drop policy if exists "Admins can manage upcoming featured batch quests" on public.featured_batch_quests;
create policy "Admins can manage upcoming featured batch quests"
on public.featured_batch_quests
for all
to authenticated
using (
  public.is_admin()
  and exists (
    select 1 from public.featured_quest_batches
    where featured_quest_batches.id = featured_batch_quests.batch_id
      and featured_quest_batches.featured_on >= current_date
  )
)
with check (
  public.is_admin()
  and exists (
    select 1 from public.featured_quest_batches
    where featured_quest_batches.id = featured_batch_quests.batch_id
      and featured_quest_batches.featured_on >= current_date
  )
);
