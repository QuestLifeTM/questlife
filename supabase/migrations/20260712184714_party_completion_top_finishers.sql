create or replace function public.complete_party_quest_v2(
  p_party_id uuid,
  p_quest_id uuid,
  p_today date default current_date,
  p_reflection text default null,
  p_journal_photo_paths text[] default '{}',
  p_share_to_feed boolean default false,
  p_feed_caption text default null,
  p_shared_photo_paths text[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  party_row public.parties%rowtype;
  quest_row public.quests%rowtype;
  active_round public.party_quest_rounds%rowtype;
  active_session public.party_quest_sessions%rowtype;
  started timestamptz;
  base integer;
  completion_id uuid;
  new_party_completion_id uuid;
  daily_used integer;
  fastest jsonb;
  top_finishers jsonb;
  proof_mode text;
  should_share boolean;
  feed_type text;
  elapsed_seconds integer;
begin
  select * into party_row from public.parties where id = p_party_id;
  if party_row.status <> 'active' or not public.is_party_member(p_party_id, current_user_id) then raise exception 'This party is not active.'; end if;
  select * into quest_row from public.quests where id = p_quest_id and status = 'published';
  if quest_row.id is null then raise exception 'QUEST_NOT_AVAILABLE'; end if;
  if coalesce(array_length(p_journal_photo_paths, 1), 0) > 5 then raise exception 'You can add up to five Journal photos.'; end if;
  if coalesce(array_length(p_shared_photo_paths, 1), 0) > 5 then raise exception 'You can share up to five Party photos.'; end if;

  proof_mode := coalesce(party_row.photo_proof_mode, case when party_row.photo_proof_required then 'required' else 'disabled' end);
  if proof_mode = 'required' and (coalesce(array_length(p_journal_photo_paths, 1), 0) = 0 or coalesce(array_length(p_shared_photo_paths, 1), 0) = 0) then
    raise exception 'A proof photo is required for this Party quest.';
  end if;

  select count(*) into daily_used from public.quest_completions where user_id = current_user_id and completed_on = p_today;
  if daily_used >= 5 then raise exception 'DAILY_LIMIT_REACHED'; end if;

  if party_row.game_mode = 'everyone_together' then
    select * into active_round from public.party_quest_rounds where party_id = p_party_id and quest_id = p_quest_id and status = 'active';
    if active_round.id is null then raise exception 'This shared quest has not started.'; end if;
    if exists (select 1 from public.party_completions where party_id = p_party_id and quest_id = p_quest_id and user_id = current_user_id and round_id = active_round.id) then raise exception 'You already completed this shared quest.'; end if;
    started := active_round.started_at;
  else
    select * into active_session from public.party_quest_sessions where party_id = p_party_id and quest_id = p_quest_id and user_id = current_user_id and status = 'active';
    if active_session.id is null then raise exception 'Start this Party quest before completing it.'; end if;
    started := active_session.started_at;
  end if;

  base := quest_row.experience_points;
  should_share := proof_mode = 'required' or (coalesce(p_share_to_feed, false) and coalesce(array_length(p_shared_photo_paths, 1), 0) > 0);
  feed_type := case when proof_mode = 'required' then 'proof' when should_share then 'adventure' else 'activity' end;
  elapsed_seconds := extract(epoch from now() - started)::integer;

  insert into public.quest_completions (user_id, quest_id, completed_on, reflection, xp_awarded, logged, review_public, photo_urls, party_id)
  values (current_user_id, p_quest_id, p_today, nullif(trim(coalesce(p_reflection, '')), ''), base, true, false, coalesce(p_journal_photo_paths, '{}'), p_party_id)
  returning id into completion_id;

  insert into public.party_completions (party_id, quest_id, user_id, round_id, session_id, quest_completion_id, base_xp, started_at, reflection, photo_paths, journal_photo_paths, shared_photo_paths)
  values (p_party_id, p_quest_id, current_user_id, active_round.id, active_session.id, completion_id, base, started, nullif(trim(coalesce(p_reflection, '')), ''), coalesce(p_shared_photo_paths, '{}'), coalesce(p_journal_photo_paths, '{}'), coalesce(p_shared_photo_paths, '{}'))
  returning id into new_party_completion_id;

  update public.quest_completions set party_completion_id = new_party_completion_id where id = completion_id;
  insert into public.party_feed_posts (party_id, completion_id, quest_id, user_id, caption, photo_paths, post_type, elapsed_seconds)
  values (p_party_id, new_party_completion_id, p_quest_id, current_user_id, case when should_share then nullif(trim(coalesce(p_feed_caption, '')), '') else null end, case when should_share then coalesce(p_shared_photo_paths, '{}') else '{}' end, feed_type, elapsed_seconds);

  if party_row.game_mode = 'free_for_all' then
    update public.party_quest_sessions set status = 'completed', completed_at = now() where id = active_session.id;
  end if;

  select jsonb_build_object('name', coalesce(pr.display_name, 'Adventurer'), 'emoji', pr.emoji, 'elapsedSeconds', extract(epoch from pc.completed_at - pc.started_at)::integer)
    into fastest
  from public.party_completions pc join public.profiles pr on pr.id = pc.user_id
  where pc.party_id = p_party_id and pc.quest_id = p_quest_id
  order by pc.completed_at - pc.started_at, pc.completed_at limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('name', ranked.name, 'emoji', ranked.emoji, 'elapsedSeconds', ranked.elapsed_seconds, 'rank', ranked.rank) order by ranked.rank), '[]'::jsonb)
    into top_finishers
  from (
    select coalesce(pr.display_name, 'Adventurer') as name, pr.emoji,
      extract(epoch from pc.completed_at - pc.started_at)::integer as elapsed_seconds,
      row_number() over (order by pc.completed_at - pc.started_at, pc.completed_at)::integer as rank
    from public.party_completions pc join public.profiles pr on pr.id = pc.user_id
    where pc.party_id = p_party_id and pc.quest_id = p_quest_id
      and (party_row.game_mode <> 'everyone_together' or pc.round_id = active_round.id)
    order by pc.completed_at - pc.started_at, pc.completed_at limit 3
  ) ranked;

  return jsonb_build_object('completionId', new_party_completion_id, 'xpAwarded', base, 'dailyUsed', daily_used + 1, 'dailyLimit', 5, 'fastest', fastest, 'topFinishers', top_finishers, 'proofMode', proof_mode, 'feedShared', should_share, 'elapsedSeconds', elapsed_seconds);
end;
$$;

revoke execute on function public.complete_party_quest_v2(uuid, uuid, date, text, text[], boolean, text, text[]) from public, anon;
grant execute on function public.complete_party_quest_v2(uuid, uuid, date, text, text[], boolean, text, text[]) to authenticated;
