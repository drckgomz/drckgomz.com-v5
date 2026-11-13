-- PREPARED ONLY. Run after role creation approval and credential setup.
-- Use this through a connection configured from the dedicated inspector role.
-- It returns only boolean privilege checks, role flags, and catalog estimates.
-- PostgreSQL cannot identify its Neon branch ID. Verify Console branch/endpoint
-- mapping out-of-band before connecting; the connection URL alone is insufficient.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';

DO $identity_guard$
BEGIN
  IF current_database() <> 'neondb' OR current_user <> 'drckgomz_inspector' THEN
    RAISE EXCEPTION 'Inspector verification stopped: unexpected database or role';
  END IF;
END
$identity_guard$;

SELECT current_database() = 'neondb' AS expected_database,
       current_user = 'drckgomz_inspector' AS expected_role,
       current_setting('transaction_read_only') = 'on' AS read_only_transaction;

SELECT r.rolcanlogin,
       r.rolinherit,
       r.rolsuper,
       r.rolcreatedb,
       r.rolcreaterole,
       r.rolreplication,
       r.rolbypassrls,
       r.rolconnlimit,
       pg_catalog.pg_has_role(current_user, 'neon_superuser', 'MEMBER') AS member_of_neon_superuser,
       pg_catalog.pg_has_role(current_user, 'pg_read_all_data', 'MEMBER') AS member_of_read_all_data,
       pg_catalog.pg_has_role(current_user, 'pg_write_all_data', 'MEMBER') AS member_of_write_all_data,
       EXISTS (
         SELECT 1 FROM pg_catalog.pg_roles AS other_role
         WHERE other_role.oid <> r.oid
           AND pg_catalog.pg_has_role(current_user, other_role.oid, 'MEMBER')
       ) AS has_any_role_membership
FROM pg_catalog.pg_roles AS r
WHERE r.rolname = current_user;

SELECT has_database_privilege(current_user, current_database(), 'CONNECT') AS can_connect,
       has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_database_objects,
       has_database_privilege(current_user, current_database(), 'TEMP') AS can_create_temp_tables,
       EXISTS (
         SELECT 1 FROM pg_catalog.pg_database AS d
         WHERE d.datname = current_database()
           AND d.datdba = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
       ) AS owns_database;

-- Schema/catalogs are inspectable through PostgreSQL metadata without granting
-- USAGE on application schemas. Any CREATE flag here is a fail condition.
SELECT coalesce(bool_or(has_schema_privilege(current_user, n.oid, 'CREATE')), false) AS can_create_in_any_non_system_schema,
       coalesce(bool_or(n.nspowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)), false) AS owns_any_non_system_schema,
       count(*) AS non_system_schema_count
FROM pg_catalog.pg_namespace AS n
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%';

-- Must report false for every application-data access/write capability. This
-- checks effective ACLs (including grants inherited through PUBLIC/roles).
SELECT coalesce(bool_or(has_table_privilege(current_user, c.oid, 'SELECT')), false) AS can_read_any_non_system_relation,
       coalesce(bool_or(has_table_privilege(current_user, c.oid, 'INSERT')), false) AS can_insert_any_non_system_relation,
       coalesce(bool_or(has_table_privilege(current_user, c.oid, 'UPDATE')), false) AS can_update_any_non_system_relation,
       coalesce(bool_or(has_table_privilege(current_user, c.oid, 'DELETE')), false) AS can_delete_any_non_system_relation,
       coalesce(bool_or(has_table_privilege(current_user, c.oid, 'TRUNCATE')), false) AS can_truncate_any_non_system_relation,
       coalesce(bool_or(has_table_privilege(current_user, c.oid, 'REFERENCES')), false) AS can_reference_any_non_system_relation,
       coalesce(bool_or(has_table_privilege(current_user, c.oid, 'TRIGGER')), false) AS can_trigger_any_non_system_relation,
       coalesce(bool_or(has_table_privilege(current_user, c.oid, 'MAINTAIN')), false) AS can_maintain_any_non_system_relation,
       coalesce(bool_or(c.relowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)), false) AS owns_any_non_system_relation
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%';

SELECT coalesce(bool_or(has_sequence_privilege(current_user, c.oid, 'SELECT')), false) AS can_read_any_non_system_sequence,
       coalesce(bool_or(has_sequence_privilege(current_user, c.oid, 'USAGE')), false) AS can_use_any_non_system_sequence,
       coalesce(bool_or(has_sequence_privilege(current_user, c.oid, 'UPDATE')), false) AS can_update_any_non_system_sequence,
       coalesce(bool_or(c.relowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)), false) AS owns_any_non_system_sequence
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relkind = 'S'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%';

-- A callable SECURITY DEFINER routine can expose or mutate data despite the
-- absence of table SELECT. Any nonzero result is a fail condition.
SELECT count(*) FILTER (
         WHERE p.prosecdef
           AND has_schema_privilege(current_user, n.oid, 'USAGE')
           AND has_function_privilege(current_user, p.oid, 'EXECUTE')
       ) AS callable_non_system_security_definer_routines
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%';

SELECT coalesce(bool_or(p.proowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)), false)
         AS owns_any_non_system_routine
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%';

-- Default ACLs can expose objects created later. Require zero table/sequence
-- read-write grants and zero function EXECUTE grants to PUBLIC or this role;
-- re-run after any schema migration.
SELECT count(*) AS unsafe_default_acl_entries
FROM pg_catalog.pg_default_acl AS d
CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) AS acl
WHERE acl.grantee IN (
        0,
        (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
      )
  AND (
    (d.defaclobjtype = 'r' AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'))
    OR (d.defaclobjtype = 'S' AND acl.privilege_type IN ('SELECT', 'USAGE', 'UPDATE'))
    OR (d.defaclobjtype = 'f' AND acl.privilege_type = 'EXECUTE')
  );

-- Approximate row estimates only; these read planner metadata, not application
-- rows. NULL means statistics are not available. Exact COUNT(*) is prohibited
-- for this role because SELECT would expose record contents.
SELECT n.nspname AS schema_name,
       c.relname AS relation_name,
       CASE WHEN c.reltuples < 0 THEN NULL
            ELSE round(c.reltuples)::bigint END AS estimated_rows
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
ORDER BY n.nspname, c.relname;

ROLLBACK;
