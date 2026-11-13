-- PHASE 3J.5D REVIEW-ONLY MIGRATION ARTIFACT — NOT IN THE DRIZZLE JOURNAL.
-- Do not execute without a separately approved development migration.
-- Target attestation is external to PostgreSQL. Require Neon Console proof for
-- project jolly-poetry-87664309 / branch br-nameless-dust-bewpmr4r /
-- endpoint ep-sparkling-sun-bedq0ozn / database neondb immediately beforehand.
-- PostgreSQL 18 is the reviewed development target. Migration 0003 maintains
-- the token digest with a trigger because convert_to(text, name) is STABLE and
-- cannot legally appear in a generated column expression.
--
-- This migration assumes the isolated roles and the reviewed column grants in
-- scripts/phase3j5c/create-development-isolated-roles-review-only.sql exist.
-- The migration operator must be able to ALTER FUNCTION OWNER to
-- drckgomz_owner_admin. No application LOGIN role may inherit that role.

BEGIN;
SET LOCAL statement_timeout = '15s';

DO $phase3j5d_preconditions$
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'Wrong database'; END IF;
  IF current_setting('server_version_num')::integer / 10000 <> 18 THEN RAISE EXCEPTION 'PostgreSQL 18 required'; END IF;
  IF to_regnamespace('app') IS NULL OR to_regnamespace('auth') IS NULL THEN RAISE EXCEPTION 'Required schemas missing'; END IF;
  IF to_regnamespace('app_private') IS NOT NULL THEN RAISE EXCEPTION 'app_private already exists; review before proceeding'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='drckgomz_auth_runtime' AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='drckgomz_owner_runtime' AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='drckgomz_owner_admin' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='drckgomz_content_reader' AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)
  THEN RAISE EXCEPTION 'Isolated role prerequisites missing or elevated'; END IF;
  IF NOT pg_catalog.pg_has_role(current_user, 'drckgomz_owner_admin', 'SET') THEN
    RAISE EXCEPTION 'Migration principal cannot safely transfer function ownership';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members m
    JOIN pg_catalog.pg_roles member ON member.oid=m.member
    JOIN pg_catalog.pg_roles parent ON parent.oid=m.roleid
    WHERE member.rolname IN ('drckgomz_auth_runtime','drckgomz_content_reader','drckgomz_owner_runtime','drckgomz_owner_admin','drckgomz_bootstrap')
       OR parent.rolname IN ('drckgomz_auth_runtime','drckgomz_content_reader','drckgomz_owner_runtime','drckgomz_bootstrap')
       OR (parent.rolname='drckgomz_owner_admin' AND member.rolname <> current_user)
  ) THEN RAISE EXCEPTION 'Unexpected role membership'; END IF;
  IF to_regclass('app.posts') IS NULL OR to_regclass('app.media') IS NULL
     OR to_regclass('app.home_projects') IS NULL OR to_regclass('app.home_project_media') IS NULL
     OR to_regclass('app.user_profiles') IS NULL OR to_regclass('app.user_roles') IS NULL
     OR to_regclass('app.user_capabilities') IS NULL OR to_regclass('app.security_audit_events') IS NULL
     OR to_regclass('auth.session') IS NULL OR to_regclass('auth."user"') IS NULL
  THEN RAISE EXCEPTION 'Expected Drizzle tables missing'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='app' AND tablename IN ('posts','media','home_projects','home_project_media')
  ) THEN RAISE EXCEPTION 'Unexpected pre-existing content policy; review before adding permissive policies'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='auth' AND c.relname='session' AND a.attname='token_sha256'
      AND a.attgenerated='' AND a.attnotnull AND NOT a.attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='auth' AND c.relname='session'
      AND t.tgname='auth_session_token_sha256_trg' AND NOT t.tgisinternal
  ) THEN RAISE EXCEPTION 'Session token digest trigger migration 0003 is missing'; END IF;
END
$phase3j5d_preconditions$;

CREATE SCHEMA app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO drckgomz_content_reader, drckgomz_owner_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA app_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- PostgreSQL requires the new owner to have CREATE on the containing schema
-- during ALTER FUNCTION OWNER. Remove this temporary ability after transfers.
GRANT CREATE ON SCHEMA app_private TO drckgomz_owner_admin;

-- The token digest is a bearer proof, never an identity claim. Better Auth
-- stores the raw token; the app passes only SHA-256(token), and this definer
-- function checks it against the current, unexpired, non-revoked DB session.
-- The digest is still replayable and must be treated as secret material.
CREATE FUNCTION app_private.current_active_user(p_token_sha256_hex pg_catalog.text)
RETURNS pg_catalog.text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT s.user_id
  FROM auth.session AS s
  JOIN app.user_profiles AS profile ON profile.id = s.user_id
  WHERE p_token_sha256_hex IS NOT NULL
    AND p_token_sha256_hex ~ '^[A-Fa-f0-9]{64}$'
    AND s.token_sha256 = pg_catalog.lower(p_token_sha256_hex)
    AND s.expires_at > pg_catalog.statement_timestamp()
    AND profile.enabled IS TRUE
    AND profile.banned_at IS NULL
  LIMIT 1
$function$;
ALTER FUNCTION app_private.current_active_user(pg_catalog.text) OWNER TO drckgomz_owner_admin;

-- A server-side session/profile lookup for Better Auth routes. The caller
-- cannot supply an identity: the only input is the transaction-local token
-- digest, which current_active_user verifies against the live session row.
CREATE FUNCTION app_private.current_viewer_profile()
RETURNS pg_catalog.jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT pg_catalog.jsonb_build_object(
    'id', profile.id,
    'username', profile.username,
    'email', identity.email,
    'first_name', profile.first_name,
    'last_name', profile.last_name,
    'enabled', profile.enabled,
    'is_banned', profile.banned_at IS NOT NULL,
    'is_owner', coalesce(roles.is_owner, false),
    'is_whitelist_admin', coalesce(roles.is_whitelist_admin, false),
    'role', coalesce(roles.role, 'user'),
    'can_view_private', coalesce(roles.is_owner, false) OR coalesce(roles.is_admin, false)
      OR coalesce(capability.can_view_private, false)
  )
  FROM app.user_profiles AS profile
  JOIN auth."user" AS identity ON identity.id = profile.id
  LEFT JOIN LATERAL (
    SELECT
      pg_catalog.bool_or(role_row.role = 'owner') AS is_owner,
      pg_catalog.bool_or(role_row.role = 'whitelist_manager') AS is_whitelist_admin,
      pg_catalog.bool_or(role_row.role IN ('owner', 'content_admin')) AS is_admin,
      CASE
        WHEN pg_catalog.bool_or(role_row.role = 'owner') THEN 'owner'
        WHEN pg_catalog.bool_or(role_row.role = 'content_admin') THEN 'content_admin'
        WHEN pg_catalog.bool_or(role_row.role = 'whitelist_manager') THEN 'whitelist_manager'
        ELSE 'user'
      END AS role
    FROM app.user_roles AS role_row
    WHERE role_row.user_id = profile.id
  ) AS roles ON true
  LEFT JOIN LATERAL (
    SELECT pg_catalog.bool_or(capability_row.capability = 'private_blog.read') AS can_view_private
    FROM app.user_capabilities AS capability_row
    WHERE capability_row.user_id = profile.id
  ) AS capability ON true
  WHERE profile.id = app_private.current_active_user(
    pg_catalog.current_setting('app.session_token_sha256', true)
  )
  LIMIT 1
$function$;
ALTER FUNCTION app_private.current_viewer_profile() OWNER TO drckgomz_owner_admin;

-- This returns one generic teaser bit, never a slug/title/count/image. It lets
-- the anonymous blog reader show its locked-card prompt without broad SELECT.
CREATE FUNCTION app_private.has_published_restricted_posts()
RETURNS pg_catalog.boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM app.posts AS post_row
    WHERE post_row.publication_state = 'published'
      AND post_row.visibility <> 'public'
      AND post_row.deleted_at IS NULL
      AND post_row.deletion_date IS NULL
  )
$function$;
ALTER FUNCTION app_private.has_published_restricted_posts() OWNER TO drckgomz_owner_admin;

CREATE FUNCTION app_private.can_read_blog_row(
  p_state public.publication_state,
  p_visibility public.content_visibility,
  p_published_at pg_catalog.timestamptz,
  p_deleted_at pg_catalog.timestamp,
  p_deletion_date pg_catalog.timestamp
)
RETURNS pg_catalog.boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_id pg_catalog.text;
BEGIN
  IF p_deleted_at IS NOT NULL OR p_deletion_date IS NOT NULL THEN RETURN false; END IF;
  IF p_state = 'published' AND p_visibility = 'public' THEN RETURN true; END IF;

  v_user_id := app_private.current_active_user(
    pg_catalog.current_setting('app.session_token_sha256', true)
  );
  IF v_user_id IS NULL THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM app.user_roles AS role_row
    WHERE role_row.user_id = v_user_id AND role_row.role IN ('owner', 'content_admin')
  ) THEN RETURN true; END IF;

  IF p_state = 'published' AND p_visibility = 'private' AND EXISTS (
    SELECT 1 FROM app.user_capabilities AS capability_row
    WHERE capability_row.user_id = v_user_id AND capability_row.capability = 'private_blog.read'
  ) THEN RETURN true; END IF;

  RETURN false;
END
$function$;
ALTER FUNCTION app_private.can_read_blog_row(public.publication_state, public.content_visibility, pg_catalog.timestamptz, pg_catalog.timestamp, pg_catalog.timestamp)
  OWNER TO drckgomz_owner_admin;

CREATE FUNCTION app_private.assert_active_owner(p_token_sha256_hex pg_catalog.text)
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
ALTER FUNCTION app_private.assert_active_owner(pg_catalog.text) OWNER TO drckgomz_owner_admin;

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
  IF app_private.assert_active_owner(p_token_sha256_hex) IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('forbidden', true, 'total', 0, 'users', '[]'::jsonb);
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
  ) ORDER BY page.created_at DESC, page.id DESC), '[]'::jsonb)
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
ALTER FUNCTION app_private.list_private_audience_users(pg_catalog.text, pg_catalog.integer, pg_catalog.integer) OWNER TO drckgomz_owner_admin;

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
  v_actor_user_id := app_private.assert_active_owner(p_token_sha256_hex);
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
ALTER FUNCTION app_private.set_private_journal_access(pg_catalog.text, pg_catalog.text, pg_catalog.boolean) OWNER TO drckgomz_owner_admin;
REVOKE CREATE ON SCHEMA app_private FROM drckgomz_owner_admin;

-- Fixed search_path on every definer routine prevents caller-controlled
-- object shadowing; every non-catalog object above is schema-qualified.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.current_viewer_profile() TO drckgomz_content_reader;
GRANT EXECUTE ON FUNCTION app_private.has_published_restricted_posts() TO drckgomz_content_reader;
GRANT EXECUTE ON FUNCTION app_private.can_read_blog_row(public.publication_state, public.content_visibility, pg_catalog.timestamptz, pg_catalog.timestamp, pg_catalog.timestamp)
  TO drckgomz_content_reader;
GRANT EXECUTE ON FUNCTION app_private.list_private_audience_users(pg_catalog.text, pg_catalog.integer, pg_catalog.integer),
  app_private.set_private_journal_access(pg_catalog.text, pg_catalog.text, pg_catalog.boolean) TO drckgomz_owner_runtime;
GRANT USAGE ON SCHEMA auth, app TO drckgomz_owner_admin;
GRANT SELECT (id, user_id, token_sha256, expires_at) ON TABLE auth.session TO drckgomz_owner_admin;
GRANT UPDATE (updated_at) ON TABLE auth.session TO drckgomz_owner_admin;
GRANT SELECT (id, email, name, email_verified, created_at) ON TABLE auth."user" TO drckgomz_owner_admin;
GRANT UPDATE (updated_at) ON TABLE auth."user" TO drckgomz_owner_admin;
GRANT SELECT (id, username, first_name, last_name, enabled, banned_at) ON TABLE app.user_profiles TO drckgomz_owner_admin;
GRANT UPDATE (updated_at) ON TABLE app.user_profiles TO drckgomz_owner_admin;
GRANT SELECT (user_id, role) ON TABLE app.user_roles TO drckgomz_owner_admin;
GRANT UPDATE (granted_at) ON TABLE app.user_roles TO drckgomz_owner_admin;
GRANT SELECT (user_id, capability) ON TABLE app.user_capabilities TO drckgomz_owner_admin;
GRANT INSERT (user_id, capability, granted_by), DELETE ON TABLE app.user_capabilities TO drckgomz_owner_admin;
GRANT INSERT (actor_user_id, subject_user_id, action) ON TABLE app.security_audit_events TO drckgomz_owner_admin;
GRANT USAGE ON SCHEMA app_private TO drckgomz_owner_admin;
GRANT USAGE ON TYPE public.publication_state, public.content_visibility TO drckgomz_owner_admin;

-- Public content remains publicly readable where SELECT is already granted;
-- RLS restricts those rows to published, public, non-deleted content.
ALTER TABLE app.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.posts FORCE ROW LEVEL SECURITY;
CREATE POLICY posts_public_rows ON app.posts TO PUBLIC USING (
  publication_state='published' AND visibility='public' AND deleted_at IS NULL AND deletion_date IS NULL
);
CREATE POLICY posts_content_reader_policy ON app.posts TO drckgomz_content_reader USING (
  app_private.can_read_blog_row(publication_state, visibility, published_at, deleted_at, deletion_date)
);

ALTER TABLE app.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.media FORCE ROW LEVEL SECURITY;
CREATE POLICY media_public_rows ON app.media TO PUBLIC USING (
  EXISTS (SELECT 1 FROM app.posts p WHERE p.id=post_id AND p.publication_state='published'
    AND p.visibility='public' AND p.deleted_at IS NULL AND p.deletion_date IS NULL)
);
CREATE POLICY media_content_reader_policy ON app.media TO drckgomz_content_reader USING (
  EXISTS (SELECT 1 FROM app.posts p WHERE p.id=post_id AND
    app_private.can_read_blog_row(p.publication_state, p.visibility, p.published_at, p.deleted_at, p.deletion_date))
);

ALTER TABLE app.home_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.home_projects FORCE ROW LEVEL SECURITY;
CREATE POLICY home_projects_public_rows ON app.home_projects TO PUBLIC USING (
  publication_state='published' AND visibility='public' AND deleted_at IS NULL AND deletion_date IS NULL
);

ALTER TABLE app.home_project_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.home_project_media FORCE ROW LEVEL SECURITY;
CREATE POLICY home_project_media_public_rows ON app.home_project_media TO PUBLIC USING (
  EXISTS (SELECT 1 FROM app.home_projects project WHERE project.id=project_id
    AND project.publication_state='published' AND project.visibility='public'
    AND project.deleted_at IS NULL AND project.deletion_date IS NULL)
);

COMMIT;

-- ROLLBACK PLAN (separate reviewed operation; do not run automatically):
-- Drop the four policies by exact name; disable and NO FORCE RLS on only these
-- four tables; revoke only the listed EXECUTE/schema grants; drop only these
-- five functions and app_private after confirming no dependent objects. Leave
-- the schema-managed token digest column/index in place. Keep
-- role credentials untouched. Reverting RLS restores prior application-level
-- filtering and therefore reopens the documented credential-compromise risk.
