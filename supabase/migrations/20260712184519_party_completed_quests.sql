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
        'xp', q.experience_points, 'color', q.accent_color, 'category', q.category,
        'count', suggestions.count
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
    ), '[]'::jsonb) else '[]'::jsonb end,
    'completedQuests', case when (select game_mode from public.parties where id = p_party_id) = 'everyone_together' then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', round.id, 'questId', q.id, 'title', q.title, 'category', q.category,
        'color', q.accent_color, 'xp', q.experience_points, 'completedAt', round.ended_at,
        'completedCount', (select count(*)::integer from public.party_completions completion where completion.round_id = round.id)
      ) order by round.ended_at desc)
      from public.party_quest_rounds round
      join public.quests q on q.id = round.quest_id
      where round.party_id = p_party_id and round.status = 'ended'
    ), '[]'::jsonb) else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', completion.id, 'questId', q.id, 'title', q.title, 'category', q.category,
        'color', q.accent_color, 'xp', completion.base_xp + completion.bonus_xp,
        'completedAt', completion.completed_at, 'completedCount', 1
      ) order by completion.completed_at desc)
      from public.party_completions completion
      join public.quests q on q.id = completion.quest_id
      where completion.party_id = p_party_id and completion.user_id = auth.uid()
    ), '[]'::jsonb) end
  );
$$;
revoke execute on function public.get_party_detail(uuid) from public, anon;
grant execute on function public.get_party_detail(uuid) to authenticated;
