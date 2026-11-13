-- Read-only inventory for a separately approved Neon development connection.
-- Run only after the Neon Console identity checklist in docs/PHASE3F_NEON_PREFLIGHT.md.
-- No row payloads, credentials, emails, or application records are selected.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';

-- Connection facts. Host/branch identity must be matched against Neon Console/API
-- evidence; current_database() and current_user alone do not prove branch purpose.
SELECT current_database() AS database_name,
       current_setting('server_version') AS postgres_version,
       current_setting('transaction_read_only') AS transaction_read_only;

-- Existing non-system schemas, tables, views, and enum/type names. This detects
-- name collisions with the generated migration before any DDL is considered.
SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       c.relkind AS object_kind
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
ORDER BY n.nspname, c.relname;

-- Index definitions are catalog metadata and do not inspect indexed values.
SELECT ns.nspname AS schema_name,
       tbl.relname AS table_name,
       idx.relname AS index_name,
       i.indisprimary AS is_primary,
       i.indisunique AS is_unique,
       i.indisvalid AS is_valid,
       pg_get_indexdef(i.indexrelid) AS index_definition
FROM pg_catalog.pg_index AS i
JOIN pg_catalog.pg_class AS idx ON idx.oid = i.indexrelid
JOIN pg_catalog.pg_class AS tbl ON tbl.oid = i.indrelid
JOIN pg_catalog.pg_namespace AS ns ON ns.oid = tbl.relnamespace
WHERE ns.nspname NOT IN ('pg_catalog', 'information_schema')
  AND ns.nspname NOT LIKE 'pg_toast%'
ORDER BY ns.nspname, tbl.relname, idx.relname;

-- Constraint definitions include primary/unique/check/exclusion constraints.
SELECT ns.nspname AS schema_name,
       tbl.relname AS table_name,
       con.conname AS constraint_name,
       con.contype AS constraint_kind,
       pg_get_constraintdef(con.oid, true) AS constraint_definition
FROM pg_catalog.pg_constraint AS con
JOIN pg_catalog.pg_class AS tbl ON tbl.oid = con.conrelid
JOIN pg_catalog.pg_namespace AS ns ON ns.oid = tbl.relnamespace
WHERE ns.nspname NOT IN ('pg_catalog', 'information_schema')
  AND ns.nspname NOT LIKE 'pg_toast%'
ORDER BY ns.nspname, tbl.relname, con.conname;

-- Foreign-key relationships are separated for compatibility review.
SELECT ns.nspname AS schema_name,
       tbl.relname AS table_name,
       con.conname AS foreign_key_name,
       pg_get_constraintdef(con.oid, true) AS foreign_key_definition
FROM pg_catalog.pg_constraint AS con
JOIN pg_catalog.pg_class AS tbl ON tbl.oid = con.conrelid
JOIN pg_catalog.pg_namespace AS ns ON ns.oid = tbl.relnamespace
WHERE con.contype = 'f'
  AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
  AND ns.nspname NOT LIKE 'pg_toast%'
ORDER BY ns.nspname, tbl.relname, con.conname;

SELECT n.nspname AS schema_name,
       t.typname AS type_name,
       t.typtype AS type_kind
FROM pg_catalog.pg_type AS t
JOIN pg_catalog.pg_namespace AS n ON n.oid = t.typnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND t.typtype IN ('e', 'd')
ORDER BY n.nspname, t.typname;

-- Effective permissions for the connected role only. No role/password data is
-- selected. This is a useful guard even when the caller is expected to be RO.
SELECT current_database() AS database_name,
       has_database_privilege(current_user, current_database(), 'CONNECT') AS can_connect,
       has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_in_database,
       has_database_privilege(current_user, current_database(), 'TEMP') AS can_create_temp;

SELECT n.nspname AS schema_name,
       has_schema_privilege(current_user, n.oid, 'USAGE') AS can_use_schema,
       has_schema_privilege(current_user, n.oid, 'CREATE') AS can_create_in_schema
FROM pg_catalog.pg_namespace AS n
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
ORDER BY n.nspname;

SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
       has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,
       has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
       has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete,
       has_table_privilege(current_user, c.oid, 'TRUNCATE') AS can_truncate,
       has_table_privilege(current_user, c.oid, 'REFERENCES') AS can_reference,
       has_table_privilege(current_user, c.oid, 'TRIGGER') AS can_trigger
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
ORDER BY n.nspname, c.relname;

-- Existing Drizzle migration history, if present. Missing table means fresh
-- target; this query intentionally does not read migration records.
SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS drizzle_migration_ledger_exists;

-- Approximate planner row estimates only. Exact COUNT(*) requires table SELECT,
-- which would grant access to application record contents and is intentionally
-- excluded from this preflight. A value of NULL means statistics are unknown.
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
