-- Party RLS policies and social refreshes evaluate this security-definer
-- predicate as the authenticated role. Grant only its execute permission.
grant execute on function public.is_party_member(uuid, uuid) to authenticated;
