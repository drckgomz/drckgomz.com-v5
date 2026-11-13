-- REVIEW ONLY — do not execute. This must follow an approved RLS/function
-- schema migration. The script fails closed unless FORCE RLS and exact policy
-- contracts exist before SELECT is granted.
BEGIN;
DO $preflight$
DECLARE t text;
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'Wrong database'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='drckgomz_content_reader' AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls)
  THEN RAISE EXCEPTION 'Content role missing or elevated'; END IF;
  FOREACH t IN ARRAY ARRAY['posts','media','home_projects','home_project_media'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='app' AND c.relname=t AND c.relrowsecurity AND c.relforcerowsecurity)
    THEN RAISE EXCEPTION 'RLS is not enabled and forced on app.%', t; END IF;
  END LOOP;
  IF to_regprocedure('app_private.can_read_blog_row(public.publication_state,public.content_visibility,timestamp with time zone,timestamp without time zone,timestamp without time zone)') IS NULL
     OR to_regprocedure('app_private.list_private_audience_users(text,integer,integer)') IS NULL
     OR to_regprocedure('app_private.set_private_journal_access(text,text,boolean)') IS NULL
  THEN RAISE EXCEPTION 'Required reviewed authorization functions missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='app' AND tablename='posts' AND policyname='posts_content_reader_policy')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='app' AND tablename='media' AND policyname='media_content_reader_policy')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='app' AND tablename='home_projects' AND policyname='home_projects_public_rows')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='app' AND tablename='home_project_media' AND policyname='home_project_media_public_rows')
  THEN RAISE EXCEPTION 'Required content policies missing'; END IF;
END
$preflight$;
GRANT USAGE ON SCHEMA app, app_private, public TO drckgomz_content_reader;
GRANT USAGE ON TYPE public.publication_state, public.content_visibility TO drckgomz_content_reader;
GRANT SELECT ON TABLE app.posts, app.media, app.home_projects, app.home_project_media TO drckgomz_content_reader;
-- Private-content decisions must come from forced RLS policies, not app code.
-- No auth/capability tables or mutation function execution is granted here.
COMMIT;
