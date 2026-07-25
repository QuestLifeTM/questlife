-- Challenge completion must be earned after a challenge is accepted. The
-- previous overview checked all historical completions, which could mark a
-- newly accepted challenge as finished immediately.

alter function public.get_social_overview(date) rename to get_social_overview_challenge_base;

create function public.get_social_overview(p_today date default current_date)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with payload as (
    select public.get_social_overview_challenge_base(p_today) as data
  )
  select data || jsonb_build_object(
    'activeChallenges', coalesce((
      select jsonb_agg(
        item.value || jsonb_build_object(
          'iCompleted', case when challenge.status = 'accepted' then exists (
            select 1
            from public.quest_completions completion
            where completion.user_id = auth.uid()
              and completion.quest_id = challenge.quest_id
              and completion.created_at >= coalesce(challenge.responded_at, challenge.created_at)
          ) else false end,
          'partnerCompleted', case when challenge.status = 'accepted' then exists (
            select 1
            from public.quest_completions completion
            where completion.user_id = (item.value->>'partnerId')::uuid
              and completion.quest_id = challenge.quest_id
              and completion.created_at >= coalesce(challenge.responded_at, challenge.created_at)
          ) else false end
        )
        order by item.ordinality
      )
      from jsonb_array_elements(coalesce(data->'activeChallenges', '[]'::jsonb)) with ordinality item(value, ordinality)
      join public.quest_challenges challenge on challenge.id = (item.value->>'id')::uuid
    ), '[]'::jsonb)
  )
  from payload;
$$;

revoke execute on function public.get_social_overview_challenge_base(date) from public, anon, authenticated;
revoke execute on function public.get_social_overview(date) from public, anon;
grant execute on function public.get_social_overview(date) to authenticated;
