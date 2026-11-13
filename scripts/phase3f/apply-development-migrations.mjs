#!/usr/bin/env node

/**
 * Fail-closed, development-only Drizzle migration runner.
 *
 * This script never loads .env.local or process.env.DATABASE_URL. It is not an
 * approval mechanism: a separate explicit approval is still required before
 * invoking it with --apply.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDevelopmentMigrationManifest } from "./development-migration-manifest.mjs";

const target = Object.freeze({
  project: "jolly-poetry-87664309",
  branch: "br-nameless-dust-bewpmr4r",
  endpoint: "ep-sparkling-sun-bedq0ozn",
  hostname: "ep-sparkling-sun-bedq0ozn.c-9.us-east-2.aws.neon.tech",
  database: "neondb",
  role: "neondb_owner",
  postgresMajor: "18",
});

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envFile = resolve(root, ".env.neon.development.local");
const migrationsFolder = resolve(root, "drizzle");
const migrationLockKey = "73426190815524361";

function stop(message) {
  console.error(`STOP: ${message}`);
  process.exit(2);
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function validateMigrationManifest() {
  let manifest;
  try { manifest = loadDevelopmentMigrationManifest(root); }
  catch { stop("the development migration manifest, journal, SQL files, or snapshots differ from reviewed state"); }
  if (JSON.stringify(manifest.target) !== JSON.stringify({
    project: target.project, branch: target.branch, endpoint: target.endpoint,
    hostname: target.hostname, database: target.database, postgresMajor: target.postgresMajor,
  })) stop("the development migration manifest target differs from the pinned runner target");
}

function readExplicitDatabaseUrl() {
  const ignored = spawnSync("git", ["check-ignore", "-q", ".env.neon.development.local"], {
    cwd: root,
    stdio: "ignore",
  });
  if (ignored.status !== 0) stop("the explicit Neon development file is not Git-ignored");

  let contents;
  try {
    contents = readFileSync(envFile, "utf8");
  } catch {
    stop("the explicit Neon development file is unavailable");
  }

  const match = contents.match(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*?)\s*$/m);
  if (!match) stop("DATABASE_URL is missing from the explicit Neon development file");

  let value = match[1].trim();
  if ((value.charCodeAt(0) === 34 || value.charCodeAt(0) === 39) && value.at(-1) === value[0]) {
    value = value.slice(1, -1);
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    stop("the explicit Neon development URL is invalid");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const role = decodeURIComponent(url.username);
  if (!(["postgres:", "postgresql:"].includes(url.protocol))) stop("the explicit URL is not PostgreSQL");
  if (url.hostname !== target.hostname) stop("the endpoint hostname does not match development");
  if (database !== target.database) stop("the database name does not match the approved target");
  if (role !== target.role) stop("the configured role is not the expected development migration role");
  if (!url.password) stop("the explicit development URL has no password");

  // Require encrypted transport while preserving all other URL parameters.
  url.searchParams.set("sslmode", "require");
  return url.toString();
}

async function main() {
  if (process.argv.includes("--check-config")) {
    validateMigrationManifest();
    readExplicitDatabaseUrl();
    console.log("Local target configuration and reviewed migration checksums are valid; no database connection was made.");
    return;
  }

  if (!process.argv.includes("--apply")) {
    console.error("No action taken. This runner requires --apply and a separate explicit approval.");
    process.exit(2);
  }

  if (argumentValue("--project-id") !== target.project) stop("project confirmation does not match");
  if (argumentValue("--branch-id") !== target.branch) stop("branch confirmation does not match");
  if (argumentValue("--endpoint-id") !== target.endpoint) stop("endpoint confirmation does not match");
  if (argumentValue("--database") !== target.database) stop("database confirmation does not match");
  if (!process.argv.includes("--confirm-schema-application")) {
    stop("the explicit schema-application confirmation flag is required");
  }

  validateMigrationManifest();
  const connectionString = readExplicitDatabaseUrl();
  const [{ Pool }, { drizzle }, { migrate }] = await Promise.all([
    import("@neondatabase/serverless"),
    import("drizzle-orm/neon-serverless"),
    import("drizzle-orm/neon-serverless/migrator"),
  ]);
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
  let migrationLockAcquired = false;

  try {
    const identity = await pool.query(
      "SELECT current_database() AS database_name, current_user AS role_name, current_setting('server_version_num') AS version_num",
    );
    const row = identity.rows[0];
    if (row?.database_name !== target.database || row?.role_name !== target.role) {
      stop("connected database or role did not match the approved development target");
    }
    if (String(row.version_num).slice(0, 2) !== target.postgresMajor) {
      stop("the PostgreSQL major version differs from the reviewed target");
    }

    // Serialize local migration attempts. max: 1 keeps this session lock on
    // the same pooled connection used by Drizzle's migrator.
    const lock = await pool.query("SELECT pg_try_advisory_lock($1::bigint) AS acquired", [migrationLockKey]);
    migrationLockAcquired = lock.rows[0]?.acquired === true;
    if (!migrationLockAcquired) stop("another development migration runner holds the migration lock");

    // The SQL connection cannot attest Neon project/branch IDs. The exact
    // endpoint is checked above; the operator must reverify branch mapping in
    // Neon Console immediately before execution.
    const preflight = await pool.query(`
      SELECT
        to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS has_ledger,
        EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname <> 'public'
          AND nspname <> 'pg_catalog' AND nspname <> 'information_schema'
          AND nspname NOT LIKE 'pg_toast%') AS has_nonpublic_schema,
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_class AS c
          JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
        ) AS has_public_relation,
        EXISTS (
          SELECT 1
          FROM pg_catalog.pg_type AS t
          JOIN pg_catalog.pg_namespace AS n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd', 'c', 'r', 'm')
        ) AS has_public_custom_type,
        EXISTS (
          SELECT 1 FROM pg_catalog.pg_proc AS p
          JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public'
        ) AS has_public_routine
    `);
    const state = preflight.rows[0];
    if (state?.has_ledger || state?.has_nonpublic_schema || state?.has_public_relation
      || state?.has_public_custom_type || state?.has_public_routine) {
      stop("the database is no longer empty of migration target objects; review it manually");
    }

    await pool.query("SET statement_timeout = '60s'");
    await pool.query("SET lock_timeout = '5s'");
    const db = drizzle(pool);
    await migrate(db, {
      migrationsFolder,
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });
    console.log("Drizzle migrations completed on the explicitly confirmed development target.");
  } catch {
    // Driver errors can include host, database, role, or connection details.
    console.error("Migration stopped or failed. Raw diagnostics were suppressed; inspect the development branch separately.");
    process.exitCode = 1;
  } finally {
    if (migrationLockAcquired) {
      await pool.query("SELECT pg_advisory_unlock($1::bigint)", [migrationLockKey]).catch(() => {});
    }
    await pool.end().catch(() => {});
  }
}

await main();
