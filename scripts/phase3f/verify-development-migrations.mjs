#!/usr/bin/env node

/** Read-only catalog verification for the explicitly approved Neon dev target. */
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDevelopmentMigrationManifest } from "./development-migration-manifest.mjs";

const target = {
  endpoint: "ep-sparkling-sun-bedq0ozn",
  hostname: "ep-sparkling-sun-bedq0ozn.c-9.us-east-2.aws.neon.tech",
  database: "neondb",
  role: "neondb_owner",
  major: "18",
};
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = loadDevelopmentMigrationManifest(root);
const expected = manifest.migrations.map(({ sha256 }) => sha256);
const artifact = resolve(root, ".artifacts/phase3h/neon-postmigration-verify.log");

function fail(message) {
  console.error(`STOP: ${message}`);
  process.exit(2);
}

const ignored = spawnSync("git", ["check-ignore", "-q", ".env.neon.development.local"], { cwd: root, stdio: "ignore" });
if (ignored.status !== 0) fail("the explicit development env file is not Git-ignored");
let contents;
try { contents = readFileSync(resolve(root, ".env.neon.development.local"), "utf8"); }
catch { fail("the explicit development env file is unavailable"); }
const match = contents.match(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*?)\s*$/m);
if (!match) fail("DATABASE_URL is missing from the explicit development env file");
let url;
try {
  let value = match[1].trim();
  if ((value[0] === "\"" || value[0] === "'") && value.at(-1) === value[0]) value = value.slice(1, -1);
  url = new URL(value);
} catch { fail("the development URL is invalid"); }
if (url.hostname !== target.hostname
    || decodeURIComponent(url.pathname.replace(/^\//, "")) !== target.database
    || decodeURIComponent(url.username) !== target.role
    || !url.password) fail("the explicit URL target does not match development");
url.searchParams.set("sslmode", "require");

const { Pool } = await import("@neondatabase/serverless");
const pool = new Pool({ connectionString: url.toString(), max: 1, connectionTimeoutMillis: 10_000 });
let output = "";
const record = (label, rows) => { output += `\n## ${label}\n${JSON.stringify(rows, null, 2)}\n`; };
try {
  await pool.query("BEGIN READ ONLY");
  await pool.query("SET LOCAL statement_timeout = '15s'");
  const facts = (await pool.query(`SELECT current_database() AS database_name, current_setting('server_version') AS postgres_version, current_setting('transaction_read_only') AS transaction_read_only, current_user = $1 AS expected_role`, [target.role])).rows;
  if (facts[0]?.database_name !== target.database || !facts[0]?.expected_role
      || String(facts[0]?.postgres_version).split(".")[0] !== target.major
      || facts[0]?.transaction_read_only !== "on") fail("connected database, role, version, or read-only state did not match");
  record("connection_facts", facts);
  record("schemas", (await pool.query(`SELECT nspname AS schema_name FROM pg_catalog.pg_namespace WHERE nspname NOT IN ('pg_catalog','information_schema') AND nspname NOT LIKE 'pg_toast%' ORDER BY nspname`)).rows);
  record("relations", (await pool.query(`SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relkind AS relation_kind, CASE WHEN c.reltuples < 0 THEN NULL ELSE round(c.reltuples)::bigint END AS estimated_rows FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','f','S') ORDER BY n.nspname,c.relname`)).rows);
  record("indexes", (await pool.query(`SELECT n.nspname AS schema_name, t.relname AS table_name, i.relname AS index_name, x.indisprimary AS is_primary, x.indisunique AS is_unique, x.indisvalid AS is_valid, pg_get_indexdef(x.indexrelid) AS definition FROM pg_catalog.pg_index x JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid JOIN pg_catalog.pg_class t ON t.oid=x.indrelid JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' ORDER BY n.nspname,t.relname,i.relname`)).rows);
  record("constraints", (await pool.query(`SELECT n.nspname AS schema_name, t.relname AS table_name, c.conname AS constraint_name, c.contype AS constraint_kind, pg_get_constraintdef(c.oid,true) AS definition FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' ORDER BY n.nspname,t.relname,c.conname`)).rows);
  record("custom_types", (await pool.query(`SELECT n.nspname AS schema_name, t.typname AS type_name, t.typtype AS type_kind FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND t.typtype IN ('e','d') ORDER BY n.nspname,t.typname`)).rows);
  record("schema_permissions", (await pool.query(`SELECT n.nspname AS schema_name, has_schema_privilege(current_user,n.oid,'USAGE') AS can_use, has_schema_privilege(current_user,n.oid,'CREATE') AS can_create FROM pg_catalog.pg_namespace n WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' ORDER BY n.nspname`)).rows);
  const ledgerExists = (await pool.query("SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present")).rows[0].present;
  let ledger = [];
  if (ledgerExists) ledger = (await pool.query("SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id")).rows;
  record("migration_ledger", { present: ledgerExists, entries: ledger });
  const recognizedLedgerState = (ledger.length === 3 || ledger.length === 4) &&
    ledger.every((row, index) => row.hash === expected[index]);
  const checks = {
    ledger_is_known_pre_or_post_0003_state: recognizedLedgerState,
    applied_migration_count: ledger.length,
    phase3h_migrations_match: ledger.length >= 3 && ledger.slice(0, 3).every((row, index) => row.hash === expected[index]),
    migration_0003_applied: ledger.length === 4 && ledger[3]?.hash === expected[3],
  };
  record("verification", checks);
  await pool.query("ROLLBACK");
  output += "\nRead-only transaction rolled back. No application records queried.\n";
  mkdirSync(dirname(artifact), { recursive: true });
  writeFileSync(artifact, output, { mode: 0o600 });
  chmodSync(artifact, 0o600);
  process.stdout.write(output);
  process.stdout.write("Artifact: .artifacts/phase3h/neon-postmigration-verify.log (mode 0600)\n");
  if (!checks.ledger_is_known_pre_or_post_0003_state || !checks.phase3h_migrations_match ||
      (ledger.length === 4 && !checks.migration_0003_applied)) process.exitCode = 1;
} catch {
  await pool.query("ROLLBACK").catch(() => {});
  console.error("Verification stopped or failed; raw diagnostics were suppressed. No repair was attempted.");
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
