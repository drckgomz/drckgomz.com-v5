-- Aggregate-only read-only check for the repository-local disposable DB.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';

SELECT current_database() = 'drckgomz_phase5_test' AS expected_database,
       current_user = 'phase5_local' AS expected_local_role,
       inet_server_addr() = '127.0.0.1'::inet AS loopback_address,
       inet_server_port() = 55441 AS expected_port,
       current_setting('server_version_num')::integer / 10000 = 18 AS expected_postgres_major;

SELECT 'legacy.posts' AS table_name, count(*)::bigint AS row_count FROM legacy.posts
UNION ALL SELECT 'legacy.media', count(*) FROM legacy.media
UNION ALL SELECT 'legacy.content', count(*) FROM legacy.content
UNION ALL SELECT 'legacy.content_media', count(*) FROM legacy.content_media
UNION ALL SELECT 'legacy.post_media', count(*) FROM legacy.post_media
UNION ALL SELECT 'legacy.users', count(*) FROM legacy.users
UNION ALL SELECT 'legacy.bug_reports', count(*) FROM legacy.bug_reports
ORDER BY table_name;

SELECT (SELECT count(*) FROM ops.legacy_entity_map) AS provenance_rows,
       (SELECT count(*) FROM ops.legacy_import_runs WHERE status='imported') AS completed_import_runs,
       (SELECT count(*) FROM drizzle.__drizzle_migrations) AS applied_migrations;

SELECT
  (SELECT count(*) FROM legacy.content c LEFT JOIN legacy.media m ON m.id=c.media_id WHERE c.media_id IS NOT NULL AND m.id IS NULL)
  + (SELECT count(*) FROM legacy.content_media cm LEFT JOIN legacy.content c ON c.id=cm.content_id LEFT JOIN legacy.media m ON m.id=cm.media_id WHERE c.id IS NULL OR m.id IS NULL)
  + (SELECT count(*) FROM legacy.post_media pm LEFT JOIN legacy.posts p ON p.id=pm.post_id LEFT JOIN legacy.media m ON m.id=pm.media_id WHERE (pm.post_id IS NOT NULL AND p.id IS NULL) OR (pm.media_id IS NOT NULL AND m.id IS NULL))
  AS orphaned_relationships;

SELECT
  (SELECT count(*) FROM app.posts) + (SELECT count(*) FROM app.media)
  + (SELECT count(*) FROM app.home_projects) + (SELECT count(*) FROM app.home_project_media)
  + (SELECT count(*) FROM app.home_sections) + (SELECT count(*) FROM app.home_media)
  + (SELECT count(*) FROM app.user_profiles) + (SELECT count(*) FROM app.user_roles)
  + (SELECT count(*) FROM app.user_capabilities) + (SELECT count(*) FROM app.security_audit_events)
  + (SELECT count(*) FROM app.audience_groups) + (SELECT count(*) FROM app.audience_memberships)
  + (SELECT count(*) FROM app.post_access_grants) + (SELECT count(*) FROM app.post_access_requests)
  + (SELECT count(*) FROM app.appearance_settings) AS application_rows,
  (SELECT count(*) FROM auth."user") + (SELECT count(*) FROM auth.session)
  + (SELECT count(*) FROM auth.account) + (SELECT count(*) FROM auth.verification) AS authentication_rows;

ROLLBACK;
