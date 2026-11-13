-- Explicitly scoped local development privileges for owner draft creation and
-- publication-state management. Apply only to the pinned disposable PG18 DB.
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '5s';

DO $target$
BEGIN
  IF current_database() <> 'drckgomz_phase5_test'
     OR current_user <> 'phase5_local'
     OR current_setting('server_version_num')::integer / 10000 <> 18
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
  THEN RAISE EXCEPTION 'Phase 6 local target identity mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='drckgomz_local_owner' AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='app' AND tablename='posts' AND policyname='phase6_posts_owner_update')
     OR NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_catalog.pg_class WHERE oid='app.posts'::regclass)
     OR NOT EXISTS (SELECT 1 FROM app.user_roles WHERE role='owner')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='app' AND tablename='posts' AND policyname='phase6_posts_owner_insert' AND cmd='INSERT' AND roles=ARRAY['drckgomz_local_owner']::name[] AND with_check='(app_private.current_owner_id() IS NOT NULL)')
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='app' AND tablename='posts' AND policyname='phase6_posts_owner_delete')
  THEN RAISE EXCEPTION 'Expected Phase 6 owner role, RLS, or bootstrap is missing'; END IF;
END
$target$;

GRANT INSERT (id, slug, title, excerpt, content, publication_state, visibility, date, created_at, updated_at, revision)
  ON app.posts TO drckgomz_local_owner;
GRANT UPDATE (publication_state, visibility, published_at, updated_at, revision)
  ON app.posts TO drckgomz_local_owner;
GRANT DELETE ON app.posts TO drckgomz_local_owner;
CREATE POLICY phase6_posts_owner_delete ON app.posts FOR DELETE TO drckgomz_local_owner
  USING (app_private.current_owner_id() IS NOT NULL);

COMMIT;
