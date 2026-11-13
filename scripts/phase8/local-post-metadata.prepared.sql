-- PREPARED ONLY. No apply runner. Requires explicit authorization before application.
BEGIN;
SET LOCAL statement_timeout='15s'; SET LOCAL lock_timeout='5s';
DO $guard$
BEGIN
  IF current_database() <> 'drckgomz_phase5_test' OR current_user <> 'phase5_local'
     OR inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet OR inet_server_port() <> 55441
     OR current_setting('server_version_num')::integer /10000 <> 18
     OR (SELECT array_agg(hash::text ORDER BY created_at) FROM drizzle.__drizzle_migrations) IS DISTINCT FROM ARRAY['201022ebf1346f754df936a2139075c63abde28eea6be065d24214f6a8e331bc', '0ae7871fc214b53788fbfb0ef6081eb2cd89fc20ff5e2d7ef93f7a6f1dc15bbc', '582506469c83811bd9c00f313a9d23f64441234953b53efdf248549fb128f0be', '42d90a2e9812f63638359a109a064878bfa1c06444c08c5acbca19698cb9f47f', 'ef5ed1cd7b1acea20a0a25efb664cf1b1119ce141259b0ede082aa15f24c0377', '966d65b038eddfd1f12ceb47e17140e2c4252b848174429e218387070b6dbe14']::text[]
  THEN RAISE EXCEPTION 'Unapproved local target/baseline'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='drckgomz_local_owner' AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit)
     OR NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid='app.posts'::regclass)
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='app' AND tablename='posts' AND policyname='phase6_posts_owner_update' AND roles=ARRAY['drckgomz_local_owner']::name[] AND qual='(app_private.current_owner_id() IS NOT NULL)' AND with_check='(app_private.current_owner_id() IS NOT NULL)')
     OR has_column_privilege('drckgomz_local_owner','app.posts','excerpt','UPDATE')
     OR has_column_privilege('drckgomz_local_owner','app.posts','date','UPDATE')
     OR (SELECT count(*) FROM app.user_roles WHERE role='owner')<>1
  THEN RAISE EXCEPTION 'Unexpected owner privileges or RLS state'; END IF;
END $guard$;
-- No row writes, new functions, schema changes, or broad table UPDATE grant.
GRANT UPDATE (excerpt,date) ON app.posts TO drckgomz_local_owner;
COMMIT;
-- Rollback after approval, with application writes stopped:
-- REVOKE UPDATE (excerpt,date) ON app.posts FROM drckgomz_local_owner;
