-- The public check remains revoked. Only the Edge Function's server role may
-- call this validated read-only helper on behalf of the onboarding flow.
grant execute on function public.is_username_available(text) to service_role;
