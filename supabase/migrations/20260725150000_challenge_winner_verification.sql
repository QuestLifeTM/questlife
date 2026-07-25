-- A completed challenge needs an authoritative result. The overview now
-- returns the first qualifying completion for each participant and calculates
-- the winner in Postgres, rather than relying on client-side timing.

alter function public.get_social_overview(date) rename to get_social_overview_challenge_winner_base;

create function public.get_social_overview(p_today date default current_date)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with payload as (
    select public.get_social_overview_challenge_winner_base(p_today) as data
  )
  select data || jsonb_build_object(
    'activeChallenges', coalesce((
      select jsonb_agg(
        item.value || jsonb_build_object(
          'iCompleted', mine.completed_at is not null,
          'partnerCompleted', partner.completed_at is not null,
          'myCompletedAt', mine.completed_at,
          'partnerCompletedAt', partner.completed_at,
          'isComplete', mine.completed_at is not null and partner.completed_at is not null,
          'winner', case
            when mine.completed_at is null or partner.completed_at is null then null
            when mine.completed_at <= partner.completed_at then 'me'
            else 'partner'
          end
        )
        order by item.ordinality
      )
      from jsonb_array_elements(coalesce(data->'activeChallenges', '[]'::jsonb)) with ordinality item(value, ordinality)
      join public.quest_challenges challenge on challenge.id = (item.value->>'id')::uuid
      left join lateral (
        select completion.created_at as completed_at
        from public.quest_completions completion
        where challenge.status = 'accepted'
          and completion.user_id = auth.uid()
          and completion.quest_id = challenge.quest_id
          and completion.created_at >= coalesce(challenge.responded_at, challenge.created_at)
        order by completion.created_at asc
        limit 1
      ) mine on true
      left join lateral (
        select completion.created_at as completed_at
        from public.quest_completions completion
        where challenge.status = 'accepted'
          and completion.user_id = (item.value->>'partnerId')::uuid
          and completion.quest_id = challenge.quest_id
          and completion.created_at >= coalesce(challenge.responded_at, challenge.created_at)
        order by completion.created_at asc
        limit 1
      ) partner on true
    ), '[]'::jsonb)
  )
  from payload;
$$;

revoke execute on function public.get_social_overview_challenge_winner_base(date) from public, anon, authenticated;
revoke execute on function public.get_social_overview(date) from public, anon;
grant execute on function public.get_social_overview(date) to authenticated;
