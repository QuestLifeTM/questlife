-- Bios are public profile information. Preserve that rule for existing rows
-- and prevent future profile updates from opting into a narrower audience.
update public.profiles
set profile_privacy = jsonb_set(
  coalesce(profile_privacy, '{}'::jsonb),
  '{bio}',
  '"public"'::jsonb,
  true
)
where profile_privacy is null or profile_privacy->>'bio' is distinct from 'public';

create or replace function public.enforce_public_profile_bio()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.profile_privacy := jsonb_set(
    coalesce(new.profile_privacy, '{}'::jsonb),
    '{bio}',
    '"public"'::jsonb,
    true
  );
  return new;
end;
$$;

drop trigger if exists enforce_public_profile_bio on public.profiles;
create trigger enforce_public_profile_bio
before insert or update of profile_privacy on public.profiles
for each row execute function public.enforce_public_profile_bio();
