#!/usr/bin/env node
/**
 * Read-only evidence collector for a separately approved Neon development
 * rehearsal. Never run it without fresh independent Neon Console attestation.
 * It queries catalog/aggregate state only and writes a mode-0600 local report.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDevelopmentMigrationManifest } from "./development-migration-manifest.mjs";
import { classifyMigrationHistory, createIncrementalMigrationPlan } from "./incremental-migration-plan.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = resolve(root, ".env.neon.development.local");
const outputPath = resolve(root, ".artifacts/phase3f/incremental-migration-evidence.json");
const target = Object.freeze({
  project: "jolly-poetry-87664309", branch: "br-nameless-dust-bewpmr4r",
  endpoint: "ep-sparkling-sun-bedq0ozn", hostname: "ep-sparkling-sun-bedq0ozn.c-9.us-east-2.aws.neon.tech",
  database: "neondb", postgresMajor: "18", role: "neondb_owner",
});
const stagingTables = ["bug_reports", "content", "content_media", "media", "post_media", "posts", "users"];
const appTables = ["categories", "home_media", "home_project_media", "home_projects", "home_sections", "media", "post_categories", "post_tags", "posts", "security_audit_events", "tags", "terminal_commands", "user_capabilities", "user_profiles", "user_roles"];
const authTables = ["account", "session", "user", "verification"];

function stop(message) {
  throw new Error(message);
}

function value(flag) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}

function verifyAttestation(manifest) {
  if (!process.argv.includes("--collect-read-only-evidence") || !process.argv.includes("--console-attested")) {
    stop("read-only collection requires its explicit mode and fresh Console attestation flags");
  }
  const actual = {
    project: value("--project-id"), branch: value("--branch-id"), endpoint: value("--endpoint-id"),
    hostname: value("--hostname"), database: value("--database"), postgresMajor: value("--postgres-major"),
  };
  if (Object.entries(target).some(([key, expected]) => actual[key] !== expected) ||
      Object.entries(manifest.target).some(([key, expected]) => target[key] !== expected)) {
    stop("supplied target attestation does not match the pinned development target");
  }
}

function explicitDevelopmentUrl() {
  const ignored = spawnSync("git", ["check-ignore", "-q", ".env.neon.development.local"], { cwd: root, stdio: "ignore" });
  if (ignored.status !== 0) stop("the explicit Neon development file is not Git-ignored");
  let contents;
  try { contents = readFileSync(envPath, "utf8"); }
  catch { stop("the explicit Neon development file is unavailable"); }
  const match = contents.match(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*?)\s*$/m);
  if (!match) stop("DATABASE_URL is missing from the explicit development file");
  let raw = match[1].trim();
  if ((raw[0] === "\"" || raw[0] === "'") && raw.at(-1) === raw[0]) raw = raw.slice(1, -1);
  let url;
  try { url = new URL(raw); }
  catch { stop("the explicit development URL is invalid"); }
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol) || url.hostname !== target.hostname ||
      !new Set(["", "5432"]).has(url.port) ||
      decodeURIComponent(url.pathname.slice(1)) !== target.database || decodeURIComponent(url.username) !== target.role ||
      !url.password || url.hash || !new Set(["require", "verify-full"]).has(url.searchParams.get("sslmode") ?? "")) {
    stop("the explicit URL does not match the pinned development database and role");
  }
  const allowedParameters = new Set(["sslmode", "channel_binding", "application_name", "connect_timeout", "pool_timeout"]);
  const seenParameters = new Set();
  for (const [key] of url.searchParams) {
    if (!allowedParameters.has(key) || seenParameters.has(key)) stop("the explicit URL has an unsupported or repeated parameter");
    seenParameters.add(key);
  }
  return url.toString();
}

function countQuery(schema, table) {
  if (schema === "auth" && table === "user") return 'SELECT count(*)::bigint AS n FROM auth."user"';
  return `SELECT count(*)::bigint AS n FROM ${schema}."${table}"`;
}

function normalizedExpression(value) {
  return value.toLowerCase().replace(/"/g, "").replace(/pg_catalog\./g, "")
    .replace(/::(?:name|text)\b/g, "").replace(/\s+/g, "");
}

async function main() {
  if (!process.argv.includes("--collect-read-only-evidence")) {
    process.stderr.write("No action taken. Supply the explicit read-only collection and Console attestation flags.\n");
    process.exitCode = 2;
    return;
  }
  const manifest = loadDevelopmentMigrationManifest(root);
  verifyAttestation(manifest);
  if (existsSync(outputPath)) stop("the evidence artifact already exists; refusing to overwrite it");
  const connectionString = explicitDevelopmentUrl();
  const { Pool } = await import("@neondatabase/serverless");
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 5_000 });
  let client;
  let transactionOpen = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    transactionOpen = true;
    await client.query("SET LOCAL statement_timeout = '15s'");

    const identity = (await client.query(`SELECT current_database() AS database_name,
      current_user AS role_name, current_setting('server_version_num') AS version_num,
      current_setting('transaction_read_only') AS read_only`)).rows[0];
    if (identity?.database_name !== target.database || identity?.role_name !== target.role ||
        String(identity?.version_num).slice(0, 2) !== target.postgresMajor || identity?.read_only !== "on") {
      stop("connected database, role, version, or read-only state did not match");
    }

    const schemas = (await client.query(`SELECT nspname FROM pg_catalog.pg_namespace
      WHERE nspname NOT IN ('pg_catalog','information_schema') AND nspname NOT LIKE 'pg_toast%'
      ORDER BY nspname`)).rows.map((row) => row.nspname);
    const relations = (await client.query(`SELECT n.nspname || '.' || c.relname AS name
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
        AND c.relkind IN ('r','p','v','m','f','S') ORDER BY name`)).rows.map((row) => row.name);
    const enums = (await client.query(`SELECT n.nspname || '.' || t.typname AS name FROM pg_catalog.pg_type t
      JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE t.typtype='e'
        AND n.nspname NOT IN ('pg_catalog','information_schema') ORDER BY name`)).rows.map((row) => row.name);
    const routines = (await client.query(`SELECT n.nspname || '.' || p.proname AS name FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
      ORDER BY name`)).rows.map((row) => row.name);
    const ledgerExists = (await client.query("SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present")).rows[0].present;
    const ledgerHashes = ledgerExists
      ? (await client.query("SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id")).rows.map((row) => row.hash)
      : [];

    const relationSet = new Set(relations);
    const stagingCounts = {};
    for (const table of stagingTables) {
      const name = `legacy.${table}`;
      stagingCounts[name] = relationSet.has(name) ? Number((await client.query(countQuery("legacy", table))).rows[0].n) : 0;
    }
    const provenanceRows = relationSet.has("ops.legacy_entity_map")
      ? Number((await client.query("SELECT count(*)::bigint AS n FROM ops.legacy_entity_map")).rows[0].n) : 0;
    const importRuns = relationSet.has("ops.legacy_import_runs")
      ? Number((await client.query("SELECT count(*)::bigint AS n FROM ops.legacy_import_runs")).rows[0].n) : 0;
    let applicationRows = 0;
    for (const table of appTables) if (relationSet.has(`app.${table}`)) applicationRows += Number((await client.query(countQuery("app", table))).rows[0].n);
    let authenticationRows = 0;
    for (const table of authTables) if (relationSet.has(`auth.${table}`)) authenticationRows += Number((await client.query(countQuery("auth", table))).rows[0].n);

    const sessionColumn = (await client.query(`SELECT a.attgenerated = 's' AS generated_stored,
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
      pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS expression
      FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef d
        ON d.adrelid=a.attrelid AND d.adnum=a.attnum
      WHERE a.attrelid=pg_catalog.to_regclass('auth.session') AND a.attname='token_sha256'
        AND a.attnum > 0 AND NOT a.attisdropped`)).rows[0];
    const sessionTokenColumn = (await client.query(`SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
      a.attnotnull AS not_null FROM pg_catalog.pg_attribute a
      WHERE a.attrelid=pg_catalog.to_regclass('auth.session') AND a.attname='token'
        AND a.attnum > 0 AND NOT a.attisdropped`)).rows[0];
    const expectedExpression = "encode(sha256(convert_to(token,'utf8')),'hex')";
    const sessionDigestColumn = sessionColumn?.generated_stored === true && sessionColumn.data_type === "text";
    const sessionDigestDefinitionMatches = sessionDigestColumn &&
      normalizedExpression(sessionColumn.expression ?? "") === expectedExpression;
    const sessionTokenColumnMatches = sessionTokenColumn?.data_type === "text" && sessionTokenColumn.not_null === true;
    const sessionDigestIndexes = (await client.query(`SELECT i.relname AS name, ni.nspname AS schema_name,
      nt.nspname AS table_schema, t.relname AS table_name, x.indexrelid IS NOT NULL AS is_index,
      x.indisunique AS is_unique, x.indisvalid AS valid FROM pg_catalog.pg_class i
      JOIN pg_catalog.pg_namespace ni ON ni.oid=i.relnamespace
      LEFT JOIN pg_catalog.pg_index x ON x.indexrelid=i.oid
      LEFT JOIN pg_catalog.pg_class t ON t.oid=x.indrelid
      LEFT JOIN pg_catalog.pg_namespace nt ON nt.oid=t.relnamespace
      WHERE i.relname='auth_session_token_sha256_uq'`)).rows
      .map((row) => ({ name: row.name, schema: row.schema_name, tableSchema: row.table_schema,
        table: row.table_name, isIndex: row.is_index, unique: row.is_unique, valid: row.valid }));

    const evidence = {
      evidenceVersion: 1,
      target,
      connection: { database: identity.database_name, postgresMajor: target.postgresMajor, role: identity.role_name, transactionReadOnly: identity.read_only === "on" },
      ledgerHashes,
      catalog: { schemas, relations, enums, routines, sessionDigestColumn,
        sessionDigestDefinitionMatches, sessionTokenColumnMatches, sessionDigestIndexes },
      stagingCounts, provenanceRows, importRuns, applicationRows, authenticationRows,
    };
    classifyMigrationHistory(evidence, manifest);
    const attestation = { consoleAttested: true, ...target };
    const plan = createIncrementalMigrationPlan({ evidence, attestation, root });

    await client.query("ROLLBACK");
    transactionOpen = false;
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    chmodSync(outputPath, 0o600);
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    process.stdout.write("Read-only transaction rolled back. Evidence contains catalog and aggregate counts only.\n");
  } catch {
    if (transactionOpen && client) await client.query("ROLLBACK").catch(() => {});
    process.stderr.write("Read-only evidence collection stopped; raw diagnostics suppressed. No retry or repair attempted.\n");
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end().catch(() => {});
  }
}

await main().catch((error) => {
  process.stderr.write(`STOP: ${error instanceof Error ? error.message : "preflight failed"}; no retry attempted\n`);
  process.exitCode = 2;
});
