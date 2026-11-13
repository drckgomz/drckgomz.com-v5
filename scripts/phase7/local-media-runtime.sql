-- Development-only media writes for the pinned disposable PostgreSQL target.
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '5s';

DO $target$
BEGIN
  IF current_database() <> 'drckgomz_phase5_test'
     OR current_user <> 'phase5_local'
     OR current_setting('server_version_num')::integer / 10000 <> 18
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
     OR inet_server_port() <> 55441
  THEN RAISE EXCEPTION 'Phase 7 local media target identity mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='drckgomz_local_owner' AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit)
     OR NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_catalog.pg_class WHERE oid='app.media'::regclass)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='app' AND tablename='media' AND policyname='phase6_media_read')
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='app' AND tablename='media' AND policyname IN ('phase7_media_owner_insert','phase7_media_owner_update','phase7_media_owner_delete'))
     OR NOT EXISTS (SELECT 1 FROM app.user_roles WHERE role='owner')
  THEN RAISE EXCEPTION 'Phase 7 media preconditions do not match the reviewed local schema'; END IF;
END
$target$;

GRANT INSERT (id, post_id, type, url, caption, idx, title, created_at, source_media_id) ON app.media TO drckgomz_local_owner;
GRANT UPDATE (caption, idx) ON app.media TO drckgomz_local_owner;
GRANT DELETE ON app.media TO drckgomz_local_owner;

CREATE POLICY phase7_media_owner_insert ON app.media FOR INSERT TO drckgomz_local_owner
  WITH CHECK (app_private.current_owner_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM app.posts p WHERE p.id=media.post_id AND app_private.current_owner_id() IS NOT NULL
  ));
CREATE POLICY phase7_media_owner_update ON app.media FOR UPDATE TO drckgomz_local_owner
  USING (app_private.current_owner_id() IS NOT NULL)
  WITH CHECK (app_private.current_owner_id() IS NOT NULL);
CREATE POLICY phase7_media_owner_delete ON app.media FOR DELETE TO drckgomz_local_owner
  USING (app_private.current_owner_id() IS NOT NULL);

COMMIT;
