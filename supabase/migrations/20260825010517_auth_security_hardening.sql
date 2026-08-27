-- Never expose account existence, confirmation status, or usernames through a
-- callable public RPC. These functions were only used by the former sign-up
-- preflight and could be abused to enumerate users.
revoke all on function public.get_public_account_registration_state(text) from public, anon, authenticated;
revoke all on function public.is_username_available(text) from public, anon, authenticated;
