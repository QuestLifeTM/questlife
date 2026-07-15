-- A single, user-owned in-app feed. Events are deduplicated by a stable key so
-- a trigger or engagement check can be safely retried without spamming people.
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('quest', 'progress', 'social', 'party', 'system')),
  kind text not null check (kind in (
    'daily_quest', 'active_quest_reminder', 'quest_completed', 'xp_earned',
    'streak_risk', 'streak_milestone', 'level_up', 'achievement',
    'reflection_reminder', 'journal_entry_ready', 'friend_request',
    'friend_accepted', 'quest_challenge', 'party_invite', 'party_completed',
    'admin_announcement', 'feature_notice', 'service_update'
  )),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 600),
  icon text not null,
  color text not null,
  metadata jsonb not null default '{}'::jsonb,
  delivery text not null default 'in_app' check (delivery in ('in_app', 'push_eligible')),
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists app_notifications_user_created_idx
on public.app_notifications (user_id, created_at desc);

create index if not exists app_notifications_user_unread_idx
on public.app_notifications (user_id, created_at desc)
where read_at is null;

alter table public.app_notifications enable row level security;
revoke all on public.app_notifications from anon, authenticated;
grant select on public.app_notifications to authenticated;
grant update (read_at) on public.app_notifications to authenticated;

drop policy if exists "Users can read their own app notifications" on public.app_notifications;
create policy "Users can read their own app notifications"
on public.app_notifications for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can mark their own app notifications read" on public.app_notifications;
create policy "Users can mark their own app notifications read"
on public.app_notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.create_app_notification(
  p_user_id uuid,
  p_category text,
  p_kind text,
  p_title text,
  p_body text,
  p_icon text,
  p_color text,
  p_dedupe_key text,
  p_metadata jsonb default '{}'::jsonb,
  p_delivery text default 'in_app'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_notifications (
    user_id, category, kind, title, body, icon, color, metadata, delivery, dedupe_key
  ) values (
    p_user_id, p_category, p_kind, p_title, p_body, p_icon, p_color,
    coalesce(p_metadata, '{}'::jsonb), p_delivery, p_dedupe_key
  ) on conflict (user_id, dedupe_key) do nothing;
end;
$$;

revoke all on function public.create_app_notification(uuid, text, text, text, text, text, text, text, jsonb, text) from public;

-- Cross-user notifications are emitted at the database boundary so recipients
-- receive them even if the sender is using another device.
create or replace function public.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_name text;
  recipient_name text;
begin
  select coalesce(nullif(display_name, ''), nullif(username, ''), 'A fellow adventurer')
  into sender_name
  from public.profiles
  where id = new.sender_id;

  select coalesce(nullif(display_name, ''), nullif(username, ''), 'Your new friend')
  into recipient_name
  from public.profiles
  where id = new.recipient_id;

  if tg_op = 'INSERT' then
    perform public.create_app_notification(
      new.recipient_id, 'social', 'friend_request', 'New friend request',
      coalesce(sender_name, 'A fellow adventurer') || ' wants to connect on QuestLife.',
      'person-add', '#FF4D9C', 'friend-request:' || new.id::text,
      jsonb_build_object('friendRequestId', new.id, 'senderId', new.sender_id), 'push_eligible'
    );
  elsif old.status = 'pending' and new.status = 'accepted' then
    perform public.create_app_notification(
      new.sender_id, 'social', 'friend_accepted', 'Friend request accepted',
      coalesce(recipient_name, 'Your new friend') || ' is now in your QuestLife circle.',
      'people', '#25A75D', 'friend-accepted:' || new.id::text,
      jsonb_build_object('friendRequestId', new.id, 'friendId', new.recipient_id), 'in_app'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists app_notifications_friend_requests on public.friend_requests;
create trigger app_notifications_friend_requests
after insert or update of status on public.friend_requests
for each row execute function public.notify_friend_request();

create or replace function public.notify_party_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare party_name text;
begin
  select name into party_name from public.parties where id = new.party_id;
  perform public.create_app_notification(
    new.recipient_id, 'party', 'party_invite', 'You were invited to a Party',
    coalesce(party_name, 'A QuestLife Party') || ' is waiting for you.',
    'people', '#00BBF9', 'party-invite:' || new.id::text,
    jsonb_build_object('partyId', new.party_id, 'partyInviteId', new.id), 'push_eligible'
  );
  return new;
end;
$$;

drop trigger if exists app_notifications_party_invites on public.party_invites;
create trigger app_notifications_party_invites
after insert on public.party_invites
for each row execute function public.notify_party_invite();

create or replace function public.notify_party_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'active' and new.status = 'ended' then
    insert into public.app_notifications (
      user_id, category, kind, title, body, icon, color, metadata, delivery, dedupe_key
    )
    select
      member.user_id,
      'party', 'party_completed', 'Party completed',
      new.name || ' has wrapped up. See how your crew did.',
      'trophy', '#C59212', jsonb_build_object('partyId', new.id), 'in_app',
      'party-completed:' || new.id::text
    from public.party_members member
    where member.party_id = new.id
    on conflict (user_id, dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists app_notifications_party_completed on public.parties;
create trigger app_notifications_party_completed
after update of status on public.parties
for each row execute function public.notify_party_completed();

create or replace function public.notify_quest_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quest_title text;
  streak_count integer;
  completion_count integer;
  level_number integer;
  total_xp integer;
begin
  select title into quest_title from public.quests where id = new.quest_id;

  perform public.create_app_notification(
    new.user_id, 'progress', 'xp_earned', 'XP earned',
    'You gained +' || coalesce(new.xp_awarded, 0)::text || ' XP from ' || coalesce(quest_title, 'your quest') || '.',
    'flash', '#FEE440', 'xp-earned:' || new.id::text,
    jsonb_build_object('questId', new.quest_id, 'completionId', new.id, 'xpAwarded', coalesce(new.xp_awarded, 0)), 'in_app'
  );

  if coalesce(new.logged, false) then
    perform public.create_app_notification(
      new.user_id, 'progress', 'journal_entry_ready', 'Your journal has a new entry',
      coalesce(quest_title, 'Your completed quest') || ' is ready to revisit in Journal.',
      'book', '#4DA8FF', 'journal-entry:' || new.id::text,
      jsonb_build_object('questId', new.quest_id, 'completionId', new.id), 'in_app'
    );
  end if;

  select current_streak into streak_count from public.user_streaks where user_id = new.user_id;
  if streak_count in (3, 7, 14, 30, 60, 100) then
    perform public.create_app_notification(
      new.user_id, 'progress', 'streak_milestone', 'Streak milestone reached',
      'Your ' || streak_count::text || '-day streak is still alive. Keep it going!',
      'flame', '#FF9D00', 'streak-milestone:' || streak_count::text,
      jsonb_build_object('streak', streak_count), 'in_app'
    );
  end if;

  select count(*) into completion_count from public.quest_completions where user_id = new.user_id;
  if completion_count in (1, 10, 25, 50, 100) then
    perform public.create_app_notification(
      new.user_id, 'progress', 'achievement', 'Achievement unlocked',
      'You have completed ' || completion_count::text || ' quests. Your explorer story is growing.',
      'ribbon', '#9C4DFF', 'achievement-completions:' || completion_count::text,
      jsonb_build_object('completionCount', completion_count), 'in_app'
    );
  end if;

  select total_xp into total_xp from public.profiles where id = new.user_id;
  level_number := floor(coalesce(total_xp, 0) / 500.0)::integer + 1;
  if total_xp is not null and total_xp >= 500 and mod(total_xp, 500) < coalesce(new.xp_awarded, 0) then
    perform public.create_app_notification(
      new.user_id, 'progress', 'level_up', 'Level up!',
      'You reached Level ' || level_number::text || '. Keep collecting real-world wins.',
      'trending-up', '#4DA8FF', 'level-up:' || level_number::text,
      jsonb_build_object('level', level_number), 'in_app'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists app_notifications_quest_completions on public.quest_completions;
create trigger app_notifications_quest_completions
after insert on public.quest_completions
for each row execute function public.notify_quest_completion();

alter table public.app_announcements
add column if not exists notification_kind text not null default 'admin_announcement'
check (notification_kind in ('admin_announcement', 'feature_notice', 'service_update'));

create or replace function public.notify_app_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active then
    insert into public.app_notifications (
      user_id, category, kind, title, body, icon, color, metadata, delivery, dedupe_key
    )
    select
      profile.id, 'system', new.notification_kind, new.title, new.body,
      case new.notification_kind when 'feature_notice' then 'sparkles' when 'service_update' then 'construct' else 'megaphone' end,
      case new.notification_kind when 'feature_notice' then '#4DA8FF' when 'service_update' then '#FF9C4D' else '#9C4DFF' end,
      jsonb_build_object('announcementId', new.id),
      case when new.notification_kind = 'service_update' then 'push_eligible' else 'in_app' end,
      'announcement:' || new.id::text
    from public.profiles profile
    on conflict (user_id, dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists app_notifications_announcements on public.app_announcements;
create trigger app_notifications_announcements
after insert on public.app_announcements
for each row execute function public.notify_app_announcement();

-- Runs from the signed-in app using the device's local date/hour. It creates
-- at most one notification per reminder key, so reopening the app is safe.
create or replace function public.ensure_engagement_notifications(
  p_local_date date,
  p_local_hour integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  suggestion record;
  active_session record;
  personal_streak record;
  slot text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_local_hour between 6 and 11 then slot := 'morning';
  elsif p_local_hour between 17 and 22 then slot := 'evening';
  end if;

  if slot is not null then
    select quest.id, quest.title into suggestion
    from public.quests quest
    left join public.quest_completions completion
      on completion.quest_id = quest.id and completion.created_at >= now() - interval '14 days'
    where quest.status = 'published'
      and not exists (
        select 1 from public.quest_completions mine
        where mine.user_id = current_user_id and mine.quest_id = quest.id
      )
    group by quest.id, quest.title
    order by count(completion.id) desc, bool_or(quest.featured) desc, max(quest.updated_at) desc
    limit 1;

    if suggestion.id is not null then
      perform public.create_app_notification(
        current_user_id, 'quest', 'daily_quest',
        case when slot = 'morning' then 'Your morning quest pick' else 'Your evening quest pick' end,
        'Try ' || suggestion.title || ' — it is trending with the QuestLife community.',
        'compass', '#4DA8FF', 'daily-quest:' || p_local_date::text || ':' || slot,
        jsonb_build_object('questId', suggestion.id, 'slot', slot), 'in_app'
      );
    end if;
  end if;

  select id, quest_id into active_session
  from public.quest_sessions
  where user_id = current_user_id and status = 'active' and started_at <= now() - interval '30 minutes'
  order by started_at desc limit 1;

  if active_session.id is not null then
    perform public.create_app_notification(
      current_user_id, 'quest', 'active_quest_reminder', 'Your quest is still in progress',
      'You started a quest more than 30 minutes ago. Finish it when you are ready.',
      'time', '#FF9C4D', 'active-quest-reminder:' || active_session.id::text,
      jsonb_build_object('questId', active_session.quest_id, 'sessionId', active_session.id), 'in_app'
    );
  end if;

  select current_streak, last_quest_on into personal_streak
  from public.user_streaks
  where user_id = current_user_id;

  if p_local_hour >= 18 and coalesce(personal_streak.current_streak, 0) > 0
    and personal_streak.last_quest_on is distinct from p_local_date then
    perform public.create_app_notification(
      current_user_id, 'progress', 'streak_risk', 'Keep your streak alive',
      'A small quest today protects your ' || personal_streak.current_streak::text || '-day streak.',
      'flame', '#FF9D00', 'streak-risk:' || p_local_date::text,
      jsonb_build_object('streak', personal_streak.current_streak), 'push_eligible'
    );
  end if;

  if p_local_hour >= 19
    and exists (select 1 from public.quest_completions where user_id = current_user_id and completed_on = p_local_date and coalesce(logged, false) = false) then
    perform public.create_app_notification(
      current_user_id, 'progress', 'reflection_reminder', 'Review your day',
      'Complete today''s pending reflections or add a note to your Journal.',
      'book', '#9C4DFF', 'reflection-reminder:' || p_local_date::text,
      jsonb_build_object('date', p_local_date), 'in_app'
    );
  end if;
end;
$$;

revoke all on function public.ensure_engagement_notifications(date, integer) from public;
grant execute on function public.ensure_engagement_notifications(date, integer) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_notifications'
  ) then
    alter publication supabase_realtime add table public.app_notifications;
  end if;
end;
$$;
