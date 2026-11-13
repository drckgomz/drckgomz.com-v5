#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSafeInsertRow, INSERT_ORDER, MAPPING_VERSION, parseLegacyDump, SOURCE_TABLES } from "./legacy-source.mjs";
import { loadDevelopmentMigrationManifest } from "../phase3f/development-migration-manifest.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const backupPath = "/Volumes/DEV-LAB/Projects/Private-Backups/db_cluster-15-06-2025@15-25-31.backup";
const artifactPath = resolve(root, ".artifacts/phase3e/backup-inspection.json");
const outputPath = resolve(root, ".artifacts/phase3i/read-only-import-verification.log");
const target = { endpoint: "ep-sparkling-sun-bedq0ozn", hostname: "ep-sparkling-sun-bedq0ozn.c-9.us-east-2.aws.neon.tech", database: "neondb", role: "neondb_owner", major: "18" };
const hashes = loadDevelopmentMigrationManifest(root).migrations.map(({ sha256 }) => sha256);
const counts = { bug_reports: 3, content: 6, content_media: 3, media: 10, post_media: 2, posts: 2, users: 2 };
const rootImportTables = INSERT_ORDER;

function fail(message) { console.error(`STOP: ${message}`); process.exit(2); }
function deterministicRunId(fingerprint) {
  const bytes = createHash("sha256").update(`${fingerprint}:${MAPPING_VERSION}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const ignored = spawnSync("git", ["check-ignore", "-q", ".env.neon.development.local"], { cwd: root, stdio: "ignore" });
if (ignored.status !== 0) fail("explicit development env file is not Git-ignored");
let envText;
try { envText = readFileSync(resolve(root, ".env.neon.development.local"), "utf8"); } catch { fail("explicit development env file is unavailable"); }
const match = envText.match(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*?)\s*$/m);
if (!match) fail("DATABASE_URL is missing from explicit development env file");
let url;
try { let value = match[1].trim(); if ((value[0] === "\"" || value[0] === "'") && value.at(-1) === value[0]) value = value.slice(1, -1); url = new URL(value); }
catch { fail("development URL is invalid"); }
if (url.hostname !== target.hostname || decodeURIComponent(url.pathname.slice(1)) !== target.database
    || decodeURIComponent(url.username) !== target.role || !url.password || !["postgres:", "postgresql:"].includes(url.protocol)) fail("development URL does not match the approved endpoint/database/role");
url.searchParams.set("sslmode", "require");

const backup = readFileSync(backupPath);
const inventory = JSON.parse(readFileSync(artifactPath, "utf8"));
const source = parseLegacyDump(backup);
if (source.fingerprint !== inventory.sha256 || backup.byteLength !== inventory.sizeBytes || JSON.stringify(source.counts) !== JSON.stringify(counts)) fail("backup does not match the reviewed source inventory");
const runId = deterministicRunId(source.fingerprint);
const { Pool } = await import("@neondatabase/serverless");
const pool = new Pool({ connectionString: url.toString(), max: 1, connectionTimeoutMillis: 10_000 });
let client; let inTransaction = false;
try {
  client = await pool.connect();
  await client.query("BEGIN READ ONLY"); inTransaction = true;
  await client.query("SET LOCAL statement_timeout = '15s'");
  const facts = (await client.query("SELECT current_database() AS database_name, current_setting('server_version') AS postgres_version, current_setting('transaction_read_only') AS read_only, current_user = $1 AS role_ok", [target.role])).rows[0];
  if (facts.database_name !== target.database || !facts.role_ok || String(facts.postgres_version).split(".")[0] !== target.major || facts.read_only !== "on") throw new Error("database identity/read-only check failed");
  const dbHashes = (await client.query("SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id")).rows.map((row) => row.hash);
  if (!((dbHashes.length === 3 || dbHashes.length === 4) &&
      dbHashes.every((hash, index) => hash === hashes[index]))) throw new Error("migration ledger mismatch");
  const actualCounts = {};
  for (const table of Object.keys(SOURCE_TABLES)) actualCounts[table] = (await client.query(`SELECT count(*)::int AS count FROM legacy."${table}"`)).rows[0].count;
  const expectedTargetCounts = Object.fromEntries(Object.keys(SOURCE_TABLES).map((table) => [table, rootImportTables.includes(table) ? counts[table] : 0]));
  const provenanceRows = (await client.query("SELECT source_table, review_state, count(*)::int AS count FROM ops.legacy_entity_map WHERE run_id=$1 GROUP BY source_table, review_state ORDER BY source_table, review_state", [runId])).rows;
  let provenanceMatches = 0;
  for (const table of INSERT_ORDER) {
    for (const row of source.rows[table]) {
      const built = buildSafeInsertRow(table, row);
      const matches = built.columns.map((column, index) => `"${column}" IS NOT DISTINCT FROM $${index + 1}`).join(" AND ");
      const contentMatches = (await client.query(`SELECT EXISTS (SELECT 1 FROM legacy."${table}" WHERE ${matches}) AS present`, built.values)).rows[0].present;
      const mapMatches = (await client.query("SELECT EXISTS (SELECT 1 FROM ops.legacy_entity_map WHERE run_id=$1 AND source_table=$2 AND source_id=$3 AND target_schema='legacy' AND target_table=$2 AND target_id=$3 AND review_state='quarantined') AS present", [runId, table, String(row.id)])).rows[0].present;
      if (!contentMatches || !mapMatches) throw new Error("source/provenance identity verification failed");
      provenanceMatches += 1;
    }
  }
  const run = (await client.query("SELECT status, source_fingerprint, mapping_version, report FROM ops.legacy_import_runs WHERE id=$1", [runId])).rows[0] ?? null;
  const orphanResult = (await client.query(`
    SELECT
      (SELECT count(*) FROM legacy.content c LEFT JOIN legacy.media m ON m.id=c.media_id WHERE c.media_id IS NOT NULL AND m.id IS NULL)::int AS content_media,
      (SELECT count(*) FROM legacy.content_media x LEFT JOIN legacy.content c ON c.id=x.content_id LEFT JOIN legacy.media m ON m.id=x.media_id WHERE c.id IS NULL OR m.id IS NULL)::int AS content_gallery,
      (SELECT count(*) FROM legacy.post_media x LEFT JOIN legacy.posts p ON p.id=x.post_id LEFT JOIN legacy.media m ON m.id=x.media_id WHERE (x.post_id IS NOT NULL AND p.id IS NULL) OR (x.media_id IS NOT NULL AND m.id IS NULL))::int AS post_gallery
  `)).rows[0];
  const appCounts = {};
  for (const table of ["posts", "media", "home_sections", "home_projects", "home_media", "home_project_media"]) appCounts[table] = (await client.query(`SELECT count(*)::int AS count FROM app."${table}"`)).rows[0].count;
  const authCounts = (await client.query("SELECT (SELECT count(*) FROM auth.\"user\")::int AS users, (SELECT count(*) FROM auth.account)::int AS accounts, (SELECT count(*) FROM auth.session)::int AS sessions, (SELECT count(*) FROM app.user_roles)::int AS roles")).rows[0];
  const actualTotal = Object.values(actualCounts).reduce((sum, count) => sum + count, 0);
  const plannedTotal = Object.values(expectedTargetCounts).reduce((sum, count) => sum + count, 0);
  const exactCounts = JSON.stringify(actualCounts) === JSON.stringify(expectedTargetCounts);
  const provenanceTotal = provenanceRows.reduce((sum, row) => sum + row.count, 0);
  const expectedRun = run?.status === "imported" && run.source_fingerprint === source.fingerprint && run.mapping_version === MAPPING_VERSION && run.report?.totalRows === plannedTotal;
  const complete = exactCounts && provenanceTotal === plannedTotal && provenanceMatches === plannedTotal && expectedRun;
  const empty = actualTotal === 0 && provenanceTotal === 0 && run === null;
  const verification = {
    target: { database: facts.database_name, postgresVersion: facts.postgres_version, readOnly: facts.read_only, expectedRoleMatched: facts.role_ok },
    migrationHashesMatched: true,
    stagingCounts: actualCounts,
    expectedStagingCounts: expectedTargetCounts,
    provenanceCounts: provenanceRows,
    provenanceTotal,
    sourceRowsMatchedWithoutEmission: provenanceMatches,
    runLedger: run ? { present: true, status: run.status, sourceMatches: run.source_fingerprint === source.fingerprint, mappingVersionMatches: run.mapping_version === MAPPING_VERSION, reportedRows: run.report?.totalRows ?? null } : { present: false },
    foreignKeyOrphans: orphanResult,
    applicationTableCounts: appCounts,
    authAndRoleCounts: authCounts,
    importedCount: complete ? plannedTotal : 0,
    skippedBugReports: counts.bug_reports,
    idempotencyState: complete ? "completed deterministic run; exact data/provenance match" : empty ? "no import ledger or staging rows; import transaction did not commit" : "partial or inconsistent state; do not retry or repair",
    checks: { exactStagingCounts: exactCounts, provenanceMatches: provenanceTotal === plannedTotal, ledgerMatches: expectedRun, foreignKeysClean: Object.values(orphanResult).every((count) => count === 0), applicationTablesUntouched: Object.values(appCounts).every((count) => count === 0), noAuthUsersOrSessionsOrRoles: Object.values(authCounts).every((count) => count === 0) },
  };
  await client.query("ROLLBACK"); inTransaction = false;
  const output = `${JSON.stringify(verification, null, 2)}\nRead-only transaction rolled back; no record values were selected.\n`;
  mkdirSync(dirname(outputPath), { recursive: true }); writeFileSync(outputPath, output, { mode: 0o600 }); chmodSync(outputPath, 0o600);
  process.stdout.write(output);
  if (!complete && !empty) process.exitCode = 1;
} catch {
  if (inTransaction && client) await client.query("ROLLBACK").catch(() => {});
  console.error("Read-only import verification stopped; raw diagnostics were suppressed. No retry or repair was attempted.");
  process.exitCode = 1;
} finally { client?.release(); await pool.end().catch(() => {}); }
