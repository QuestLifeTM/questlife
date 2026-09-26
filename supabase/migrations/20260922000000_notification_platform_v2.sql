-- Notification platform v2: the database is the source of truth for the
-- in-app feed, delivery preferences, devices, and push outbox.

delete from public.app_notifications where category = 'party' or kind in ('party_invite', 'party_completed');
delete from public.app_notifications where kind = 'reflection_reminder';
delete from public.app_notifications where kind = 'new_follower';
drop trigger if exists app_notifications_party_invites on public.party_invites;
drop trigger if exists app_notifications_party_completed on public.parties;
drop trigger if exists app_notifications_profile_follows on public.profile_follows;

alter table public.app_notifications
  add column if not exists priority text not null default 'normal' check (priority in ('normal', 'priority')),
  add column if not exists push_status text not null default 'not_requested' check (push_status in ('not_requested', 'queued', 'sent', 'failed', 'suppressed')),
  add column if not exists aggregation jsonb not null default '{}'::jsonb;
update public.app_notifications
set priority = case when delivery = 'push_eligible' then 'priority' else 'normal' end,
    push_status = case when delivery = 'push_eligible' then 'queued' else 'not_requested' end;
alter table public.app_notifications drop column if exists delivery;
alter table public.app_notifications drop constraint if exists app_notifications_category_check;
alter table public.app_notifications add constraint app_notifications_category_check check (category in ('quest', 'progress', 'social', 'system'));
alter table public.app_notifications drop constraint if exists app_notifications_kind_check;
alter table public.app_notifications add constraint app_notifications_kind_check check (kind in (
  'daily_quest','quest_sent','quest_reminder','quest_completed','journal_entry_ready',
  'xp_earned','streak_risk','streak_milestone','level_up','achievement',
  'friend_request','friend_accepted','post_like_digest','post_commented','comment_reply','mention','social_activity_digest',
  'admin_announcement','feature_notice','service_update','account_security','maintenance','account_action'
));

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  quest boolean not null default true,
  progress boolean not null default true,
  social boolean not null default true,
  product boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
create policy "Users manage their notification preferences" on public.notification_preferences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios','android')),
  permission_status text not null check (permission_status in ('granted','denied','undetermined')),
  timezone text not null default 'UTC',
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.notification_devices enable row level security;
revoke all on public.notification_devices from anon, authenticated;

create table if not exists public.notification_push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.app_notifications(id) on delete cascade,
  device_id uuid not null references public.notification_devices(id) on delete cascade,
  attempts integer not null default 0,
  expo_ticket_id text,
  status text not null default 'queued' check (status in ('queued','sent','failed','retry')),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  unique(notification_id, device_id)
);
alter table public.notification_push_outbox enable row level security;
revoke all on public.notification_push_outbox from anon, authenticated;
create index if not exists notification_push_outbox_pending_idx on public.notification_push_outbox(status, next_attempt_at);

create or replace function public.notification_preference_enabled(p_user_id uuid, p_category text, p_kind text)
returns boolean language sql security definer set search_path = '' stable as $$
  select case
    when p_kind in ('account_security','service_update','account_action') then true
    when p_category = 'quest' then coalesce((select quest from public.notification_preferences where user_id = p_user_id), true)
    when p_category = 'progress' then coalesce((select progress from public.notification_preferences where user_id = p_user_id), true)
    when p_category = 'social' then coalesce((select social from public.notification_preferences where user_id = p_user_id), true)
    else coalesce((select product from public.notification_preferences where user_id = p_user_id), true)
  end;
$$;

create or replace function public.create_notification_v2(
  p_user_id uuid, p_category text, p_kind text, p_title text, p_body text, p_icon text, p_color text,
  p_dedupe_key text, p_metadata jsonb default '{}'::jsonb, p_priority text default 'normal', p_push boolean default false,
  p_aggregation jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare notification_id uuid;
begin
  insert into public.notification_preferences(user_id) values (p_user_id) on conflict do nothing;
  insert into public.app_notifications(user_id,category,kind,title,body,icon,color,metadata,priority,push_status,dedupe_key,aggregation)
  values (p_user_id,p_category,p_kind,p_title,p_body,p_icon,p_color,coalesce(p_metadata,'{}'),p_priority,
    case when p_push and public.notification_preference_enabled(p_user_id,p_category,p_kind) then 'queued' when p_push then 'suppressed' else 'not_requested' end,
    p_dedupe_key,coalesce(p_aggregation,'{}'))
  on conflict (user_id,dedupe_key) do nothing returning id into notification_id;
  if notification_id is not null and p_push and public.notification_preference_enabled(p_user_id,p_category,p_kind) then
    insert into public.notification_push_outbox(notification_id, device_id)
    select notification_id, id from public.notification_devices where user_id=p_user_id and active and permission_status='granted'
    on conflict do nothing;
  end if;
  return notification_id;
end;
$$;

-- Compatibility shim for existing completion, friendship, and announcement
-- triggers. New code calls create_notification_v2 directly.
create or replace function public.create_app_notification(
  p_user_id uuid, p_category text, p_kind text, p_title text, p_body text, p_icon text, p_color text,
  p_dedupe_key text, p_metadata jsonb default '{}'::jsonb, p_delivery text default 'in_app'
) returns void language plpgsql security definer set search_path = '' as $$
declare next_kind text := case p_kind when 'quest_challenge' then 'quest_sent' when 'comment_reply_deleted' then 'account_action' else p_kind end;
begin
  perform public.create_notification_v2(p_user_id, case when p_category='party' then 'social' else p_category end, next_kind,
    p_title,p_body,p_icon,p_color,p_dedupe_key,p_metadata,
    case when p_delivery='push_eligible' then 'priority' else 'normal' end,p_delivery='push_eligible');
end;
$$;

create or replace function public.register_notification_device(p_token text, p_platform text, p_permission_status text, p_timezone text default 'UTC')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.notification_preferences(user_id) values (auth.uid()) on conflict do nothing;
  insert into public.notification_devices(user_id,expo_push_token,platform,permission_status,timezone,active,last_seen_at)
  values (auth.uid(),p_token,p_platform,p_permission_status,coalesce(nullif(p_timezone,''),'UTC'),true,now())
  on conflict (expo_push_token) do update set user_id=excluded.user_id, platform=excluded.platform,
    permission_status=excluded.permission_status, timezone=excluded.timezone, active=true, last_seen_at=now();
end;
$$;
create or replace function public.unregister_notification_device(p_token text)
returns void language sql security definer set search_path = '' as $$
  update public.notification_devices set active=false where user_id=auth.uid() and expo_push_token=p_token;
$$;
grant execute on function public.register_notification_device(text,text,text,text), public.unregister_notification_device(text) to authenticated;

-- Quest shares and challenges intentionally collapse into one priority event.
create or replace function public.notify_quest_sent() returns trigger language plpgsql security definer set search_path = '' as $$
declare sender text; quest_title text;
begin
  select coalesce(nullif(display_name,''), username, 'A friend') into sender from public.profiles where id=new.sender_id;
  select title into quest_title from public.quests where id=new.quest_id;
  perform public.create_notification_v2(new.recipient_id,'quest','quest_sent',coalesce(sender,'A friend') || ' sent you a Quest',coalesce(quest_title,'A new Quest is waiting for you.'),'paper-plane','#4DA8FF',
    'quest-sent:' || tg_table_name || ':' || new.id::text,jsonb_build_object('questId',new.quest_id,'senderId',new.sender_id,'source',tg_table_name),'priority',true);
  return new;
end; $$;
drop trigger if exists app_notification_quest_shares on public.quest_shares;
create trigger app_notification_quest_shares after insert on public.quest_shares for each row execute function public.notify_quest_sent();
drop trigger if exists app_notification_quest_challenges on public.quest_challenges;
create trigger app_notification_quest_challenges after insert on public.quest_challenges for each row execute function public.notify_quest_sent();

create or replace function public.notify_post_comment_v2() returns trigger language plpgsql security definer set search_path = '' as $$
declare post_owner uuid; actor text; parent_owner uuid;
begin
  select user_id into post_owner from public.quest_posts where id=new.post_id;
  select coalesce(nullif(display_name,''),username,'Someone') into actor from public.profiles where id=new.user_id;
  if post_owner is not null and post_owner <> new.user_id then
    perform public.create_notification_v2(post_owner,'social','post_commented',coalesce(actor,'Someone') || ' commented on your Quest experience',left(new.body,180),'chatbubble','#00BBF9','post-comment:'||new.id::text,jsonb_build_object('postId',new.post_id,'commentId',new.id),'priority',true);
  end if;
  if new.parent_id is not null then
    select user_id into parent_owner from public.quest_post_comments where id=new.parent_id;
    if parent_owner is not null and parent_owner <> new.user_id and parent_owner <> post_owner then
      perform public.create_notification_v2(parent_owner,'social','comment_reply',coalesce(actor,'Someone') || ' replied to your comment',left(new.body,180),'return-up-forward','#00BBF9','comment-reply:'||new.id::text,jsonb_build_object('postId',new.post_id,'commentId',new.id),'priority',true);
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists app_notification_post_comments on public.quest_post_comments;
create trigger app_notification_post_comments after insert on public.quest_post_comments for each row execute function public.notify_post_comment_v2();

create or replace function public.notify_post_like_digest_v2() returns trigger language plpgsql security definer set search_path = '' as $$
declare post_owner uuid; actor text; bucket text;
begin
  select user_id into post_owner from public.quest_posts where id=new.post_id;
  if post_owner is null or post_owner = new.user_id then return new; end if;
  select coalesce(nullif(display_name,''),username,'Someone') into actor from public.profiles where id=new.user_id;
  bucket := to_char(date_trunc('hour', now()) + (floor(extract(minute from now()) / 15)::int * interval '15 minutes'), 'YYYYMMDDHH24MI');
  perform public.create_notification_v2(post_owner,'social','post_like_digest',coalesce(actor,'Someone') || ' liked your Quest experience','See who is enjoying your story.','heart','#FF4D9C','post-like-digest:'||new.post_id::text||':'||bucket,jsonb_build_object('postId',new.post_id),'normal',false,jsonb_build_object('window',bucket));
  return new;
end; $$;
drop trigger if exists app_notification_post_likes on public.post_likes;
create trigger app_notification_post_likes after insert on public.post_likes for each row execute function public.notify_post_like_digest_v2();

-- Mentions are intentionally explicit @username tokens, are deduplicated per
-- comment, and never notify the author.
create or replace function public.notify_comment_mentions_v2() returns trigger language plpgsql security definer set search_path = '' as $$
declare mentioned record; actor text;
begin
  select coalesce(nullif(display_name,''),username,'Someone') into actor from public.profiles where id=new.user_id;
  for mentioned in select distinct p.id from public.profiles p where p.id <> new.user_id and lower(new.body) ~ ('(^|[^[:alnum:]_])@' || regexp_replace(lower(p.username), '([^[:alnum:]_])', '\\\1', 'g') || '([^[:alnum:]_]|$)') loop
    perform public.create_notification_v2(mentioned.id,'social','mention',coalesce(actor,'Someone') || ' mentioned you',left(new.body,180),'at','#9C4DFF','comment-mention:'||new.id::text||':'||mentioned.id::text,jsonb_build_object('postId',new.post_id,'commentId',new.id),'priority',true);
  end loop;
  return new;
end; $$;
drop trigger if exists app_notification_comment_mentions on public.quest_post_comments;
create trigger app_notification_comment_mentions after insert on public.quest_post_comments for each row execute function public.notify_comment_mentions_v2();

create or replace function public.notify_post_mentions_v2() returns trigger language plpgsql security definer set search_path = '' as $$
declare mentioned record; actor text;
begin
  if nullif(trim(coalesce(new.caption,'')),'') is null then return new; end if;
  select coalesce(nullif(display_name,''),username,'Someone') into actor from public.profiles where id=new.user_id;
  for mentioned in select distinct p.id from public.profiles p where p.id <> new.user_id and lower(new.caption) ~ ('(^|[^[:alnum:]_])@' || regexp_replace(lower(p.username), '([^[:alnum:]_])', '\\\1', 'g') || '([^[:alnum:]_]|$)') loop
    perform public.create_notification_v2(mentioned.id,'social','mention',coalesce(actor,'Someone') || ' mentioned you',left(new.caption,180),'at','#9C4DFF','post-mention:'||new.id::text||':'||mentioned.id::text,jsonb_build_object('postId',new.id),'priority',true);
  end loop;
  return new;
end; $$;
drop trigger if exists app_notification_post_mentions on public.quest_posts;
create trigger app_notification_post_mentions after insert on public.quest_posts for each row execute function public.notify_post_mentions_v2();

-- Run this function from a protected hourly Supabase Edge Function / Cron job.
create or replace function public.run_notification_schedule(p_now timestamptz default now()) returns void language plpgsql security definer set search_path = '' as $$
declare member record; local_hour integer; local_day date; suggestion record;
begin
  -- Time-sensitive reminders leave quickly; direct social activity gets a
  -- longer window. Milestones, completions, and system history are permanent.
  delete from public.app_notifications
  where kind in ('daily_quest','quest_reminder','journal_entry_ready','xp_earned','streak_risk')
    and created_at < p_now - interval '7 days';
  delete from public.app_notifications
  where kind in ('quest_sent','friend_request','friend_accepted','post_like_digest','post_commented','comment_reply','mention','social_activity_digest')
    and created_at < p_now - interval '20 days';

  for member in select profile.id, coalesce(device.timezone,'UTC') timezone from public.profiles profile left join lateral (select timezone from public.notification_devices where user_id=profile.id and active order by last_seen_at desc limit 1) device on true loop
    local_hour := extract(hour from p_now at time zone member.timezone); local_day := (p_now at time zone member.timezone)::date;
    if local_hour = 9 then
      select id,title into suggestion from public.quests where status='published' order by featured desc, updated_at desc limit 1;
      if suggestion.id is not null then perform public.create_notification_v2(member.id,'quest','daily_quest','Today''s Quest 🌎',suggestion.title,'compass','#4DA8FF','daily-quest:'||local_day::text,jsonb_build_object('questId',suggestion.id),'normal',true); end if;
    end if;
    if local_hour = 19 and exists(select 1 from public.user_streaks s where s.user_id=member.id and s.current_streak>0 and s.last_quest_on is distinct from local_day) then
      perform public.create_notification_v2(member.id,'progress','streak_risk','Keep your streak going 🔥','Complete a Quest today to keep your streak alive.','flame','#FF9D00','streak-risk:'||local_day::text,'{}','priority',true);
    end if;
    if local_hour = 17 then
      for suggestion in select id, quest_id from public.quest_sessions where user_id=member.id and status='active' and started_at <= p_now - interval '2 hours' loop
        perform public.create_notification_v2(member.id,'quest','quest_reminder','Your Quest is still waiting','Finish your Quest when you are ready.','time','#FF9C4D','quest-reminder:'||suggestion.id::text,jsonb_build_object('questId',suggestion.quest_id,'sessionId',suggestion.id),'normal',true);
      end loop;
    end if;
  end loop;
end; $$;
revoke all on function public.run_notification_schedule(timestamptz) from public, anon, authenticated;
revoke all on function public.create_notification_v2(uuid,text,text,text,text,text,text,text,jsonb,text,boolean,jsonb) from public, anon, authenticated;
revoke all on function public.notification_preference_enabled(uuid,text,text) from public, anon, authenticated;

-- Superseded by run_notification_schedule. Older mobile clients may still
-- call this RPC, so make it safe and ensure it cannot recreate reflections.
create or replace function public.ensure_engagement_notifications(p_local_date date, p_local_hour integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.app_notifications where kind = 'reflection_reminder';
end;
$$;

create or replace function public.notify_quest_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare quest_title text; streak_count integer; completion_count integer; profile_total_xp integer; level_number integer;
begin
  select title into quest_title from public.quests where id=new.quest_id;
  perform public.create_notification_v2(new.user_id,'quest','quest_completed','Quest completed','You completed ' || coalesce(quest_title,'your Quest') || '.','checkmark-circle','#25A75D','quest-completed:'||new.id::text,jsonb_build_object('questId',new.quest_id,'completionId',new.id),'normal',false);
  perform public.create_notification_v2(new.user_id,'progress','xp_earned','XP earned','You gained +'||coalesce(new.xp_awarded,0)::text||' XP from '||coalesce(quest_title,'your Quest')||'.','flash','#FEE440','xp-earned:'||new.id::text,jsonb_build_object('questId',new.quest_id,'completionId',new.id,'xpAwarded',coalesce(new.xp_awarded,0)),'normal',false);
  if coalesce(new.logged,false) then perform public.create_notification_v2(new.user_id,'quest','journal_entry_ready','Your journal has a new entry',coalesce(quest_title,'Your completed Quest')||' is ready to revisit in Journal.','book','#4DA8FF','journal-entry:'||new.id::text,jsonb_build_object('questId',new.quest_id,'completionId',new.id),'normal',false); end if;
  select current_streak into streak_count from public.user_streaks where user_id=new.user_id;
  if streak_count in (3,7,14,30,60,100) then perform public.create_notification_v2(new.user_id,'progress','streak_milestone','Streak milestone reached','Your '||streak_count::text||'-day streak is still alive. Keep it going!','flame','#FF9D00','streak-milestone:'||streak_count::text,jsonb_build_object('streak',streak_count),'normal',true); end if;
  select count(*) into completion_count from public.quest_completions where user_id=new.user_id;
  if completion_count in (1,10,25,50,100) then perform public.create_notification_v2(new.user_id,'progress','achievement','Achievement unlocked','You have completed '||completion_count::text||' Quests. Your explorer story is growing.','ribbon','#9C4DFF','achievement-completions:'||completion_count::text,jsonb_build_object('completionCount',completion_count),'normal',true); end if;
  select total_xp into profile_total_xp from public.profiles where id=new.user_id; level_number:=floor(coalesce(profile_total_xp,0)/500.0)::integer+1;
  if profile_total_xp is not null and profile_total_xp>=500 and mod(profile_total_xp,500)<coalesce(new.xp_awarded,0) then perform public.create_notification_v2(new.user_id,'progress','level_up','Level up!','You reached Level '||level_number::text||'. Keep collecting real-world wins.','trending-up','#4DA8FF','level-up:'||level_number::text,jsonb_build_object('level',level_number),'normal',false); end if;
  return new;
exception when others then raise warning 'Quest completion notification was skipped: %', sqlerrm; return new;
end; $$;
