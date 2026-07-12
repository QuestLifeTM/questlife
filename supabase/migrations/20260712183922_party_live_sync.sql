-- A Party is a shared surface. Persist the one-time briefing per member and
-- publish the small set of tables that can change the Party detail screen.
create table if not exists public.party_member_briefings (
  party_id uuid not null references public.parties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (party_id, user_id)
);
alter table public.party_member_briefings enable row level security;
drop policy if exists "Party members read own Party briefing" on public.party_member_briefings;
create policy "Party members read own Party briefing"
on public.party_member_briefings for select to authenticated
using (user_id = (select auth.uid()) and public.is_party_participant(party_id, (select auth.uid())));

create or replace function public.dismiss_party_briefing(p_party_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_party_participant(p_party_id, auth.uid()) then
    raise exception 'You are not part of this Party.';
  end if;
  insert into public.party_member_briefings (party_id, user_id)
  values (p_party_id, auth.uid())
  on conflict (party_id, user_id) do nothing;
end;
$$;
revoke execute on function public.dismiss_party_briefing(uuid) from public, anon;
grant execute on function public.dismiss_party_briefing(uuid) to authenticated;

-- Extend the existing wrapper instead of duplicating the full Party detail query.
create or replace function public.get_party_detail(p_party_id uuid)
returns jsonb language sql security definer set search_path = '' stable as $$
  select public.get_party_detail_base(p_party_id) || jsonb_build_object(
    'showWelcomeBriefing', not public.is_party_host(p_party_id, auth.uid()) and not exists (
      select 1 from public.party_member_briefings briefing
      where briefing.party_id = p_party_id and briefing.user_id = auth.uid()
    ),
    'mySuggestedQuestIds', coalesce((
      select jsonb_agg(suggestion.quest_id)
      from public.party_quest_suggestions suggestion
      where suggestion.party_id = p_party_id and suggestion.user_id = auth.uid()
    ), '[]'::jsonb),
    'suggestedQuests', case when public.is_party_host(p_party_id, auth.uid()) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'questId', q.id, 'title', q.title, 'description', q.description,
        'xp', q.experience_points, 'color', q.accent_color, 'count', suggestions.count
      ) order by suggestions.count desc, q.title)
      from (
        select suggestion.quest_id, count(*)::integer as count
        from public.party_quest_suggestions suggestion
        where suggestion.party_id = p_party_id
          and not exists (
            select 1 from public.party_quests party_quest
            where party_quest.party_id = p_party_id and party_quest.quest_id = suggestion.quest_id
          )
        group by suggestion.quest_id
      ) suggestions
      join public.quests q on q.id = suggestions.quest_id
    ), '[]'::jsonb) else '[]'::jsonb end
  );
$$;
revoke execute on function public.get_party_detail(uuid) from public, anon;
grant execute on function public.get_party_detail(uuid) to authenticated;

do $$
declare party_table text;
begin
  foreach party_table in array array[
    'parties', 'party_members', 'party_quests', 'party_quest_suggestions',
    'party_quest_rounds', 'party_quest_sessions', 'party_completions',
    'party_feed_posts', 'party_feed_reactions', 'party_member_notifications'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = party_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', party_table);
    end if;
  end loop;
end;
$$;
