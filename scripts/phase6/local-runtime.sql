-- Phase 6 local-only runtime roles and owner-verifying RLS.
-- Apply only to the pinned disposable PG18 database with phase5_local.
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '5s';

DO $phase6_target$
BEGIN
  IF current_database() <> 'drckgomz_phase5_test'
     OR current_user <> 'phase5_local'
     OR current_setting('server_version_num')::integer / 10000 <> 18
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
  THEN RAISE EXCEPTION 'Phase 6 local target identity mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN
    ('drckgomz_local_auth','drckgomz_local_content','drckgomz_local_owner','drckgomz_local_functions'))
  THEN RAISE EXCEPTION 'Phase 6 local role already exists; inspect local state before continuing'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='app' AND tablename IN ('posts','media'))
  THEN RAISE EXCEPTION 'Unexpected existing post/media policy'; END IF;
  IF (SELECT relrowsecurity OR relforcerowsecurity FROM pg_catalog.pg_class WHERE oid='app.posts'::regclass)
     OR (SELECT relrowsecurity OR relforcerowsecurity FROM pg_catalog.pg_class WHERE oid='app.media'::regclass)
  THEN RAISE EXCEPTION 'Unexpected existing post/media RLS state'; END IF;
END
$phase6_target$;

CREATE ROLE drckgomz_local_auth LOGIN NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE drckgomz_local_content LOGIN NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE drckgomz_local_owner LOGIN NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE drckgomz_local_functions NOLOGIN NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE drckgomz_phase5_test TO drckgomz_local_auth, drckgomz_local_content, drckgomz_local_owner;

GRANT USAGE ON SCHEMA auth, app TO drckgomz_local_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth."user", auth.account, auth.session, auth.verification TO drckgomz_local_auth;
GRANT INSERT ON app.user_profiles TO drckgomz_local_auth;

GRANT USAGE ON SCHEMA app, auth TO drckgomz_local_content;
GRANT SELECT (id, slug, title, excerpt, content, publication_state, visibility, published_at, date,
  thumbnail_url, deleted_at, deletion_date, created_at, updated_at, revision) ON app.posts TO drckgomz_local_content;
GRANT SELECT (id, post_id, type, url, caption, idx, title, created_at, source_media_id) ON app.media TO drckgomz_local_content;
GRANT USAGE ON TYPE public.publication_state, public.content_visibility TO drckgomz_local_content;

GRANT USAGE ON SCHEMA app, auth TO drckgomz_local_owner;
GRANT SELECT (id, slug, title, excerpt, content, publication_state, visibility, published_at, date,
  thumbnail_url, legacy_views, legacy_status, deleted_at, deletion_date, author_user_id, created_at, updated_at, revision) ON app.posts TO drckgomz_local_owner;
GRANT UPDATE (title, content, updated_at, revision) ON app.posts TO drckgomz_local_owner;
GRANT SELECT (id, post_id, type, url, caption, idx, title, created_at, source_media_id) ON app.media TO drckgomz_local_owner;
GRANT USAGE ON TYPE public.publication_state, public.content_visibility TO drckgomz_local_owner;

CREATE SCHEMA app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO drckgomz_local_content, drckgomz_local_owner, drckgomz_local_functions;
GRANT CREATE ON SCHEMA app_private TO drckgomz_local_functions;
ALTER DEFAULT PRIVILEGES FOR ROLE phase5_local IN SCHEMA app_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

GRANT USAGE ON SCHEMA auth, app TO drckgomz_local_functions;
GRANT SELECT (id, user_id, token_sha256, expires_at) ON auth.session TO drckgomz_local_functions;
GRANT SELECT (id, email, name, email_verified) ON auth."user" TO drckgomz_local_functions;
GRANT SELECT (id, username, first_name, last_name, enabled, banned_at) ON app.user_profiles TO drckgomz_local_functions;
GRANT SELECT (user_id, role) ON app.user_roles TO drckgomz_local_functions;
GRANT SELECT (user_id, capability) ON app.user_capabilities TO drckgomz_local_functions;

CREATE FUNCTION app_private.current_active_user()
RETURNS pg_catalog.text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT session_row.user_id
  FROM auth.session AS session_row
  JOIN app.user_profiles AS profile ON profile.id = session_row.user_id
  WHERE pg_catalog.current_setting('app.session_token_sha256', true) ~ '^[A-Fa-f0-9]{64}$'
    AND session_row.token_sha256 = pg_catalog.lower(pg_catalog.current_setting('app.session_token_sha256', true))
    AND session_row.expires_at > pg_catalog.statement_timestamp()
    AND profile.enabled IS TRUE
    AND profile.banned_at IS NULL
  LIMIT 1
$function$;
ALTER FUNCTION app_private.current_active_user() OWNER TO drckgomz_local_functions;

CREATE FUNCTION app_private.current_owner_id()
RETURNS pg_catalog.text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT identity.id
  FROM auth."user" AS identity
  JOIN app.user_roles AS role_row ON role_row.user_id = identity.id AND role_row.role = 'owner'
  WHERE identity.id = app_private.current_active_user()
    AND identity.email_verified IS TRUE
  LIMIT 1
$function$;
ALTER FUNCTION app_private.current_owner_id() OWNER TO drckgomz_local_functions;

CREATE FUNCTION app_private.current_viewer_profile()
RETURNS pg_catalog.jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT pg_catalog.jsonb_build_object(
    'id', profile.id,
    'username', profile.username,
    'email', identity.email,
    'first_name', profile.first_name,
    'last_name', profile.last_name,
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

CREATE FUNCTION app_private.can_read_blog_row(
  p_state public.publication_state,
  p_visibility public.content_visibility,
  p_deleted_at pg_catalog.timestamp,
  p_deletion_date pg_catalog.timestamp
)
RETURNS pg_catalog.bool
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT CASE
    WHEN app_private.current_owner_id() IS NOT NULL THEN true
    WHEN p_deleted_at IS NOT NULL OR p_deletion_date IS NOT NULL THEN false
    WHEN p_state='published' AND p_visibility='public' THEN true
    WHEN p_state='published' AND p_visibility='private'
      THEN EXISTS (SELECT 1 FROM app.user_capabilities cap
        WHERE cap.user_id=app_private.current_active_user() AND cap.capability='private_blog.read')
    ELSE false
  END
$function$;
ALTER FUNCTION app_private.can_read_blog_row(public.publication_state, public.content_visibility, pg_catalog.timestamp, pg_catalog.timestamp)
  OWNER TO drckgomz_local_functions;

REVOKE CREATE ON SCHEMA app_private FROM drckgomz_local_functions;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.current_active_user(), app_private.current_owner_id(), app_private.current_viewer_profile() TO drckgomz_local_content, drckgomz_local_owner;
GRANT EXECUTE ON FUNCTION app_private.can_read_blog_row(public.publication_state, public.content_visibility, pg_catalog.timestamp, pg_catalog.timestamp) TO drckgomz_local_content, drckgomz_local_owner;

ALTER TABLE app.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.posts FORCE ROW LEVEL SECURITY;
CREATE POLICY phase6_posts_public_read ON app.posts FOR SELECT TO drckgomz_local_content, drckgomz_local_owner
  USING (app_private.can_read_blog_row(publication_state, visibility, deleted_at, deletion_date));
CREATE POLICY phase6_posts_owner_update ON app.posts FOR UPDATE TO drckgomz_local_owner
  USING (app_private.current_owner_id() IS NOT NULL)
  WITH CHECK (app_private.current_owner_id() IS NOT NULL);

ALTER TABLE app.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.media FORCE ROW LEVEL SECURITY;
CREATE POLICY phase6_media_read ON app.media FOR SELECT TO drckgomz_local_content, drckgomz_local_owner
  USING (EXISTS (SELECT 1 FROM app.posts post_row
    WHERE post_row.id=media.post_id
      AND app_private.can_read_blog_row(post_row.publication_state, post_row.visibility, post_row.deleted_at, post_row.deletion_date)));

COMMIT;
