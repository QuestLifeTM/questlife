alter table public.quests
add column if not exists steps text[] not null default '{}',
add column if not exists review_note text,
add column if not exists reviewed_at timestamptz,
add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

do $$
declare
  constraint_name text;
begin
  select conname
  into constraint_name
  from pg_constraint
  where conrelid = 'public.quests'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%'
    and pg_get_constraintdef(oid) like '%published%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.quests drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.quests
add constraint quests_status_check
check (status in ('draft', 'in_review', 'published', 'archived'));

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id or public.is_admin());
