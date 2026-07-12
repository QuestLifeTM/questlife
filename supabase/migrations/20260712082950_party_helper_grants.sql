-- party_summary is an internal helper used by signed-in Party RPCs; it must not
-- be callable through the public REST RPC surface.
revoke execute on function public.party_summary(uuid, uuid) from public, anon, authenticated;
