-- iOS opt-in: legacy sessions and other clients keep the original scheduler.
alter table public.quests add column personalization jsonb not null default '[]'::jsonb;
create function public.valid_quest_personalization(tasks jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare t jsonb; ids text[] := '{}';
begin
 if jsonb_typeof(tasks) <> 'array' then return false; end if;
 for t in select value from jsonb_array_elements(tasks) loop
  if coalesce(t->>'id','') = '' or length(t->>'id') > 80 or (t->>'id') = any(ids)
   or coalesce(trim(t->>'title'),'') = '' or coalesce(trim(t->>'description'),'') = ''
   or coalesce(t->>'kind','') not in ('photo','video','note')
   or coalesce((t->>'xp')::numeric,-1) < 0 or (t->>'xp')::numeric <> trunc((t->>'xp')::numeric)
   or coalesce((t->>'waitMinutes')::numeric,-1) < 0 or coalesce((t->>'expiryMinutes')::numeric,0) <= 0 then return false; end if;
  ids := array_append(ids,t->>'id');
 end loop;
 return true;
 exception when others then return false;
end $$;
alter table public.quests add constraint quests_valid_personalization check (public.valid_quest_personalization(personalization));
create table public.quest_personalization_sessions (
 session_id uuid primary key references public.quest_sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id), tasks jsonb not null, ended jsonb not null default '{}'::jsonb
);
alter table public.quest_personalization_sessions enable row level security;
revoke all on public.quest_personalization_sessions from anon, authenticated;
grant select on public.quest_personalization_sessions to authenticated;
create policy "Owners read task progress" on public.quest_personalization_sessions for select to authenticated using (user_id = (select auth.uid()));
create function public.initialize_quest_personalization(p_session_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.quest_sessions%rowtype; plan public.quest_personalization_sessions%rowtype;
begin
 select * into s from public.quest_sessions where id=p_session_id and user_id=auth.uid() for update;
 if not found then raise exception 'Session not found'; end if;
 select * into plan from public.quest_personalization_sessions where session_id=s.id;
 if not found then
  -- Never silently change a pre-existing run's reward contract.
  if s.started_at < timestamptz '2026-11-03 22:44:11+00' or s.ended_at is not null then return null; end if;
  insert into public.quest_personalization_sessions(session_id,user_id,tasks)
   select s.id,s.user_id,q.personalization from public.quests q where q.id=s.quest_id returning * into plan;
 end if;
 return jsonb_build_object('tasks',plan.tasks,'ended',plan.ended);
end $$;
-- Internal resolver: all task prices and boundaries come from the immutable server plan.
create function public.resolve_quest_side_task(p_session_id uuid, p_elapsed bigint) returns jsonb language plpgsql security definer set search_path = '' as $$
declare plan public.quest_personalization_sessions%rowtype; t jsonb; idx integer := 0; cursor_ms bigint := 0; due_ms bigint; expires_ms bigint; key text; ending bigint; count_tasks integer;
begin
 select * into plan from public.quest_personalization_sessions where session_id=p_session_id;
 if not found then return null; end if;
 count_tasks := jsonb_array_length(plan.tasks);
 loop
  if count_tasks > 0 and idx >= count_tasks then return null; end if;
  t := plan.tasks->idx;
  key := case when count_tasks > 0 then 'task:' || (t->>'id') else 'generic:' || idx end;
  due_ms := cursor_ms + coalesce((t->>'waitMinutes')::numeric,5)*60000;
  expires_ms := due_ms + coalesce((t->>'expiryMinutes')::numeric,3)*60000;
  ending := (plan.ended->>key)::bigint;
  if ending is not null then cursor_ms := least(expires_ms,greatest(due_ms,ending));
  elsif p_elapsed >= expires_ms then cursor_ms := expires_ms;
  else
   if p_elapsed < due_ms then return null; end if;
   return jsonb_build_object('id',key,'dueMs',due_ms,'expiresMs',expires_ms,'xp',coalesce((t->>'xp')::integer,10),'kind',coalesce(t->>'kind',case when mod(idx,2)=0 then 'capture' else 'note' end));
  end if;
  idx := idx + 1;
 end loop;
end $$;
revoke all on function public.resolve_quest_side_task(uuid,bigint) from public,anon,authenticated;
create function public.dismiss_quest_side_task(p_session_id uuid,p_prompt_id text,p_elapsed bigint) returns void language plpgsql security definer set search_path = '' as $$
declare s public.quest_sessions%rowtype; candidate jsonb;
begin
 select * into s from public.quest_sessions where id=p_session_id and user_id=auth.uid() for update;
 if not found then raise exception 'Session not found'; end if;
 if p_prompt_id like 'mood:%' then return; end if;
 if exists(select 1 from public.quest_personalization_sessions where session_id=s.id and ended ? p_prompt_id) then return; end if;
 if p_elapsed < 0 or p_elapsed > extract(epoch from (coalesce(s.ended_at,now())-s.started_at))*1000 then raise exception 'Invalid time'; end if;
 candidate := public.resolve_quest_side_task(s.id,p_elapsed);
 if candidate is null or candidate->>'id' <> p_prompt_id then raise exception 'Task not available'; end if;
 update public.quest_personalization_sessions set ended=ended || jsonb_build_object(p_prompt_id,p_elapsed) where session_id=s.id;
end $$;
revoke all on function public.initialize_quest_personalization(uuid) from public,anon;
revoke all on function public.dismiss_quest_side_task(uuid,text,bigint) from public,anon;
grant execute on function public.initialize_quest_personalization(uuid),public.dismiss_quest_side_task(uuid,text,bigint) to authenticated;
alter table public.quest_prompt_rewards drop constraint quest_prompt_rewards_xp_check;
alter table public.quest_prompt_rewards add constraint quest_prompt_rewards_xp_check check (xp >= 0);

create or replace function public.save_quest_journey_event(p_session_id uuid, p_event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  sess public.quest_sessions%rowtype;
  existing public.quest_journey_events%rowtype;
  recorded public.quest_session_snapshots%rowtype;
  recorded_elapsed bigint;
  event_id text := p_event->>'id';
  event_kind text := p_event->>'kind';
  prompt text := nullif(p_event->>'promptId', '');
  elapsed bigint := (p_event->>'activeElapsedMs')::bigint;
  captured timestamptz := (p_event->>'capturedAt')::timestamptz;
  media_path text := p_event->>'storagePath';
  slot bigint;
  expected text;
  bonus integer := 0;
  clean jsonb;
  personalized boolean;
  candidate jsonb;
begin
  if owner_id is null then raise exception 'Not authenticated'; end if;
  select * into sess from public.quest_sessions where id = p_session_id and user_id = owner_id for update;
  if not found then raise exception 'Quest session not found'; end if;
  if not exists(select 1 from public.quests q where q.id = sess.quest_id and q.quest_mode = 'focused') then raise exception 'Focused quest required'; end if;
  if event_id is null or length(event_id) > 100 or event_kind is null or event_kind not in ('mood','photo','video','note') then raise exception 'Invalid event'; end if;
  select * into existing from public.quest_journey_events where session_id = p_session_id
    and (client_event_id = event_id or (prompt is not null and prompt_id = prompt));
  if found then return jsonb_build_object('xp', coalesce((existing.event->>'xp')::integer, 0), 'eventId', existing.client_event_id); end if;
  -- Offline responses are allowed after completion/abandonment only if captured during the run.
  if elapsed is null or elapsed < 0 or captured is null or captured < sess.started_at - interval '30 seconds'
     or captured > now() + interval '30 seconds' or captured > coalesce(sess.ended_at, now()) + interval '30 seconds'
     or elapsed > greatest(0, extract(epoch from (least(captured, now()) - sess.started_at))*1000) + 30000
  then raise exception 'Invalid quest time'; end if;
  select * into recorded from public.quest_session_snapshots where session_id = p_session_id and user_id = owner_id;
  recorded_elapsed := coalesce(recorded.active_duration_ms, 0) + case when recorded.recording_state = 'recording'
    then greatest(0, extract(epoch from (least(captured, now()) - recorded.updated_at))*1000)::bigint else 0 end;
  personalized := exists(select 1 from public.quest_personalization_sessions where session_id = p_session_id);
  if not personalized and elapsed > recorded_elapsed + 30000 then raise exception 'Active time has not synced'; end if;
  if event_id = 'initial' and (event_kind <> 'mood' or elapsed <> 0 or prompt is not null) then raise exception 'Invalid starting mood'; end if;
  if length(coalesce(p_event->>'body','')) > 4000 then raise exception 'Note too long'; end if;
  if event_kind = 'note' and length(trim(coalesce(p_event->>'body',''))) = 0 then raise exception 'Empty note'; end if;
  if event_kind = 'mood' and coalesce(p_event->>'mood','') not in ('sad','neutral','happy') then raise exception 'Invalid mood'; end if;
  if event_kind in ('photo','video') then
    if media_path is null or split_part(media_path,'/',1) <> owner_id::text or split_part(media_path,'/',2) <> p_session_id::text
       or not exists(select 1 from storage.objects o where o.bucket_id = 'quest-moments' and o.name = media_path)
    then raise exception 'Save media before claiming a reward'; end if;
    if coalesce(p_event->>'mimeType','') not in ('image/jpeg','video/mp4','video/quicktime')
       or (event_kind = 'photo' and p_event->>'mimeType' <> 'image/jpeg')
       or (event_kind = 'video' and p_event->>'mimeType' not in ('video/mp4','video/quicktime'))
    then raise exception 'Invalid media type'; end if;
    if p_event->>'thumbnailPath' is not null and (split_part(p_event->>'thumbnailPath','/',1) <> owner_id::text
       or split_part(p_event->>'thumbnailPath','/',2) <> p_session_id::text
       or not exists(select 1 from storage.objects o where o.bucket_id='quest-moments' and o.name=p_event->>'thumbnailPath'))
    then raise exception 'Invalid thumbnail'; end if;
    if event_kind = 'video' and (coalesce((p_event->>'durationSeconds')::numeric, 0) <= 0 or (p_event->>'durationSeconds')::numeric > 30.1) then raise exception 'Video too long'; end if;
  end if;
  if prompt is not null then
    if personalized then
      if abs(elapsed - extract(epoch from (captured-sess.started_at))*1000) > 30000 then raise exception 'Invalid wall time'; end if;
      if event_kind = 'mood' then
        slot := case when elapsed < 300000 then 0 else 1 + (elapsed-300000)/450000 end;
        expected := 'mood:' || slot;
        bonus := case when slot=0 then 0 else 10 end;
        candidate := jsonb_build_object('dueMs',case when slot=0 then 0 else 300000+(slot-1)*450000 end);
      else
        candidate := public.resolve_quest_side_task(p_session_id,elapsed);
        expected := candidate->>'id';
        if expected is null or (candidate->>'kind' <> event_kind and not (candidate->>'kind'='capture' and event_kind in ('photo','video'))) then raise exception 'Task unavailable or wrong response'; end if;
        bonus := (candidate->>'xp')::integer;
      end if;
    elsif event_kind = 'mood' then
      slot := elapsed / 600000;
      expected := 'mood:' || slot::text;
      if slot < 1 then raise exception 'Prompt not due'; end if;
      bonus := 5;
    else
      if elapsed < 300000 then raise exception 'Prompt not due'; end if;
      slot := (elapsed - 300000) / 600000;
      expected := case when mod(slot, 2) = 0 then 'capture:' else 'note:' end || slot::text;
      if (mod(slot,2) = 0 and event_kind not in ('photo','video')) or (mod(slot,2) = 1 and event_kind <> 'note') then raise exception 'Wrong prompt response'; end if;
      bonus := 10;
    end if;
    if prompt <> expected then raise exception 'Invalid prompt'; end if;
  end if;
  clean := jsonb_strip_nulls(jsonb_build_object('id', event_id, 'kind', event_kind, 'capturedAt', captured,
    'activeElapsedMs', elapsed, 'mood', p_event->>'mood', 'body', p_event->>'body',
    'remotePath', media_path, 'thumbnailRemotePath', p_event->>'thumbnailPath', 'mimeType', p_event->>'mimeType', 'durationSeconds', p_event->'durationSeconds',
    'syncState', 'synced', 'xp', bonus,
    'prompt', case when prompt is not null then jsonb_build_object('id',prompt,'kind',split_part(prompt,':',1),'dueMs',case when personalized then (candidate->>'dueMs')::bigint when event_kind='mood' then slot*600000 else 300000+slot*600000 end, 'version',case when personalized then 2 else 1 end,'xp',bonus) else null end));
  insert into public.quest_journey_events(session_id,user_id,client_event_id,prompt_id,active_elapsed_ms,event)
  values(p_session_id,owner_id,event_id,prompt,elapsed,clean);
  if personalized and prompt is not null and event_kind <> 'mood' then
    update public.quest_personalization_sessions set ended=ended || jsonb_build_object(prompt,elapsed) where session_id=p_session_id;
  end if;
  if bonus > 0 then
    insert into public.quest_prompt_rewards(session_id,user_id,prompt_id,client_event_id,xp) values(p_session_id,owner_id,prompt,event_id,bonus);
    update public.profiles set total_xp = total_xp + bonus where id = owner_id;
  end if;
  return jsonb_build_object('xp',bonus,'eventId',event_id);
end;
$$;
