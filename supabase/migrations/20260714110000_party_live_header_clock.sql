-- Persist the Party-level clock start so the header can show an accurate elapsed
-- duration. Free-for-All starts when the host opens quests; Together starts with
-- the active shared round (derived in the detail read model below).
alter table public.parties
  add column if not exists quests_enabled_at timestamptz;

-- Older Parties did not retain this event. Start their newly displayed live clock
-- at migration time rather than inventing an earlier timestamp.
update public.parties
set quests_enabled_at = now()
where quests_enabled and quests_enabled_at is null;

create or replace function public.set_party_quests_enabled(p_party_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_party_host(p_party_id, auth.uid()) then
    raise exception 'Only the host can update the Party quest list.';
  end if;

  update public.parties
  set quests_enabled = coalesce(p_enabled, false),
      quests_enabled_at = case
        when coalesce(p_enabled, false) and not quests_enabled then now()
        when not coalesce(p_enabled, false) then null
        else quests_enabled_at
      end
  where id = p_party_id and status = 'active';
end;
$$;
revoke execute on function public.set_party_quests_enabled(uuid, boolean) from public;
grant execute on function public.set_party_quests_enabled(uuid, boolean) to authenticated;

-- Keep the existing Party-detail contract intact and append the one field the
-- header needs. The underlying function still performs the participant check.
create or replace function public.get_party_detail_live(p_party_id uuid)
returns jsonb language sql security definer set search_path = '' stable as $$
  select public.get_party_detail(p_party_id) || jsonb_build_object(
    'partyStartedAt', case
      when party.game_mode = 'free_for_all' and party.quests_enabled then party.quests_enabled_at
      when party.game_mode = 'everyone_together' then (
        select round.started_at
        from public.party_quest_rounds round
        where round.party_id = party.id and round.status = 'active'
        order by round.started_at desc
        limit 1
      )
      else null
    end
  )
  from public.parties party
  where party.id = p_party_id;
$$;
revoke execute on function public.get_party_detail_live(uuid) from public, anon;
grant execute on function public.get_party_detail_live(uuid) to authenticated;
