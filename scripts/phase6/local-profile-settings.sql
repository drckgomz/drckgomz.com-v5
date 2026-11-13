-- One-time, local-only self-profile update function for the pinned Phase 6 PG18 database.
-- Applied after approval to the pinned disposable target; guard rejects reapplication.
-- Never use against Neon or production.
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '5s';

DO $target$
BEGIN
  IF current_database() <> 'drckgomz_phase5_test'
     OR current_user <> 'phase5_local'
     OR current_setting('server_version_num')::integer / 10000 <> 18
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='drckgomz_local_auth' AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='drckgomz_local_content' AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='drckgomz_local_functions' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)
  THEN RAISE EXCEPTION 'Phase 6 profile-function target identity mismatch'; END IF;
  IF pg_catalog.to_regprocedure('app_private.update_current_profile(text,text,text,text,text)') IS NOT NULL
  THEN RAISE EXCEPTION 'Profile function already exists; inspect state before proceeding'; END IF;
  IF pg_catalog.to_regprocedure('app_private.current_viewer_profile()') IS NULL
  THEN RAISE EXCEPTION 'Expected Phase 6 viewer function is missing'; END IF;
END
$target$;

GRANT USAGE ON SCHEMA app_private TO drckgomz_local_content;
GRANT SELECT (avatar_color) ON app.user_profiles TO drckgomz_local_functions;
GRANT SELECT (version) ON app.user_profiles TO drckgomz_local_functions;
GRANT UPDATE (name, updated_at) ON auth."user" TO drckgomz_local_functions;
GRANT UPDATE (first_name, last_name, avatar_color, updated_at, version) ON app.user_profiles TO drckgomz_local_functions;

CREATE FUNCTION app_private.update_current_profile(
  p_token_sha256_hex pg_catalog.text,
  p_display_name pg_catalog.text,
  p_first_name pg_catalog.text,
  p_last_name pg_catalog.text,
  p_avatar_color pg_catalog.text
)
RETURNS pg_catalog.text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_user_id pg_catalog.text;
BEGIN
  IF p_token_sha256_hex IS NULL OR p_token_sha256_hex !~ '^[A-Fa-f0-9]{64}$'
     OR p_display_name IS NULL OR pg_catalog.length(pg_catalog.btrim(p_display_name)) NOT BETWEEN 1 AND 80
     OR p_display_name ~ '[[:cntrl:]]'
     OR (p_first_name IS NOT NULL AND (pg_catalog.length(pg_catalog.btrim(p_first_name)) > 80 OR p_first_name ~ '[[:cntrl:]]'))
     OR (p_last_name IS NOT NULL AND (pg_catalog.length(pg_catalog.btrim(p_last_name)) > 80 OR p_last_name ~ '[[:cntrl:]]'))
     OR p_avatar_color IS NULL OR p_avatar_color !~ '^#[0-9A-Fa-f]{6}$'
  THEN RAISE EXCEPTION 'Invalid profile update' USING ERRCODE='22023'; END IF;

  SELECT s.user_id INTO v_user_id
  FROM auth.session AS s
  JOIN auth."user" AS u ON u.id=s.user_id
  JOIN app.user_profiles AS p ON p.id=u.id
  WHERE s.token_sha256=pg_catalog.lower(p_token_sha256_hex)
    AND s.expires_at > pg_catalog.statement_timestamp()
    AND p.enabled IS TRUE
    AND p.banned_at IS NULL;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Active session required' USING ERRCODE='28000'; END IF;

  UPDATE auth."user" SET name=pg_catalog.btrim(p_display_name), updated_at=pg_catalog.statement_timestamp()
  WHERE id=v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active identity required' USING ERRCODE='28000'; END IF;

  UPDATE app.user_profiles
  SET first_name=NULLIF(pg_catalog.btrim(p_first_name), ''),
      last_name=NULLIF(pg_catalog.btrim(p_last_name), ''),
      avatar_color=pg_catalog.upper(p_avatar_color),
      updated_at=pg_catalog.statement_timestamp(),
      version=version+1
  WHERE id=v_user_id AND enabled IS TRUE AND banned_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active profile required' USING ERRCODE='28000'; END IF;
  RETURN v_user_id;
END
$function$;

CREATE OR REPLACE FUNCTION app_private.current_viewer_profile()
RETURNS pg_catalog.jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT pg_catalog.jsonb_build_object(
    'id', profile.id,
    'username', profile.username,
    'display_name', identity.name,
    'email', identity.email,
    'first_name', profile.first_name,
    'last_name', profile.last_name,
    'avatar_color', profile.avatar_color,
    'role', coalesce((SELECT role_row.role FROM app.user_roles AS role_row WHERE role_row.user_id=profile.id ORDER BY role_row.role LIMIT 1), 'user'),
    'enabled', profile.enabled,
    'is_banned', profile.banned_at IS NOT NULL,
    'is_owner', EXISTS (SELECT 1 FROM app.user_roles AS role_row WHERE role_row.user_id=profile.id AND role_row.role='owner'),
    'is_whitelist_admin', false,
    'can_view_private', EXISTS (SELECT 1 FROM app.user_capabilities AS capability_row WHERE capability_row.user_id=profile.id AND capability_row.capability='private_blog.read')
  )
  FROM app.user_profiles AS profile
  JOIN auth."user" AS identity ON identity.id=profile.id
  WHERE profile.id=app_private.current_active_user()
  LIMIT 1
$function$;
ALTER FUNCTION app_private.current_viewer_profile() OWNER TO drckgomz_local_functions;

ALTER FUNCTION app_private.update_current_profile(pg_catalog.text,pg_catalog.text,pg_catalog.text,pg_catalog.text,pg_catalog.text)
  OWNER TO drckgomz_local_functions;
REVOKE ALL ON FUNCTION app_private.update_current_profile(pg_catalog.text,pg_catalog.text,pg_catalog.text,pg_catalog.text,pg_catalog.text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.update_current_profile(pg_catalog.text,pg_catalog.text,pg_catalog.text,pg_catalog.text,pg_catalog.text)
  TO drckgomz_local_content;
COMMIT;
