-- Additive iOS journey data. Existing Android/web callers keep their APIs and rewards.
alter table public.quest_sessions add column if not exists completion_id uuid references public.quest_completions(id) on delete set null;
create unique index if not exists quest_sessions_completion_id_idx on public.quest_sessions(completion_id) where completion_id is not null;

create table public.quest_journey_events (
  session_id uuid not null references public.quest_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_event_id text not null,
  prompt_id text,
  active_elapsed_ms bigint not null check (active_elapsed_ms >= 0),
  event jsonb not null,
  created_at timestamptz not null default now(),
  primary key (session_id, client_event_id),
  unique (session_id, prompt_id)
);
alter table public.quest_journey_events enable row level security;
revoke all on public.quest_journey_events from anon, authenticated;
grant select on public.quest_journey_events to authenticated;
create policy "Owners read quest journey" on public.quest_journey_events for select to authenticated using (user_id = (select auth.uid()));

create table public.quest_prompt_rewards (
  session_id uuid not null references public.quest_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt_id text not null,
  client_event_id text not null,
  xp integer not null check (xp in (5, 10)),
  created_at timestamptz not null default now(),
  primary key (session_id, prompt_id),
  foreign key (session_id, client_event_id) references public.quest_journey_events(session_id, client_event_id)
);
alter table public.quest_prompt_rewards enable row level security;
revoke all on public.quest_prompt_rewards from anon, authenticated;
grant select on public.quest_prompt_rewards to authenticated;
create policy "Owners read quest prompt rewards" on public.quest_prompt_rewards for select to authenticated using (user_id = (select auth.uid()));

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('quest-moments', 'quest-moments', false, 31457280, array['image/jpeg','video/mp4','video/quicktime'])
on conflict (id) do nothing;
create policy "Owners read quest moments" on storage.objects for select to authenticated
using (bucket_id = 'quest-moments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners insert quest moments" on storage.objects for insert to authenticated
with check (bucket_id = 'quest-moments' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists(select 1 from public.quest_sessions s where s.id::text = (storage.foldername(name))[2] and s.user_id = (select auth.uid())));
create policy "Owners retry quest moments" on storage.objects for update to authenticated
using (bucket_id = 'quest-moments' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'quest-moments' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists(select 1 from public.quest_sessions s where s.id::text = (storage.foldername(name))[2] and s.user_id = (select auth.uid())));
create policy "Owners delete quest moments" on storage.objects for delete to authenticated
using (bucket_id = 'quest-moments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Atomic append + award. Neither direct table writes nor a client XP amount are accepted.
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
  if elapsed > recorded_elapsed + 30000 then raise exception 'Active time has not synced'; end if;
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
    if event_kind = 'mood' then
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
    'prompt', case when prompt is not null then jsonb_build_object('id',prompt,'kind',split_part(prompt,':',1),'dueMs',case when event_kind='mood' then slot*600000 else 300000+slot*600000 end,'xp',bonus) else null end));
  insert into public.quest_journey_events(session_id,user_id,client_event_id,prompt_id,active_elapsed_ms,event)
  values(p_session_id,owner_id,event_id,prompt,elapsed,clean);
  if bonus > 0 then
    insert into public.quest_prompt_rewards(session_id,user_id,prompt_id,client_event_id,xp) values(p_session_id,owner_id,prompt,event_id,bonus);
    update public.profiles set total_xp = total_xp + bonus where id = owner_id;
  end if;
  return jsonb_build_object('xp',bonus,'eventId',event_id);
end;
$$;
revoke all on function public.save_quest_journey_event(uuid,jsonb) from public, anon;
grant execute on function public.save_quest_journey_event(uuid,jsonb) to authenticated;

-- Preserve the existing completion behavior and attach its exact session.
create or replace function public.complete_quest_v2(
  p_quest_id uuid,
  p_today date default current_date,
  p_logged boolean default true,
  p_reflection text default null,
  p_rating smallint default null,
  p_review text default null,
  p_review_public boolean default true,
  p_photo_urls text[] default '{}',
  p_session_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  quest record;
  active_session_id uuid;
  daily_used integer;
  previous_completions integer;
  awarded integer;
  new_completion_id uuid;
begin
  if current_user_id is null then raise exception 'Not authenticated'; end if;

  select session.id into active_session_id
  from public.quest_sessions as session
  where session.user_id = current_user_id
    and session.quest_id = p_quest_id
    and session.status in ('doing_now', 'in_progress')
    and (p_session_id is null or session.id = p_session_id)
  order by session.started_at desc
  limit 1
  for update;
  if active_session_id is null then raise exception 'ACTIVE_SESSION_NOT_FOUND'; end if;

  select * into quest from public.quests where id = p_quest_id;
  if quest.id is null then raise exception 'QUEST_NOT_FOUND'; end if;

  select count(*) into previous_completions from public.quest_completions
  where user_id = current_user_id and quest_id = p_quest_id;
  select count(*) into daily_used from public.quest_completions
  where user_id = current_user_id and completed_on = p_today;
  if public.daily_quest_limit_is_enabled() and daily_used >= 5 then raise exception 'DAILY_LIMIT_REACHED'; end if;
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then raise exception 'RATING_INVALID'; end if;

  awarded := case when previous_completions > 0 then round(quest.experience_points * 0.20)::integer
    when p_logged then quest.experience_points else floor(quest.experience_points / 2.0)::integer end;
  insert into public.quest_completions (user_id, quest_id, completed_on, reflection, xp_awarded, logged, rating, review_text, review_public, photo_urls)
  values (current_user_id, p_quest_id, p_today, nullif(trim(coalesce(p_reflection, '')), ''), awarded, p_logged, p_rating,
    case when p_logged then nullif(trim(coalesce(p_review, '')), '') else null end, p_review_public, coalesce(p_photo_urls, '{}'))
  returning id into new_completion_id;
  update public.quest_sessions set status = 'completed', ended_at = now(), completion_id = new_completion_id where id = active_session_id;
  return jsonb_build_object('completionId', new_completion_id, 'xpAwarded', awarded, 'dailyUsed', daily_used + 1,
    'dailyLimit', case when public.daily_quest_limit_is_enabled() then 5 else 0 end);
end;
$$;

