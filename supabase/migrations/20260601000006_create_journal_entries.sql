create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  title text,
  mood text check (mood in ('sad', 'neutral', 'happy')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index if not exists journal_entries_user_date_idx
on public.journal_entries(user_id, entry_date desc);

alter table public.journal_entries enable row level security;

drop trigger if exists journal_entries_set_updated_at on public.journal_entries;
create trigger journal_entries_set_updated_at
before update on public.journal_entries
for each row
execute function public.set_updated_at();

drop policy if exists "Users can read their journal entries" on public.journal_entries;
create policy "Users can read their journal entries"
on public.journal_entries
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their journal entries" on public.journal_entries;
create policy "Users can create their journal entries"
on public.journal_entries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their journal entries" on public.journal_entries;
create policy "Users can update their journal entries"
on public.journal_entries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
