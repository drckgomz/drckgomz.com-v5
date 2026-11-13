#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertLegacyStagingCounts, buildSafeInsertRow, expectedColumnAllowlist, importedRowsForVerification, INSERT_ORDER, MAPPING_VERSION, parseLegacyDump, SOURCE_TABLES } from "./legacy-source.mjs";
import { classifyImportFailure } from "./import-error-classification.mjs";
import { DEVELOPMENT_TARGET as target, normalizeDevelopmentDatabaseUrl } from "./development-target.mjs";
import { loadDevelopmentMigrationManifest } from "../phase3f/development-migration-manifest.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const sourcePath = "/Volumes/DEV-LAB/Projects/Private-Backups/db_cluster-15-06-2025@15-25-31.backup";
const reviewedCounts = Object.freeze({ bug_reports: 3, content: 6, content_media: 3, media: 10, post_media: 2, posts: 2, users: 2 });
const reviewedMigrationHashes = loadDevelopmentMigrationManifest(root).migrations.map(({ sha256 }) => sha256);
const artifactPath = resolve(root, ".artifacts/phase3e/backup-inspection.json");
const ENV_FILE = resolve(root, ".env.neon.development.local");

function stop(message) { console.error(`STOP: ${message}`); process.exit(2); }
function runIdFor(fingerprint) {
  const bytes = createHash("sha256").update(`${fingerprint}:${MAPPING_VERSION}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function readSource() {
  const raw = readFileSync(sourcePath);
  const report = JSON.parse(readFileSync(artifactPath, "utf8"));
  const parsed = parseLegacyDump(raw);
  if (report.sourceStableDuringRead !== true || report.sha256 !== parsed.fingerprint || report.sizeBytes !== raw.byteLength) stop("source backup no longer matches its reviewed integrity report");
  if (JSON.stringify(parsed.counts) !== JSON.stringify(reviewedCounts)) stop("source aggregate counts differ from the reviewed baseline");
  const copyCounts = Object.fromEntries(Object.entries(reviewedCounts).map(([table, count]) => [`public.${table}`, count]));
  if (JSON.stringify(report.applicationCopyRows) !== JSON.stringify(copyCounts)) stop("inventory application row counts differ from the reviewed baseline");
  return { parsed, source: raw };
}
function readDevelopmentUrl() {
  const ignored = spawnSync("git", ["check-ignore", "-q", ".env.neon.development.local"], { cwd: root, stdio: "ignore" });
  if (ignored.status !== 0) stop("explicit development env file is not Git-ignored");
  let contents;
  try { contents = readFileSync(ENV_FILE, "utf8"); } catch { stop("explicit development env file is unavailable"); }
  const match = contents.match(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*?)\s*$/m);
  if (!match) stop("DATABASE_URL is missing from explicit development env file");
  let value = match[1].trim();
  if ((value[0] === "\"" || value[0] === "'") && value.at(-1) === value[0]) value = value.slice(1, -1);
  try { return normalizeDevelopmentDatabaseUrl(value); }
  catch (error) { stop(error.message === "development URL is invalid" ? error.message : "development URL target does not match approved branch endpoint and database"); }
}
const { parsed } = readSource();
const sourceRows = Object.values(parsed.counts).reduce((sum, count) => sum + count, 0);
const totalRows = INSERT_ORDER.reduce((sum, table) => sum + parsed.counts[table], 0);
if (!process.argv.includes("--import")) {
  console.log(JSON.stringify({ mode: "offline-dry-run", sourceRows: parsed.counts, plannedStagingRows: totalRows, deferredRows: { bug_reports: parsed.counts.bug_reports }, insertOrder: INSERT_ORDER, sourceIdsPreserved: true, credentialFieldsExcluded: true, authAccountsCreated: 0, rolesGranted: 0, mediaObjectsChanged: 0, historicalPosts: { count: parsed.counts.posts, appPostsWritten: 0, publicReads: 0, disposition: "quarantined in legacy staging; future app draft candidates remain draft/private pending route and timezone review" }, unresolvedDataDecision: "bug reports are excluded until retention and sensitivity review", importReady: true, liveConnectionAttempted: false }, null, 2));
  process.exit(0);
}

for (const [flag, expected] of [["--project-id", target.project], ["--branch-id", target.branch], ["--endpoint-id", target.endpoint], ["--database", target.database]]) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || process.argv[index + 1] !== expected) stop(`${flag} confirmation does not match the approved development target`);
}
if (!process.argv.includes("--confirm-legacy-import")) stop("explicit future import confirmation is required");
if (!process.argv.includes("--console-identity-verified")) stop("fresh Neon Console branch-to-endpoint verification flag is required");
const connectionString = readDevelopmentUrl();

const [{ Pool }] = await Promise.all([import("@neondatabase/serverless")]);
const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
let client;
let inTransaction = false;
let committed = false;
let phase = "connect";
try {
  client = await pool.connect();
  phase = "connection-identity";
  const facts = (await client.query("SELECT current_database() AS db, current_user = $1 AS role_ok, current_setting('server_version_num') AS version", [target.role])).rows[0];
  if (facts?.db !== target.database || facts?.role_ok !== true || String(facts.version).slice(0, 2) !== target.major) throw new Error("connected database, role, or PostgreSQL version mismatch");
  phase = "begin-transaction";
  await client.query("BEGIN");
  inTransaction = true;
  await client.query("SET LOCAL statement_timeout = '60s'");
  await client.query("SET LOCAL lock_timeout = '5s'");
  phase = "migration-ledger";
  const migrationHashes = (await client.query("SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id")).rows.map((row) => row.hash);
  if (!((migrationHashes.length === 3 || migrationHashes.length === 4) &&
      migrationHashes.every((hash, index) => hash === reviewedMigrationHashes[index]))) {
    throw new Error("development migration ledger is not a recognized pre- or post-0003 state");
  }
  phase = "staging-schema";
  await verifyStagingSchema(client);
  const fingerprint = parsed.fingerprint;
  phase = "advisory-lock";
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 91031))", [fingerprint]);
  const runId = runIdFor(fingerprint);
  phase = "existing-run-check";
  const previous = (await client.query("SELECT id, status, report FROM ops.legacy_import_runs WHERE id = $1 FOR UPDATE", [runId])).rows[0];
  if (previous) {
    if (previous.status !== "imported" || previous.report?.mappingVersion !== MAPPING_VERSION || previous.report?.totalRows !== totalRows) throw new Error("existing deterministic import ledger is incomplete or inconsistent");
    await verifyExistingImport(client, parsed, runId);
    await client.query("COMMIT");
    inTransaction = false;
    committed = true;
    phase = "post-commit-verification";
    await verifyAfterCommit(client, parsed, runId, fingerprint);
    console.log(JSON.stringify({ result: "already-imported-and-verified; no rows written", sourceRows: parsed.counts, totalApplicationRows: totalRows }));
  } else {
    phase = "empty-target-check";
    const targets = [...Object.keys(SOURCE_TABLES).map((table) => `legacy.${table}`), "ops.legacy_entity_map", "ops.legacy_import_runs"];
    for (const name of targets) {
      const [schema, table] = name.split(".");
      const result = await client.query(`SELECT EXISTS (SELECT 1 FROM ${schema}.${table} LIMIT 1) AS populated`);
      if (result.rows[0]?.populated) throw new Error("a target staging/provenance table is not empty; manual reconciliation is required");
    }
    const plannedCounts = Object.fromEntries(INSERT_ORDER.map((table) => [table, parsed.counts[table]]));
    const report = { mappingVersion: MAPPING_VERSION, totalSourceRows: sourceRows, totalRows, tableCounts: plannedCounts, deferredBugReports: parsed.counts.bug_reports, publicAppRowsWritten: 0, betterAuthUsersCreated: 0, rolesGranted: 0, sourceCredentialFieldsCopied: 0, mediaObjectsUploadedOrChanged: 0, historicalPostsQuarantined: parsed.counts.posts, postCandidateDefault: { publicationState: "draft", visibility: "private" } };
    phase = "staging-write";
    await client.query("INSERT INTO ops.legacy_import_runs (id, source_fingerprint, mapping_version, status, report) VALUES ($1,$2,$3,'planned',$4::jsonb)", [runId, fingerprint, MAPPING_VERSION, JSON.stringify(report)]);
    for (const table of INSERT_ORDER) {
      const { columns } = buildSafeInsertRow(table, parsed.rows[table][0] ?? Object.fromEntries(SOURCE_TABLES[table].map((name) => [name, null])));
      const quoted = columns.map((column) => `"${column}"`).join(",");
      for (const sourceRow of parsed.rows[table]) {
        const { values } = buildSafeInsertRow(table, sourceRow);
        const placeholders = values.map((_, index) => `$${index + 1}`).join(",");
        await client.query(`INSERT INTO legacy."${table}" (${quoted}) VALUES (${placeholders})`, values);
        const sourceId = String(sourceRow.id);
        await client.query(`INSERT INTO ops.legacy_entity_map (run_id, source_namespace, source_table, source_id, target_schema, target_table, target_id, source_fingerprint, mapping_version, review_state) VALUES ($1,'supabase-backup-unverified',$2,$3,'legacy',$2,$3,$4,$5,'quarantined')`, [runId, table, sourceId, fingerprint, MAPPING_VERSION]);
      }
    }
    await client.query("UPDATE ops.legacy_import_runs SET status='imported', finished_at=now(), report=$2::jsonb WHERE id=$1", [runId, JSON.stringify(report)]);
    phase = "pre-commit-verification";
    await verifyExistingImport(client, parsed, runId);
    phase = "commit";
    await client.query("COMMIT");
    inTransaction = false;
    committed = true;
    phase = "post-commit-verification";
    await verifyAfterCommit(client, parsed, runId, fingerprint);
    console.log(JSON.stringify({ result: "imported and verified", sourceRows: parsed.counts, plannedStagingRows: totalRows, deferredBugReports: parsed.counts.bug_reports, postsQuarantined: parsed.counts.posts, usersExcludedFromAuth: parsed.counts.users, credentialsCopied: 0, rolesGranted: 0, mediaObjectsChanged: 0 }));
  }
} catch (error) {
  const failure = classifyImportFailure(error, phase);
  if (inTransaction && client) await client.query("ROLLBACK").catch(() => {});
  console.error(committed
    ? `Import committed, but verification failed (phase=${failure.phase}, category=${failure.category}); no retry or repair was attempted.`
    : `Import did not commit (phase=${failure.phase}, category=${failure.category}); raw diagnostics were suppressed. No retry or repair was attempted.`);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end().catch(() => {});
}

async function verifyStagingSchema(client) {
  for (const table of Object.keys(SOURCE_TABLES)) {
    const columns = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='legacy' AND table_name=$1 ORDER BY ordinal_position", [table])).rows.map((row) => row.column_name);
    if (JSON.stringify(columns) !== JSON.stringify(expectedColumnAllowlist(table))) throw new Error("staging table column contract mismatch");
  }
  const relationships = (await client.query(`
    SELECT child_ns.nspname || '.' || child.relname AS child,
           parent_ns.nspname || '.' || parent.relname AS parent
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class child ON child.oid=con.conrelid
    JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid=child.relnamespace
    JOIN pg_catalog.pg_class parent ON parent.oid=con.confrelid
    JOIN pg_catalog.pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
    WHERE con.contype='f' AND child_ns.nspname='legacy'
  `)).rows.map((row) => `${row.child}->${row.parent}`).sort();
  const expected = ["legacy.content->legacy.media", "legacy.content_media->legacy.content", "legacy.content_media->legacy.media", "legacy.post_media->legacy.media", "legacy.post_media->legacy.posts"].sort();
  if (JSON.stringify(relationships) !== JSON.stringify(expected)) throw new Error("staging foreign-key contract mismatch");
}

async function verifyAfterCommit(client, source, runId, fingerprint) {
  await client.query("BEGIN READ ONLY");
  inTransaction = true;
  await client.query("SET LOCAL statement_timeout = '15s'");
  await verifyExistingImport(client, source, runId);
  const run = (await client.query("SELECT status, source_fingerprint, mapping_version, report FROM ops.legacy_import_runs WHERE id=$1", [runId])).rows[0];
  if (run?.status !== "imported" || run.source_fingerprint !== fingerprint || run.mapping_version !== MAPPING_VERSION || run.report?.totalRows !== totalRows) throw new Error("committed import ledger verification failed");
  const orphans = (await client.query(`
    SELECT
      (SELECT count(*) FROM legacy.content c LEFT JOIN legacy.media m ON m.id=c.media_id WHERE c.media_id IS NOT NULL AND m.id IS NULL)::int AS content_media_orphans,
      (SELECT count(*) FROM legacy.content_media x LEFT JOIN legacy.content c ON c.id=x.content_id LEFT JOIN legacy.media m ON m.id=x.media_id WHERE c.id IS NULL OR m.id IS NULL)::int AS content_gallery_orphans,
      (SELECT count(*) FROM legacy.post_media x LEFT JOIN legacy.posts p ON p.id=x.post_id LEFT JOIN legacy.media m ON m.id=x.media_id WHERE (x.post_id IS NOT NULL AND p.id IS NULL) OR (x.media_id IS NOT NULL AND m.id IS NULL))::int AS post_gallery_orphans
  `)).rows[0];
  if (orphans.content_media_orphans !== 0 || orphans.content_gallery_orphans !== 0 || orphans.post_gallery_orphans !== 0) throw new Error("post-import foreign-key verification failed");
  const authRows = (await client.query("SELECT (SELECT count(*) FROM auth.\"user\")::int AS users, (SELECT count(*) FROM auth.account)::int AS accounts, (SELECT count(*) FROM auth.session)::int AS sessions, (SELECT count(*) FROM app.user_roles)::int AS role_assignments")).rows[0];
  if (authRows.users !== 0 || authRows.accounts !== 0 || authRows.sessions !== 0 || authRows.role_assignments !== 0) throw new Error("unexpected auth or authorization rows detected");
  await client.query("COMMIT");
  inTransaction = false;
}

async function verifyExistingImport(client, parsedRows, runId) {
  let mappingCount = 0;
  const actualCounts = {};
  for (const table of Object.keys(SOURCE_TABLES)) {
    actualCounts[table] = (await client.query(`SELECT count(*)::int AS count FROM legacy."${table}"`)).rows[0].count;
  }
  assertLegacyStagingCounts(parsedRows.rows, actualCounts);

  // Excluded source tables (currently bug_reports) must be empty in staging;
  // only allowlisted imported rows participate in row/provenance matching.
  for (const { table, row } of importedRowsForVerification(parsedRows.rows)) {
    const built = buildSafeInsertRow(table, row);
    const clauses = built.columns.map((column, index) => `"${column}" IS NOT DISTINCT FROM $${index + 1}`).join(" AND ");
    const match = await client.query(`SELECT EXISTS (SELECT 1 FROM legacy."${table}" WHERE ${clauses}) AS equal`, built.values);
    if (!match.rows[0]?.equal) throw new Error("staged row mismatch");
    const mapped = await client.query("SELECT EXISTS (SELECT 1 FROM ops.legacy_entity_map WHERE run_id=$1 AND source_table=$2 AND source_id=$3 AND target_schema='legacy' AND target_table=$2 AND target_id=$3 AND review_state='quarantined') AS present", [runId, table, String(row.id)]);
    if (!mapped.rows[0]?.present) throw new Error("provenance map mismatch");
    mappingCount += 1;
  }
  const aggregateMapCount = (await client.query("SELECT count(*)::int AS count FROM ops.legacy_entity_map WHERE run_id=$1", [runId])).rows[0].count;
  if (mappingCount !== aggregateMapCount) throw new Error("provenance mapping count mismatch");
}
