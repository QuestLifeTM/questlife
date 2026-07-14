-- Global app controls and one active, realtime announcement for the mobile app.
alter table public.quest_engine_settings
add column if not exists intro_enabled boolean not null default true;

update public.quest_engine_settings
set intro_enabled = true
where intro_enabled is null;

create or replace function public.intro_is_enabled()
returns boolean language sql security definer set search_path = '' stable as $$
  select coalesce((select intro_enabled from public.quest_engine_settings where id), true);
$$;

create or replace function public.get_intro_enabled()
returns boolean language sql security definer set search_path = '' stable as $$
  select public.intro_is_enabled();
$$;

create or replace function public.set_intro_enabled(p_enabled boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only super admins can change intro settings.';
  end if;

  update public.quest_engine_settings
  set intro_enabled = coalesce(p_enabled, true), updated_at = now(), updated_by = auth.uid()
  where id;

  return public.intro_is_enabled();
end;
$$;

revoke all on function public.intro_is_enabled() from public;
revoke all on function public.get_intro_enabled() from public;
revoke all on function public.set_intro_enabled(boolean) from public;
grant execute on function public.get_intro_enabled() to anon, authenticated;
grant execute on function public.set_intro_enabled(boolean) to authenticated;

create table if not exists public.app_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 90),
  body text not null check (char_length(btrim(body)) between 1 and 900),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists app_announcements_active_created_idx
on public.app_announcements (is_active, created_at desc);

create table if not exists public.app_announcement_dismissals (
  announcement_id uuid not null references public.app_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.app_announcements enable row level security;
alter table public.app_announcement_dismissals enable row level security;

drop policy if exists "Members can read active app announcements" on public.app_announcements;
create policy "Members can read active app announcements"
on public.app_announcements for select to authenticated
using (is_active or public.is_super_admin());

drop policy if exists "Super admins can deactivate app announcements" on public.app_announcements;
create policy "Super admins can deactivate app announcements"
on public.app_announcements for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

grant select, update on public.app_announcements to authenticated;

create or replace function public.get_active_app_announcement()
returns table (id uuid, title text, body text, created_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select announcement.id, announcement.title, announcement.body, announcement.created_at
  from public.app_announcements announcement
  where announcement.is_active
    and not exists (
      select 1
      from public.app_announcement_dismissals dismissal
      where dismissal.announcement_id = announcement.id
        and dismissal.user_id = auth.uid()
    )
  order by announcement.created_at desc
  limit 1;
$$;

create or replace function public.publish_app_announcement(p_title text, p_body text)
returns public.app_announcements
language plpgsql security definer set search_path = '' as $$
declare
  created_announcement public.app_announcements;
begin
  if not public.is_super_admin() then
    raise exception 'Only super admins can publish announcements.';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 90 then
    raise exception 'Announcement titles must be between 1 and 90 characters.';
  end if;

  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 900 then
    raise exception 'Announcement messages must be between 1 and 900 characters.';
  end if;

  update public.app_announcements
  set is_active = false
  where is_active;

  insert into public.app_announcements (title, body, created_by)
  values (btrim(p_title), btrim(p_body), auth.uid())
  returning * into created_announcement;

  return created_announcement;
end;
$$;

create or replace function public.dismiss_app_announcement(p_announcement_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to dismiss an announcement.';
  end if;

  if not exists (
    select 1 from public.app_announcements
    where id = p_announcement_id and is_active
  ) then
    raise exception 'Announcement is no longer active.';
  end if;

  insert into public.app_announcement_dismissals (announcement_id, user_id)
  values (p_announcement_id, auth.uid())
  on conflict (announcement_id, user_id) do nothing;
end;
$$;

revoke all on function public.get_active_app_announcement() from public;
revoke all on function public.publish_app_announcement(text, text) from public;
revoke all on function public.dismiss_app_announcement(uuid) from public;
grant execute on function public.get_active_app_announcement() to authenticated;
grant execute on function public.publish_app_announcement(text, text) to authenticated;
grant execute on function public.dismiss_app_announcement(uuid) to authenticated;

do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array['quest_engine_settings', 'app_announcements'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', realtime_table);
    end if;
  end loop;
end;
$$;
