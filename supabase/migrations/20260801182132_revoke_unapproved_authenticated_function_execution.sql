-- Earlier migrations granted some implementation helpers directly to the
-- authenticated role. Revoke that legacy access, then restore only the RPCs
-- invoked by current App/Admin code.

revoke execute on all functions in schema public from authenticated;

do $$
declare
  allowed_function_names text[] := array[
    'abandon_party_quest_session', 'abandon_quest_session', 'accept_admin_invite',
    'add_party_quests', 'add_quest_post_comment', 'cancel_duo_streak_invite',
    'cancel_friend_request', 'complete_party_quest_v2', 'complete_quest_v2',
    'create_party_v3', 'delete_quest_post_comment', 'dismiss_app_announcement',
    'dismiss_party_briefing', 'end_duo_streak', 'end_party_round', 'end_party_v2',
    'ensure_engagement_notifications', 'find_profiles_by_contact_emails',
    'follow_profile', 'get_active_app_announcement', 'get_admin_login_state',
    'get_daily_quest_limit_enabled', 'get_friend_profile', 'get_friend_suggestions',
    'get_intro_enabled', 'get_party_detail', 'get_party_detail_live',
    'get_party_hub', 'get_party_journal_history', 'get_profile_followers',
    'get_profile_overview', 'get_public_account_registration_state',
    'get_quest_engine_state', 'get_quest_post_comments', 'get_quest_reviews',
    'get_quest_social_feed', 'get_social_overview', 'get_streak_overview',
    'invite_to_party', 'is_username_available', 'join_party_by_code', 'leave_party',
    'list_admin_accounts', 'mark_party_notifications_read',
    'publish_app_announcement', 'react_to_party_post', 'record_admin_login',
    'record_admin_logout', 'remove_friend', 'remove_profile_follower',
    'reset_todays_solo_quest_completions', 'respond_duo_streak_invite',
    'respond_friend_request', 'respond_party_invite', 'respond_quest_challenge',
    'restore_streak', 'save_quest_session_for_later', 'search_profiles',
    'send_duo_streak_invite', 'send_duo_streak_nudge', 'send_friend_request',
    'send_quest_challenge', 'set_daily_quest_limit_enabled', 'set_intro_enabled',
    'set_party_quests', 'set_party_quests_enabled', 'share_quest',
    'start_party_quest', 'start_quest_session', 'suggest_party_quests',
    'unfollow_profile', 'update_party_v3'
  ];
  function_signature text;
begin
  for function_signature in
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(allowed_function_names)
  loop
    execute format('grant execute on function %s to authenticated', function_signature);
  end loop;
end;
$$;
