-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Earlier
-- allow-list migrations revoked that default at a point in time, but later
-- function definitions could still be exposed until explicitly revoked.
--
-- Iterate over every public function rather than relying on a static list, so
-- the committed baseline and existing shared environments both remove the
-- default grant. Explicit grants to anon/authenticated/service_role remain
-- intact; only implicit PUBLIC execution is removed.
do $$
declare
  function_signature text;
begin
  for function_signature in
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke all on function %s from public', function_signature);
  end loop;
end;
$$;
