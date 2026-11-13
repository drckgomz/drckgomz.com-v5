-- Narrow correction for the already-created local Phase 6 helper-owner role.
BEGIN;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '3s';
DO $phase6_target$
BEGIN
  IF current_database() <> 'drckgomz_phase5_test'
     OR current_user <> 'phase5_local'
     OR current_setting('server_version_num')::integer / 10000 <> 18
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
  THEN RAISE EXCEPTION 'Phase 6 local target identity mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='drckgomz_local_functions' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolinherit AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='app_private')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
       JOIN pg_catalog.pg_roles r ON r.oid=p.proowner WHERE n.nspname='app_private' AND p.proname='current_active_user' AND r.rolname='drckgomz_local_functions')
  THEN RAISE EXCEPTION 'Phase 6 helper-owner schema state mismatch'; END IF;
END
$phase6_target$;
GRANT USAGE ON SCHEMA app_private TO drckgomz_local_functions;
COMMIT;
