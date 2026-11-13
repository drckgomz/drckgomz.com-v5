-- Execute only from the already verified Neon development branch SQL Editor.
-- This file selects aggregate/catalog state only; it does not expose row values.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';

SELECT current_database() AS database_name,
       current_setting('server_version') AS postgres_version,
       current_setting('transaction_read_only') AS transaction_read_only;

SELECT count(*) AS migration_entries,
       array_agg(hash ORDER BY id) IN (ARRAY[
         '201022ebf1346f754df936a2139075c63abde28eea6be065d24214f6a8e331bc',
         '0ae7871fc214b53788fbfb0ef6081eb2cd89fc20ff5e2d7ef93f7a6f1dc15bbc',
         '582506469c83811bd9c00f313a9d23f64441234953b53efdf248549fb128f0be'
       ]::text[], ARRAY[
         '201022ebf1346f754df936a2139075c63abde28eea6be065d24214f6a8e331bc',
         '0ae7871fc214b53788fbfb0ef6081eb2cd89fc20ff5e2d7ef93f7a6f1dc15bbc',
         '582506469c83811bd9c00f313a9d23f64441234953b53efdf248549fb128f0be',
         '0aaf2b0225b819ce1dc262f504dcf1a6b72ec9761bf13a01ab8ccd6cb09fb93e'
       ]::text[]) AS reviewed_migration_state_matches
FROM drizzle.__drizzle_migrations;

SELECT 'bug_reports' AS table_name, count(*)::bigint AS rows FROM legacy.bug_reports
UNION ALL SELECT 'content', count(*) FROM legacy.content
UNION ALL SELECT 'content_media', count(*) FROM legacy.content_media
UNION ALL SELECT 'media', count(*) FROM legacy.media
UNION ALL SELECT 'post_media', count(*) FROM legacy.post_media
UNION ALL SELECT 'posts', count(*) FROM legacy.posts
UNION ALL SELECT 'users', count(*) FROM legacy.users
ORDER BY table_name;

SELECT source_table, review_state, count(*)::bigint AS provenance_rows
FROM ops.legacy_entity_map
WHERE source_namespace = 'supabase-backup-unverified'
  AND mapping_version = 'phase3i-legacy-stage-v1'
GROUP BY source_table, review_state
ORDER BY source_table, review_state;

SELECT status, mapping_version, report->>'totalRows' AS reported_rows,
       report->>'deferredBugReports' AS deferred_bug_reports,
       count(*)::bigint AS run_records
FROM ops.legacy_import_runs
WHERE mapping_version = 'phase3i-legacy-stage-v1'
GROUP BY status, mapping_version, report->>'totalRows', report->>'deferredBugReports'
ORDER BY status;

SELECT
  (SELECT count(*) FROM legacy.content c LEFT JOIN legacy.media m ON m.id=c.media_id WHERE c.media_id IS NOT NULL AND m.id IS NULL)::bigint AS content_media_orphans,
  (SELECT count(*) FROM legacy.content_media x LEFT JOIN legacy.content c ON c.id=x.content_id LEFT JOIN legacy.media m ON m.id=x.media_id WHERE c.id IS NULL OR m.id IS NULL)::bigint AS content_gallery_orphans,
  (SELECT count(*) FROM legacy.post_media x LEFT JOIN legacy.posts p ON p.id=x.post_id LEFT JOIN legacy.media m ON m.id=x.media_id WHERE (x.post_id IS NOT NULL AND p.id IS NULL) OR (x.media_id IS NOT NULL AND m.id IS NULL))::bigint AS post_gallery_orphans;

SELECT
  (SELECT count(*) FROM app.posts)::bigint AS app_posts,
  (SELECT count(*) FROM app.media)::bigint AS app_media,
  (SELECT count(*) FROM app.home_sections)::bigint AS app_home_sections,
  (SELECT count(*) FROM app.home_projects)::bigint AS app_home_projects,
  (SELECT count(*) FROM auth."user")::bigint AS auth_users,
  (SELECT count(*) FROM auth.account)::bigint AS auth_accounts,
  (SELECT count(*) FROM auth.session)::bigint AS auth_sessions,
  (SELECT count(*) FROM app.user_roles)::bigint AS role_assignments;

ROLLBACK;
