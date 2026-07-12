alter function public.get_party_detail(uuid) rename to get_party_detail_base;

create function public.get_party_detail(p_party_id uuid)
returns jsonb language sql security definer set search_path = '' stable as $$
  select public.get_party_detail_base(p_party_id) || jsonb_build_object(
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

revoke execute on function public.get_party_detail_base(uuid) from public, anon, authenticated;
revoke execute on function public.get_party_detail(uuid) from public, anon;
grant execute on function public.get_party_detail(uuid) to authenticated;
