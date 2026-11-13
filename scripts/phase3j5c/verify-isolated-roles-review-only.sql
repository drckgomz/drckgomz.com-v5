-- REVIEW ONLY. Read-only effective-permission inspection; never provisions.
-- Branch identity must be attested independently in Neon Console.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT current_database(), current_user, current_setting('server_version');

SELECT r.rolname, r.rolcanlogin, r.rolsuper, r.rolinherit, r.rolcreatedb,
       r.rolcreaterole, r.rolreplication, r.rolbypassrls
FROM pg_catalog.pg_roles r
WHERE r.rolname IN ('drckgomz_auth_runtime','drckgomz_content_reader','drckgomz_owner_runtime','drckgomz_owner_admin','drckgomz_bootstrap')
ORDER BY r.rolname;

-- Empty result required: no memberships to or from any proposed role.
SELECT member.rolname AS member, granted.rolname AS granted_role,
       m.admin_option, m.inherit_option, m.set_option
FROM pg_catalog.pg_auth_members m
JOIN pg_catalog.pg_roles member ON member.oid=m.member
JOIN pg_catalog.pg_roles granted ON granted.oid=m.roleid
WHERE member.rolname LIKE 'drckgomz_%' OR granted.rolname LIKE 'drckgomz_%';

-- Effective table and column privileges. Column-level grants are distinct
-- from table ACLs, so both checks are required. The owner login must have no
-- direct access to protected tables. The NOLOGIN function owner may touch only
-- the listed identity/capability/audit columns needed by its definer routines.
SELECT role_name, object_name,
 has_table_privilege(role_name,object_name,'SELECT') AS table_select,
 has_table_privilege(role_name,object_name,'INSERT') AS table_insert,
 has_table_privilege(role_name,object_name,'UPDATE') AS table_update,
 has_table_privilege(role_name,object_name,'DELETE') AS table_delete,
 has_table_privilege(role_name,object_name,'TRUNCATE') AS table_truncate,
 has_any_column_privilege(role_name,object_name,'SELECT') AS any_column_select,
 has_any_column_privilege(role_name,object_name,'INSERT') AS any_column_insert,
 has_any_column_privilege(role_name,object_name,'UPDATE') AS any_column_update,
 has_any_column_privilege(role_name,object_name,'REFERENCES') AS any_column_references
FROM (VALUES
 ('drckgomz_auth_runtime','app.posts'),('drckgomz_auth_runtime','app.media'),
 ('drckgomz_auth_runtime','app.home_projects'),('drckgomz_auth_runtime','app.home_project_media'),
 ('drckgomz_auth_runtime','app.user_capabilities'),('drckgomz_auth_runtime','app.security_audit_events'),
 ('drckgomz_auth_runtime','auth.session'),('drckgomz_auth_runtime','auth.user'),
 ('drckgomz_content_reader','app.posts'),('drckgomz_content_reader','app.media'),
 ('drckgomz_content_reader','app.home_projects'),('drckgomz_content_reader','app.home_project_media'),
 ('drckgomz_content_reader','auth.session'),
 ('drckgomz_owner_runtime','app.posts'),('drckgomz_owner_runtime','app.media'),
 ('drckgomz_owner_runtime','app.home_projects'),('drckgomz_owner_runtime','app.home_project_media'),
 ('drckgomz_owner_runtime','app.user_capabilities'),('drckgomz_owner_runtime','app.security_audit_events'),
 ('drckgomz_owner_runtime','app.user_roles'),('drckgomz_owner_runtime','auth.session'),
 ('drckgomz_owner_runtime','auth.user'),
 ('drckgomz_owner_admin','app.posts'),('drckgomz_owner_admin','app.media'),
 ('drckgomz_owner_admin','app.home_projects'),('drckgomz_owner_admin','app.home_project_media'),
 ('drckgomz_owner_admin','app.user_capabilities'),('drckgomz_owner_admin','app.security_audit_events'),
 ('drckgomz_owner_admin','auth.session'),('drckgomz_owner_admin','auth.user'),
 ('drckgomz_owner_admin','app.user_profiles'),('drckgomz_owner_admin','app.user_roles'),
 ('drckgomz_content_reader','app.user_capabilities'),('drckgomz_content_reader','app.security_audit_events'),
 ('drckgomz_content_reader','app.user_roles'),('drckgomz_content_reader','auth.session'),
 ('drckgomz_bootstrap','app.user_roles')
) AS x(role_name,object_name);

-- RLS must be both enabled and forced on all reader-visible tables.
SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity,
       pg_catalog.array_agg(p.policyname ORDER BY p.policyname) FILTER (WHERE p.policyname IS NOT NULL) AS policies
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_catalog.pg_policies p ON p.schemaname=n.nspname AND p.tablename=c.relname
WHERE n.nspname='app' AND c.relname IN ('posts','media','home_projects','home_project_media')
GROUP BY n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity ORDER BY c.relname;

-- Report, do not mutate, possible PUBLIC CONNECT reachability.
SELECT datname, has_database_privilege('drckgomz_auth_runtime',datname,'CONNECT') AS auth_connect,
       has_database_privilege('drckgomz_content_reader',datname,'CONNECT') AS content_connect,
       has_database_privilege('drckgomz_owner_runtime',datname,'CONNECT') AS owner_connect,
       has_database_privilege('drckgomz_bootstrap',datname,'CONNECT') AS bootstrap_connect
FROM pg_catalog.pg_database ORDER BY datname;

-- Owner runtime must execute exactly the two approved owner operations;
-- content/auth identities must not execute either mutation/list function.
SELECT role_name,
  has_function_privilege(role_name,'app_private.list_private_audience_users(text,integer,integer)','EXECUTE') AS can_list_audience,
  has_function_privilege(role_name,'app_private.set_private_journal_access(text,text,boolean)','EXECUTE') AS can_change_audience,
  has_function_privilege(role_name,'app_private.can_read_blog_row(public.publication_state,public.content_visibility,timestamp with time zone,timestamp without time zone,timestamp without time zone)','EXECUTE') AS can_evaluate_content_policy
FROM (VALUES ('drckgomz_auth_runtime'),('drckgomz_content_reader'),('drckgomz_owner_runtime'),('drckgomz_bootstrap')) AS x(role_name);

-- Empty result required: no effective user-defined function execution outside
-- the two explicitly approved owner-management signatures. Compare function
-- OIDs, not names, so an unexpected overload cannot hide behind an allowlisted
-- function name. This also finds PUBLIC EXECUTE inherited through other schemas.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS argument_types
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND pg_catalog.has_function_privilege('drckgomz_owner_runtime',p.oid,'EXECUTE')
  AND NOT (
    COALESCE(p.oid = pg_catalog.to_regprocedure('app_private.list_private_audience_users(text,integer,integer)'), false)
    OR COALESCE(p.oid = pg_catalog.to_regprocedure('app_private.set_private_journal_access(text,text,boolean)'), false)
  )
ORDER BY n.nspname,p.proname;
ROLLBACK;
