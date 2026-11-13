-- REVIEW ONLY. NOT PART OF DRIZZLE JOURNAL. DO NOT EXECUTE until the exact
-- source/target identity mapping and this SQL are separately approved.
-- Local-only guard: disposable PG18 database, loopback port 55441.
-- This installs a narrowly scoped function/grants; it does not transfer a role.
-- It is not a production/Neon migration and does not touch post/media rows.

BEGIN;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '3s';

DO $preflight$
BEGIN
  IF current_database() <> 'drckgomz_phase5_test'
     OR current_setting('server_version_num')::integer / 10000 <> 18
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
     OR inet_server_port() IS DISTINCT FROM 55441
  THEN RAISE EXCEPTION 'Pinned local database identity mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='drckgomz_local_owner' AND rolcanlogin AND NOT rolsuper AND NOT rolinherit AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='drckgomz_local_functions' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolinherit AND NOT rolbypassrls)
  THEN RAISE EXCEPTION 'Expected least-privilege local roles missing'; END IF;
  IF (SELECT count(*) FROM app.user_roles WHERE role='owner') <> 1
  THEN RAISE EXCEPTION 'Expected exactly one existing owner assignment'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='app' AND c.relname IN ('user_roles','security_audit_events')
      AND (c.relrowsecurity OR c.relforcerowsecurity)
  ) THEN RAISE EXCEPTION 'Role/audit RLS state requires separate review'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='legacy' AND c.relname='users' AND (c.relrowsecurity OR c.relforcerowsecurity)
  ) THEN RAISE EXCEPTION 'Legacy identity RLS state requires separate review'; END IF;
  IF has_table_privilege('drckgomz_local_owner','app.user_roles','INSERT')
     OR has_table_privilege('drckgomz_local_owner','app.user_roles','UPDATE')
     OR has_table_privilege('drckgomz_local_owner','app.user_roles','DELETE')
     OR has_any_column_privilege('drckgomz_local_owner','app.user_roles','UPDATE')
     OR has_table_privilege('drckgomz_local_owner','app.security_audit_events','INSERT')
     OR has_table_privilege('drckgomz_local_owner','app.security_audit_events','UPDATE')
     OR has_table_privilege('drckgomz_local_owner','app.security_audit_events','DELETE')
  THEN RAISE EXCEPTION 'Owner LOGIN role has unexpected direct mutation privileges'; END IF;
  -- This function locks the selected auth/profile rows. PostgreSQL requires
  -- UPDATE on at least one column of each row-locked table. These narrow
  -- column grants are established by the separately reviewed local profile
  -- setup; do not widen them to table-level UPDATE.
  IF NOT has_any_column_privilege('drckgomz_local_functions','auth."user"','UPDATE')
     OR NOT has_any_column_privilege('drckgomz_local_functions','app.user_profiles','UPDATE')
  THEN RAISE EXCEPTION 'Required narrow row-lock privileges are missing'; END IF;
END
$preflight$;

-- These narrowly scoped privileges belong to the NOLOGIN function owner only.
-- The owner LOGIN role receives no table-level or column-level mutation rights.
GRANT USAGE ON SCHEMA app, auth, legacy, app_private TO drckgomz_local_functions;
-- Required only while changing function owner, then removed before commit.
GRANT CREATE ON SCHEMA app_private TO drckgomz_local_functions;
GRANT SELECT (id, email) ON TABLE legacy.users TO drckgomz_local_functions;
GRANT UPDATE (user_id, granted_by, granted_at) ON TABLE app.user_roles TO drckgomz_local_functions;
GRANT INSERT (actor_user_id, subject_user_id, action, evidence_ref)
  ON TABLE app.security_audit_events TO drckgomz_local_functions;

CREATE FUNCTION app_private.transfer_owner_from_legacy(
  p_target_user_id pg_catalog.text,
  p_legacy_user_id pg_catalog.int4,
  p_mapping_confirmed pg_catalog.bool
)
RETURNS pg_catalog.text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor_user_id pg_catalog.text;
  v_target_email pg_catalog.text;
  v_source_email pg_catalog.text;
  v_legacy_matches pg_catalog.int8;
  v_auth_matches pg_catalog.int8;
  v_updated pg_catalog.int4;
BEGIN
  IF p_target_user_id IS NULL OR pg_catalog.length(p_target_user_id) = 0
     OR pg_catalog.length(p_target_user_id) > 200 OR p_legacy_user_id IS NULL
  THEN RETURN 'invalid-target'; END IF;
  IF p_mapping_confirmed IS DISTINCT FROM true THEN RETURN 'mapping-not-confirmed'; END IF;

  -- Serialize every transfer and recheck live DB-backed owner authorization.
  PERFORM pg_catalog.pg_advisory_xact_lock(1651279904, 2);
  v_actor_user_id := app_private.current_owner_id();
  IF v_actor_user_id IS NULL THEN RETURN 'forbidden'; END IF;
  IF v_actor_user_id = p_target_user_id THEN RETURN 'same-account'; END IF;

  -- current_owner_id() validates the transaction-local session-token digest
  -- against an unexpired Better Auth session and checks the live owner role,
  -- verified email, enabled profile, and block state. Avoid querying or
  -- locking auth.session here: the function owner intentionally has no direct
  -- session privileges, and PostgreSQL row locks require UPDATE privilege.
  IF app_private.current_owner_id() IS DISTINCT FROM v_actor_user_id THEN
    RETURN 'forbidden';
  END IF;

  PERFORM actor.id
  FROM auth."user" AS actor
  JOIN app.user_profiles AS profile ON profile.id=actor.id
  JOIN app.user_roles AS role_row ON role_row.user_id=actor.id AND role_row.role='owner'
  WHERE actor.id=v_actor_user_id
    AND actor.email_verified IS TRUE
    AND profile.enabled IS TRUE AND profile.banned_at IS NULL
  FOR UPDATE OF actor, profile, role_row;
  IF NOT FOUND THEN RETURN 'forbidden'; END IF;

  SELECT identity.email INTO v_target_email
  FROM auth."user" AS identity
  JOIN app.user_profiles AS profile ON profile.id=identity.id
  WHERE identity.id=p_target_user_id
    AND identity.email_verified IS TRUE
    AND profile.enabled IS TRUE AND profile.banned_at IS NULL
  FOR UPDATE OF identity, profile;
  IF NOT FOUND THEN RETURN 'target-ineligible'; END IF;

  -- Match the exact selected legacy row and require it to be unique by email.
  -- The legacy is_admin flag is deliberately never consulted for authorization.
  SELECT legacy_row.email INTO v_source_email
  FROM legacy.users AS legacy_row
  WHERE legacy_row.id=p_legacy_user_id;
  IF NOT FOUND OR v_source_email IS NULL OR pg_catalog.btrim(v_source_email) = '' THEN
    RETURN 'legacy-source-missing';
  END IF;
  SELECT pg_catalog.count(*) INTO v_legacy_matches
  FROM legacy.users AS legacy_row
  WHERE pg_catalog.lower(pg_catalog.btrim(legacy_row.email)) = pg_catalog.lower(pg_catalog.btrim(v_source_email));
  SELECT pg_catalog.count(*) INTO v_auth_matches
  FROM auth."user" AS identity
  WHERE pg_catalog.lower(pg_catalog.btrim(identity.email)) = pg_catalog.lower(pg_catalog.btrim(v_source_email));
  IF v_legacy_matches <> 1 OR v_auth_matches <> 1
     OR pg_catalog.lower(pg_catalog.btrim(v_target_email)) <> pg_catalog.lower(pg_catalog.btrim(v_source_email))
  THEN RETURN 'identity-mapping-mismatch'; END IF;

  -- Move the existing singleton role row; never insert a second owner or alter
  -- either auth account. The partial unique index remains an invariant guard.
  UPDATE app.user_roles
  SET user_id=p_target_user_id, granted_by=v_actor_user_id, granted_at=pg_catalog.statement_timestamp()
  WHERE user_id=v_actor_user_id AND role='owner';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN RAISE EXCEPTION 'Owner row changed during transfer'; END IF;

  -- If this audit insert fails, PostgreSQL aborts the function statement and
  -- rolls back the role-row update in the same transaction.
  INSERT INTO app.security_audit_events(actor_user_id, subject_user_id, action, evidence_ref)
  VALUES (v_actor_user_id, p_target_user_id, 'owner_role_transferred',
    'legacy.users:' || p_legacy_user_id::pg_catalog.text);
  RETURN 'transferred';
END
$function$;

ALTER FUNCTION app_private.transfer_owner_from_legacy(pg_catalog.text, pg_catalog.int4, pg_catalog.bool)
  OWNER TO drckgomz_local_functions;
REVOKE ALL ON FUNCTION app_private.transfer_owner_from_legacy(pg_catalog.text, pg_catalog.int4, pg_catalog.bool) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.transfer_owner_from_legacy(pg_catalog.text, pg_catalog.int4, pg_catalog.bool)
  TO drckgomz_local_owner;
REVOKE CREATE ON SCHEMA app_private FROM drckgomz_local_functions;

COMMIT;
