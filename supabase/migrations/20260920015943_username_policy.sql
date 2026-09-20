-- Canonical username policy. `username` preserves display capitalization;
-- `username_normalized` is the immutable lookup/uniqueness representation.
create table if not exists private.username_blocklist (
  value text primary key,
  match_mode text not null default 'exact' check (match_mode in ('exact', 'contains')),
  created_at timestamptz not null default now()
);

insert into private.username_blocklist (value, match_mode) values
  ('admin', 'exact'),
  ('administrator', 'exact'),
  ('support', 'exact'),
  ('help', 'exact'),
  ('moderator', 'exact'),
  ('mod', 'exact'),
  ('staff', 'exact'),
  ('team', 'exact'),
  ('official', 'exact'),
  ('questlife', 'contains'),
  ('questlifeapp', 'contains'),
  ('questlifeofficial', 'contains'),
  ('questlife_support', 'contains'),
  ('questlife_admin', 'contains'),
  ('system', 'exact'),
  ('root', 'exact'),
  ('api', 'exact'),
  ('security', 'exact'),
  ('developer', 'exact'),
  ('developers', 'exact'),
  ('owner', 'exact')
on conflict (value) do update set match_mode = excluded.match_mode;

alter table public.profiles
  add column if not exists username_normalized text generated always as (lower(username)) stored;

update public.profiles
set username = null
where username is not null
  and (
    username !~ '^[A-Za-z0-9._]{3,20}$'
    or username ~ '^[._]'
    or username ~ '[._]$'
    or username ~ '[._]{2}'
  );

alter table public.profiles drop constraint if exists profiles_username_format_chk;
alter table public.profiles add constraint profiles_username_format_chk check (
  username is null or (
    username ~ '^[A-Za-z0-9._]{3,20}$'
    and username !~ '^[._]'
    and username !~ '[._]$'
    and username !~ '[._]{2}'
  )
);

drop index if exists public.profiles_username_idx;
create unique index if not exists profiles_username_normalized_unique
  on public.profiles (username_normalized)
  where username_normalized is not null;

create or replace function private.username_validation_error(raw_username text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if raw_username is null or raw_username = '' then return 'Choose a username to continue.'; end if;
  if char_length(raw_username) < 3 then return 'Username must be at least 3 characters.'; end if;
  if char_length(raw_username) > 20 then return 'Username must be 20 characters or less.'; end if;
  if raw_username !~ '^[A-Za-z0-9._]+$' then return 'Username can only contain letters, numbers, . and _.'; end if;
  if raw_username ~ '^[._]' or raw_username ~ '[._]$' then return 'Username cannot start or end with . or _.'; end if;
  if raw_username ~ '[._]{2}' then return 'Username cannot contain consecutive symbols.'; end if;
  return null;
end;
$$;

create or replace function private.is_username_blocked(normalized_username text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from private.username_blocklist
    where (match_mode = 'exact' and value = normalized_username)
       or (match_mode = 'contains' and position(value in normalized_username) > 0)
  );
$$;

create or replace function private.enforce_profile_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  validation_error text;
begin
  if new.username is null then return new; end if;
  validation_error := private.username_validation_error(new.username);
  if validation_error is not null then
    raise exception using errcode = '23514', message = validation_error;
  end if;
  if private.is_username_blocked(lower(new.username)) then
    raise exception using errcode = '23514', message = 'That username isn''t available.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_username_policy on public.profiles;
create trigger profiles_enforce_username_policy
before insert or update of username on public.profiles
for each row execute function private.enforce_profile_username();

create or replace function public.is_username_available(raw_username text)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  normalized_username text;
begin
  if private.username_validation_error(raw_username) is not null then return false; end if;
  normalized_username := lower(raw_username);
  if private.is_username_blocked(normalized_username) then return false; end if;
  return not exists (
    select 1 from public.profiles
    where username_normalized = normalized_username
  );
end;
$$;

create or replace function public.check_username_availability(raw_username text)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  normalized_username text;
  validation_error text;
begin
  validation_error := private.username_validation_error(raw_username);
  if validation_error is not null then
    return jsonb_build_object('available', false, 'reason', validation_error);
  end if;
  normalized_username := lower(raw_username);
  if private.is_username_blocked(normalized_username) then
    return jsonb_build_object('available', false, 'reason', 'That username isn''t available.');
  end if;
  if exists (select 1 from public.profiles where username_normalized = normalized_username) then
    return jsonb_build_object('available', false, 'reason', 'That username is already taken. Try another one.');
  end if;
  return jsonb_build_object('available', true);
end;
$$;

create or replace function private.profile_username_from_user(user_id uuid, email text, metadata jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := coalesce(metadata->>'username', '');
  fallback text := lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9]', '', 'g'));
begin
  if private.username_validation_error(requested) is null
    and not private.is_username_blocked(lower(requested))
    and not exists (select 1 from public.profiles where username_normalized = lower(requested) and id <> user_id)
  then return requested; end if;

  if char_length(fallback) < 3 then fallback := 'user'; end if;
  return left(fallback, 15) || '_' || substr(user_id::text, 1, 4);
end;
$$;

revoke all on table private.username_blocklist from public, anon, authenticated;
revoke all on function private.username_validation_error(text) from public, anon, authenticated;
revoke all on function private.is_username_blocked(text) from public, anon, authenticated;
revoke all on function private.enforce_profile_username() from public, anon, authenticated;
revoke all on function private.profile_username_from_user(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.is_username_available(text) from public, anon, authenticated;
revoke all on function public.check_username_availability(text) from public, anon, authenticated;
grant execute on function public.is_username_available(text) to service_role;
grant execute on function public.check_username_availability(text) to service_role;
