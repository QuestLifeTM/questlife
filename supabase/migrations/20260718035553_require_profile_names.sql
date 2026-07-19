-- Store a person's real name separately from their unique QuestLife username.
-- Existing accounts are intentionally left nullable so the app can require a
-- one-time completion step without breaking access during this rollout.
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_first_name_not_blank_chk'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_first_name_not_blank_chk
      check (first_name is null or char_length(btrim(first_name)) between 1 and 80);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_last_name_not_blank_chk'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_last_name_not_blank_chk
      check (last_name is null or char_length(btrim(last_name)) between 1 and 80);
  end if;
end;
$$;

-- The profile is created after email confirmation. Copy the validated signup
-- metadata into the profile so new accounts do not need the catch-up prompt.
create or replace function private.create_profile_after_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    insert into public.profiles (id, email, username, first_name, last_name)
    values (
      new.id,
      lower(new.email),
      private.profile_username_from_user(new.id, new.email, new.raw_user_meta_data),
      nullif(btrim(new.raw_user_meta_data->>'first_name'), ''),
      nullif(btrim(new.raw_user_meta_data->>'last_name'), '')
    )
    on conflict (id) do update
    set
      email = excluded.email,
      username = coalesce(public.profiles.username, excluded.username),
      first_name = coalesce(public.profiles.first_name, excluded.first_name),
      last_name = coalesce(public.profiles.last_name, excluded.last_name),
      updated_at = now();
  end if;

  return new;
end;
$$;
