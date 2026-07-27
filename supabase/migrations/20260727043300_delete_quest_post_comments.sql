-- Deleting a parent comment cascades to its replies. Notify every affected
-- reply author before the cascade so their removal is never silent.
alter table public.app_notifications
  drop constraint if exists app_notifications_kind_check;

alter table public.app_notifications
  add constraint app_notifications_kind_check check (kind in (
    'daily_quest', 'active_quest_reminder', 'quest_completed', 'xp_earned',
    'streak_risk', 'streak_milestone', 'level_up', 'achievement',
    'reflection_reminder', 'journal_entry_ready', 'friend_request',
    'friend_accepted', 'comment_reply_deleted', 'quest_challenge',
    'party_invite', 'party_completed', 'admin_announcement',
    'feature_notice', 'service_update'
  ));

create or replace function public.delete_quest_post_comment(p_comment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_comment public.quest_post_comments%rowtype;
  reply_record record;
  deleting_user_name text;
  deleted_reply_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into target_comment
  from public.quest_post_comments
  where id = p_comment_id
  for update;

  if not found then
    raise exception 'Comment not found';
  end if;

  if target_comment.user_id <> current_user_id then
    raise exception 'You can only delete your own comments';
  end if;

  select coalesce(nullif(display_name, ''), nullif(username, ''), 'A QuestLife member')
  into deleting_user_name
  from public.profiles
  where id = current_user_id;

  -- The recursive query covers any historical nested reply chains as well as
  -- the single-level replies created by the current app UI.
  for reply_record in
    with recursive replies as (
      select id, parent_id, user_id
      from public.quest_post_comments
      where parent_id = target_comment.id
      union all
      select comment.id, comment.parent_id, comment.user_id
      from public.quest_post_comments comment
      join replies on comment.parent_id = replies.id
    )
    select id, parent_id, user_id from replies
  loop
    deleted_reply_count := deleted_reply_count + 1;
    if reply_record.user_id <> current_user_id then
      perform public.create_app_notification(
        reply_record.user_id,
        'social',
        'comment_reply_deleted',
        'Reply removed',
        coalesce(deleting_user_name, 'A QuestLife member') || ' deleted the comment your reply was attached to.',
        'chatbubble-ellipses-outline',
        '#FF6B9A',
        'comment-reply-deleted:' || reply_record.id::text,
        jsonb_build_object(
          'postId', target_comment.post_id,
          'parentCommentId', target_comment.id,
          'replyCommentId', reply_record.id,
          'deletedByUserId', current_user_id
        ),
        'push_eligible'
      );
    end if;
  end loop;

  delete from public.quest_post_comments
  where id = target_comment.id;

  return jsonb_build_object(
    'id', target_comment.id,
    'deletedReplyCount', deleted_reply_count
  );
end;
$$;

revoke all on function public.delete_quest_post_comment(uuid) from public, anon;
grant execute on function public.delete_quest_post_comment(uuid) to authenticated;
