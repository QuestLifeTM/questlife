create schema if not exists private;

revoke all on schema private from anon, authenticated;

create or replace function private.create_profile_after_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do update
    set
      email = excluded.email,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists create_profile_after_email_confirmation on auth.users;

drop function if exists public.create_profile_after_email_confirmation();

create trigger create_profile_after_email_confirmation
after update of email_confirmed_at on auth.users
for each row
execute function private.create_profile_after_email_confirmation();
