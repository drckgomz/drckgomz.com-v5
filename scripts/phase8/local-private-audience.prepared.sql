-- PREPARED ONLY: additive local audience functions; not part of the Drizzle ledger.
-- No owner transfers, raw password/token reads, or historical content changes.
-- Run the read-only preflight first. Runtime receives EXECUTE only.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='5s';
DO $preconditions$
BEGIN
  IF current_database() <> 'drckgomz_phase5_test' OR current_user <> 'phase5_local'
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR inet_server_port() <> 55441
     OR current_setting('server_version_num')::integer / 10000 <> 18
  THEN RAISE EXCEPTION 'Unapproved local database target'; END IF;
  IF (SELECT array_agg(hash::text ORDER BY created_at) FROM drizzle.__drizzle_migrations)
      IS DISTINCT FROM ARRAY['201022ebf1346f754df936a2139075c63abde28eea6be065d24214f6a8e331bc', '0ae7871fc214b53788fbfb0ef6081eb2cd89fc20ff5e2d7ef93f7a6f1dc15bbc', '582506469c83811bd9c00f313a9d23f64441234953b53efdf248549fb128f0be', '42d90a2e9812f63638359a109a064878bfa1c06444c08c5acbca19698cb9f47f', 'ef5ed1cd7b1acea20a0a25efb664cf1b1119ce141259b0ede082aa15f24c0377', '966d65b038eddfd1f12ceb47e17140e2c4252b848174429e218387070b6dbe14']::text[]
  THEN RAISE EXCEPTION 'Migration ledger does not match six reviewed migrations'; END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('drckgomz_local_functions','drckgomz_local_owner')
    AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreatedb AND NOT rolcreaterole
    AND NOT rolreplication AND rolcanlogin=(rolname='drckgomz_local_owner')) <> 2
  THEN RAISE EXCEPTION 'Local role preconditions failed'; END IF;
  IF pg_catalog.to_regprocedure('app_private.current_owner_id()') IS NULL
     OR pg_catalog.to_regprocedure('app_private.phase8_assert_active_owner(text)') IS NOT NULL
     OR pg_catalog.to_regprocedure('app_private.list_private_audience_users(text,integer,integer)') IS NOT NULL
     OR pg_catalog.to_regprocedure('app_private.set_private_journal_access(text,text,boolean)') IS NOT NULL
  THEN RAISE EXCEPTION 'Unexpected existing function state'; END IF;
  IF (SELECT count(*) FROM app.user_roles WHERE role='owner') <> 1
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname='app' AND indexname='app_user_roles_single_owner_uq')
  THEN RAISE EXCEPTION 'Single owner precondition failed'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid IN
    ('app.user_profiles'::regclass,'app.user_roles'::regclass,'app.user_capabilities'::regclass,'app.security_audit_events'::regclass,'auth.session'::regclass,'auth.user'::regclass)
    AND (relrowsecurity OR relforcerowsecurity))
  THEN RAISE EXCEPTION 'Unexpected RLS state; review policies instead of bypassing RLS'; END IF;
END
$preconditions$;

-- Only the existing NOLOGIN function owner receives narrowly scoped table rights.
GRANT USAGE ON SCHEMA app, auth, app_private TO drckgomz_local_functions;
GRANT CREATE ON SCHEMA app_private TO drckgomz_local_functions;
GRANT SELECT (id, user_id, token_sha256, expires_at) ON auth.session TO drckgomz_local_functions;
GRANT SELECT (id, email, name, email_verified, created_at) ON auth."user" TO drckgomz_local_functions;
GRANT SELECT (id, username, first_name, last_name, enabled, banned_at) ON app.user_profiles TO drckgomz_local_functions;
GRANT SELECT (user_id, role) ON app.user_roles TO drckgomz_local_functions;
GRANT SELECT (user_id, capability) ON app.user_capabilities TO drckgomz_local_functions;
-- Row locks require UPDATE privilege on at least one column of each locked table.
GRANT UPDATE (updated_at) ON auth.session, auth."user", app.user_profiles TO drckgomz_local_functions;
GRANT UPDATE (granted_at) ON app.user_roles TO drckgomz_local_functions;
GRANT INSERT (user_id, capability, granted_by), DELETE ON app.user_capabilities TO drckgomz_local_functions;
GRANT INSERT (actor_user_id, subject_user_id, action) ON app.security_audit_events TO drckgomz_local_functions;

CREATE FUNCTION app_private.phase8_assert_active_owner(p_token_sha256_hex pg_catalog.text)
RETURNS pg_catalog.text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT active_user.id
  FROM auth.session AS session_row
  JOIN auth."user" AS active_user ON active_user.id = session_row.user_id
  JOIN app.user_profiles AS profile ON profile.id = active_user.id
  JOIN app.user_roles AS role_row ON role_row.user_id = active_user.id AND role_row.role = 'owner'
  WHERE p_token_sha256_hex IS NOT NULL
    AND p_token_sha256_hex ~ '^[A-Fa-f0-9]{64}$'
    AND session_row.token_sha256 = pg_catalog.lower(p_token_sha256_hex)
    AND session_row.expires_at > pg_catalog.statement_timestamp()
    AND active_user.email_verified IS TRUE
    AND profile.enabled IS TRUE
    AND profile.banned_at IS NULL
  LIMIT 1
$function$;
ALTER FUNCTION app_private.phase8_assert_active_owner(pg_catalog.text) OWNER TO drckgomz_local_functions;

CREATE FUNCTION app_private.list_private_audience_users(
  p_token_sha256_hex pg_catalog.text, p_limit pg_catalog.integer, p_offset pg_catalog.integer
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_total pg_catalog.int8;
  v_users pg_catalog.jsonb;
BEGIN
  IF app_private.phase8_assert_active_owner(p_token_sha256_hex) IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('forbidden', true, 'total', 0, 'users', '[]'::pg_catalog.jsonb);
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 OR p_offset IS NULL OR p_offset < 0 OR p_offset > 1000000 THEN
    RAISE EXCEPTION 'Invalid pagination' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_total FROM auth."user";
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', page.id,
    'email', page.email,
    'username', COALESCE(page.username, 'unprovisioned-' || page.id),
    'name', COALESCE(NULLIF(pg_catalog.btrim(pg_catalog.concat_ws(' ', page.first_name, page.last_name)), ''), page.auth_name),
    'provisioned', page.profile_id IS NOT NULL,
    'emailVerified', page.email_verified,
    'enabled', COALESCE(page.enabled, false),
    'banned', page.banned_at IS NOT NULL,
    'isOwner', page.is_owner,
    'hasAdminAccess', page.is_admin,
    'canViewPrivate', page.can_view_private,
    'createdAt', page.created_at
  ) ORDER BY page.created_at DESC, page.id DESC), '[]'::pg_catalog.jsonb)
    INTO v_users
  FROM (
    SELECT identity.id, identity.email, identity.name AS auth_name,
      identity.email_verified, identity.created_at,
      profile.id AS profile_id, profile.username, profile.first_name, profile.last_name,
      profile.enabled, profile.banned_at,
      EXISTS (SELECT 1 FROM app.user_roles r WHERE r.user_id=identity.id AND r.role='owner') AS is_owner,
      EXISTS (SELECT 1 FROM app.user_roles r WHERE r.user_id=identity.id AND r.role IN ('owner','content_admin')) AS is_admin,
      EXISTS (SELECT 1 FROM app.user_capabilities c WHERE c.user_id=identity.id AND c.capability='private_blog.read') AS can_view_private
    FROM auth."user" AS identity
    LEFT JOIN app.user_profiles AS profile ON profile.id=identity.id
    ORDER BY identity.created_at DESC, identity.id DESC
    LIMIT p_limit OFFSET p_offset
  ) AS page;
  RETURN pg_catalog.jsonb_build_object('forbidden', false, 'total', v_total, 'users', v_users);
END
$function$;
ALTER FUNCTION app_private.list_private_audience_users(pg_catalog.text, pg_catalog.integer, pg_catalog.integer) OWNER TO drckgomz_local_functions;

CREATE FUNCTION app_private.set_private_journal_access(
  p_token_sha256_hex pg_catalog.text, p_target_user_id pg_catalog.text, p_grant pg_catalog.boolean
)
RETURNS pg_catalog.text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_actor_user_id pg_catalog.text;
  v_target_enabled pg_catalog.boolean;
  v_target_banned_at pg_catalog.timestamptz;
  v_target_verified pg_catalog.boolean;
  v_row_count pg_catalog.int4;
BEGIN
  IF p_target_user_id IS NULL OR pg_catalog.length(p_target_user_id) = 0 OR pg_catalog.length(p_target_user_id) > 200 OR p_grant IS NULL THEN
    RETURN 'not-found';
  END IF;
  -- Serializes all audience changes, including concurrent owner requests.
  PERFORM pg_catalog.pg_advisory_xact_lock(1651279904, 1);
  v_actor_user_id := app_private.phase8_assert_active_owner(p_token_sha256_hex);
  IF v_actor_user_id IS NULL THEN RETURN 'forbidden'; END IF;
  -- Lock and revalidate the actor's verified identity, active profile, and
  -- owner assignment against concurrent changes until this statement ends.
  PERFORM identity.id
  FROM auth.session AS session_row
  JOIN auth."user" AS identity ON identity.id=session_row.user_id
  JOIN app.user_profiles AS profile ON profile.id=identity.id
  JOIN app.user_roles AS role_row ON role_row.user_id=identity.id AND role_row.role='owner'
  WHERE identity.id=v_actor_user_id
    AND session_row.token_sha256=pg_catalog.lower(p_token_sha256_hex)
    AND session_row.expires_at > pg_catalog.statement_timestamp()
    AND identity.email_verified IS TRUE
    AND profile.enabled IS TRUE AND profile.banned_at IS NULL
  FOR SHARE OF session_row, identity, profile, role_row;
  IF NOT FOUND THEN RETURN 'forbidden'; END IF;
  IF v_actor_user_id = p_target_user_id THEN RETURN 'self-change'; END IF;

  SELECT profile.enabled, profile.banned_at, identity.email_verified
    INTO v_target_enabled, v_target_banned_at, v_target_verified
  FROM app.user_profiles AS profile
  JOIN auth."user" AS identity ON identity.id = profile.id
  WHERE profile.id = p_target_user_id
  FOR SHARE OF profile, identity;
  IF NOT FOUND THEN RETURN 'not-found'; END IF;
  IF p_grant AND (v_target_enabled IS DISTINCT FROM true OR v_target_banned_at IS NOT NULL OR v_target_verified IS DISTINCT FROM true) THEN
    RETURN 'blocked';
  END IF;

  IF p_grant THEN
    INSERT INTO app.user_capabilities(user_id, capability, granted_by)
    VALUES (p_target_user_id, 'private_blog.read', v_actor_user_id)
    ON CONFLICT (user_id, capability) DO NOTHING;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count = 1 THEN
      INSERT INTO app.security_audit_events(actor_user_id, subject_user_id, action)
      VALUES (v_actor_user_id, p_target_user_id, 'private_journal_access_granted');
      RETURN 'ok-changed';
    END IF;
    RETURN 'ok-unchanged';
  END IF;

  DELETE FROM app.user_capabilities
  WHERE user_id=p_target_user_id AND capability='private_blog.read';
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count = 1 THEN
    INSERT INTO app.security_audit_events(actor_user_id, subject_user_id, action)
    VALUES (v_actor_user_id, p_target_user_id, 'private_journal_access_revoked');
    RETURN 'ok-changed';
  END IF;
  RETURN 'ok-unchanged';
END
$function$;
ALTER FUNCTION app_private.set_private_journal_access(pg_catalog.text, pg_catalog.text, pg_catalog.boolean) OWNER TO drckgomz_local_functions;

REVOKE CREATE ON SCHEMA app_private FROM drckgomz_local_functions;
REVOKE ALL ON FUNCTION app_private.phase8_assert_active_owner(text),
  app_private.list_private_audience_users(text,integer,integer),
  app_private.set_private_journal_access(text,text,boolean) FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO drckgomz_local_owner;
GRANT EXECUTE ON FUNCTION app_private.list_private_audience_users(text,integer,integer),
  app_private.set_private_journal_access(text,text,boolean) TO drckgomz_local_owner;
COMMIT;
