-- Storage evaluates all applicable RLS predicates when signing journal media.
-- Restore the missing authenticated dependency without changing bucket privacy.
grant execute on function public.is_party_participant(uuid, uuid) to authenticated;
