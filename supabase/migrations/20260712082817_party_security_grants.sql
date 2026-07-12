-- Explicitly revoke from anon as well as PUBLIC. Some older project-wide grants
-- predate these Party RPCs, so this keeps the new SECURITY DEFINER surface signed-in only.
revoke execute on function public.create_party_v3(text, text, text, smallint, boolean, text, text, text, text, text[], uuid[]) from anon;
revoke execute on function public.update_party_v3(uuid, text, text, text, smallint, boolean, text, text, text, text, text[]) from anon;
revoke execute on function public.complete_party_quest_v2(uuid, uuid, date, text, text[], boolean, text, text[]) from anon;
revoke execute on function public.mark_party_notifications_read(uuid, text) from anon;
revoke execute on function public.set_party_quests_enabled(uuid, boolean) from anon;
revoke execute on function public.start_party_quest(uuid, uuid) from anon;
revoke execute on function public.get_party_detail(uuid) from anon;
revoke execute on function public.get_party_journal_history() from anon;
revoke execute on function public.party_summary(uuid, uuid) from anon;
revoke execute on function public.notify_party_completion() from public, anon, authenticated;

grant execute on function public.create_party_v3(text, text, text, smallint, boolean, text, text, text, text, text[], uuid[]) to authenticated;
grant execute on function public.update_party_v3(uuid, text, text, text, smallint, boolean, text, text, text, text, text[]) to authenticated;
grant execute on function public.complete_party_quest_v2(uuid, uuid, date, text, text[], boolean, text, text[]) to authenticated;
grant execute on function public.mark_party_notifications_read(uuid, text) to authenticated;
grant execute on function public.set_party_quests_enabled(uuid, boolean) to authenticated;
grant execute on function public.start_party_quest(uuid, uuid) to authenticated;
grant execute on function public.get_party_detail(uuid) to authenticated;
grant execute on function public.get_party_journal_history() to authenticated;
