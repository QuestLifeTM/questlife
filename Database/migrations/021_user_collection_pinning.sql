-- Mirrors the deployable Supabase migration for local database workflows.
alter table public.user_adventure_packs
add column if not exists is_pinned boolean not null default false;

create unique index if not exists user_adventure_packs_one_pinned_per_user_idx
on public.user_adventure_packs (user_id)
where is_pinned;
