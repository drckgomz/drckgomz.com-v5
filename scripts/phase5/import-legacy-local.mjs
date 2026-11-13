#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  assertLegacyStagingCounts,
  buildSafeInsertRow,
  expectedColumnAllowlist,
  importedRowsForVerification,
  INSERT_ORDER,
  MAPPING_VERSION,
  parseLegacyDump,
  SOURCE_TABLES,
} from "../phase3i/legacy-source.mjs";
import { validateMigrationArtifacts } from "./validate-migrations.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const sourcePath = "/Volumes/DEV-LAB/Projects/Private-Backups/db_cluster-15-06-2025@15-25-31.backup";
const expectedSource = Object.freeze({ bytes: 201030, sha256: "1d9aa9083a77af25752d167d928ed4e23297a8a38660743e4536035f00639add" });
const target = Object.freeze({ host: "127.0.0.1", port: 55441, database: "drckgomz_phase5_test", user: "phase5_local", major: "18" });
const databaseUrl = "postgresql://phase5_local@127.0.0.1:55441/drckgomz_phase5_test?sslmode=disable";
const credentialFields = new Set(["password", "reset_token", "reset_token_expires"]);

function fail(phase, category) {
  console.error(`Local legacy staging import stopped (phase=${phase}, category=${category}); sensitive values were suppressed.`);
  process.exit(1);
}

function loadSource() {
  let before;
  let after;
  let raw;
  try {
    before = lstatSync(sourcePath);
    if (!before.isFile() || before.isSymbolicLink()) throw new Error();
    raw = readFileSync(sourcePath);
    after = statSync(sourcePath, { throwIfNoEntry: true });
  } catch { fail("source", "unavailable-or-unreadable"); }
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || raw.length !== expectedSource.bytes) {
    fail("source", "source-changed-or-unexpected-size");
  }
  const fingerprint = createHash("sha256").update(raw).digest("hex");
  if (fingerprint !== expectedSource.sha256) fail("source", "source-fingerprint-mismatch");
  try { return parseLegacyDump(raw); }
  catch { fail("source", "backup-format-or-integrity-error"); }
}

const parsed = loadSource();
const artifactState = validateMigrationArtifacts(root);
if (artifactState.migrationCount !== 6) fail("local-manifest", "unexpected-migration-count");
const includedCount = importedRowsForVerification(parsed.rows).length;
const expectedRows = Object.fromEntries(INSERT_ORDER.map((table) => [table, parsed.counts[table]]));
if (includedCount !== 25 || parsed.counts.bug_reports !== 3) fail("source-validation", "reviewed-source-count-mismatch");

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const apply = args.includes("--apply-local");
if (args.some((arg) => arg.startsWith("--") && arg !== "--apply-local" && arg !== "--dry-run")) {
  fail("arguments", "unsupported-argument");
}
if (apply && args.includes("--dry-run")) fail("arguments", "conflicting-mode");
if (!apply) {
  console.log(JSON.stringify({ mode: "local-dry-run", sourceRows: parsed.counts, stagedRows: includedCount, excludedBugReports: parsed.counts.bug_reports, credentialsCopied: 0, authAccountsCreated: 0, rolesGranted: 0, publicApplicationRowsWritten: 0, mediaObjectsChanged: 0, migrationCount: artifactState.migrationCount, target: { host: target.host, port: target.port, database: target.database, postgresMajor: target.major } }));
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 3000, idleTimeoutMillis: 5000 });
let client;
let transaction = false;
let phase = "connect";
try {
  client = await pool.connect();
  phase = "identity";
  const identity = (await client.query("select current_database() as database, current_user as role, current_setting('server_version_num') as version, inet_server_addr() = $1::inet as loopback_ok, inet_server_port() as port", [target.host])).rows[0];
  const mismatches = [
    identity?.database !== target.database && "database",
    identity?.role !== target.user && "role",
    String(identity?.version).slice(0, 2) !== target.major && "postgres-major",
    identity?.loopback_ok !== true && "loopback-address",
    identity?.port !== target.port && "port",
  ].filter(Boolean);
  if (mismatches.length) {
    throw Object.assign(new Error(), { phase: "identity", category: `target-mismatch-${mismatches.join("-")}` });
  }

  phase = "migration-ledger";
  const hashes = (await client.query("select hash from drizzle.__drizzle_migrations order by id")).rows.map((row) => row.hash);
  const manifest = JSON.parse(readFileSync(resolve(root, "scripts/phase5/migration-manifest.json"), "utf8"));
  const expectedHashes = manifest.migrations.map((migration) => migration.sha256);
  if (JSON.stringify(hashes) !== JSON.stringify(expectedHashes)) {
    throw Object.assign(new Error(), { phase, category: "migration-ledger-mismatch" });
  }

  phase = "schema-preflight";
  for (const table of Object.keys(SOURCE_TABLES)) {
    const result = await client.query("select column_name from information_schema.columns where table_schema='legacy' and table_name=$1 order by ordinal_position", [table]);
    if (JSON.stringify(result.rows.map((row) => row.column_name)) !== JSON.stringify(expectedColumnAllowlist(table))) {
      throw Object.assign(new Error(), { phase, category: "staging-schema-mismatch" });
    }
  }

  phase = "begin";
  await client.query("begin");
  transaction = true;
  await client.query("set local statement_timeout = '60s'");
  await client.query("set local lock_timeout = '5s'");
  await client.query("select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 91031))", [parsed.fingerprint]);

  const runId = runIdFor(parsed.fingerprint);
  phase = "idempotency-check";
  const existingRun = (await client.query("select status, source_fingerprint, mapping_version, report from ops.legacy_import_runs where id=$1 for update", [runId])).rows[0];
  const counts = await readCounts(client);
  if (existingRun) {
    if (existingRun.status !== "imported" || existingRun.source_fingerprint !== parsed.fingerprint || existingRun.mapping_version !== MAPPING_VERSION || existingRun.report?.totalRows !== includedCount) {
      throw Object.assign(new Error(), { phase, category: "existing-import-conflict" });
    }
    await verifyImport(client, parsed, runId);
    await client.query("commit");
    transaction = false;
    console.log(JSON.stringify({ result: "already-imported-and-reconciled", stagedRows: includedCount, excludedBugReports: parsed.counts.bug_reports, credentialsCopied: 0, authAccountsCreated: 0, rolesGranted: 0 }));
  } else {
    phase = "empty-target-check";
    if (Object.values(counts).some((count) => count !== 0)) throw Object.assign(new Error(), { phase, category: "staging-target-not-empty" });
    const [ledgerCount] = (await client.query("select count(*)::int as count from ops.legacy_entity_map")).rows;
    const [runsCount] = (await client.query("select count(*)::int as count from ops.legacy_import_runs")).rows;
    if (ledgerCount.count !== 0 || runsCount.count !== 0) throw Object.assign(new Error(), { phase, category: "provenance-target-not-empty" });

    phase = "staging-write";
    const runIdValue = runId;
    const report = { mappingVersion: MAPPING_VERSION, totalSourceRows: Object.values(parsed.counts).reduce((sum, count) => sum + count, 0), totalRows: includedCount, tableCounts: expectedRows, excludedBugReports: parsed.counts.bug_reports, authAccountsCreated: 0, rolesGranted: 0, credentialFieldsCopied: 0, publicApplicationRowsWritten: 0, mediaObjectsChanged: 0 };
    await client.query("insert into ops.legacy_import_runs (id, source_fingerprint, mapping_version, status, report) values ($1,$2,$3,'validating',$4::jsonb)", [runIdValue, parsed.fingerprint, MAPPING_VERSION, JSON.stringify(report)]);
    for (const table of INSERT_ORDER) {
      const columns = expectedColumnAllowlist(table);
      if (columns.some((column) => credentialFields.has(column))) throw Object.assign(new Error(), { phase, category: "credential-column-guard" });
      const quotedColumns = columns.map((column) => `"${column}"`).join(",");
      for (const row of parsed.rows[table]) {
        const { values } = buildSafeInsertRow(table, row);
        const placeholders = values.map((_, index) => `$${index + 1}`).join(",");
        await client.query(`insert into legacy."${table}" (${quotedColumns}) values (${placeholders})`, values);
        await client.query("insert into ops.legacy_entity_map (run_id,source_namespace,source_table,source_id,target_schema,target_table,target_id,source_fingerprint,mapping_version,review_state) values ($1,'supabase-backup-unverified',$2,$3,'legacy',$2,$3,$4,$5,'quarantined')", [runIdValue, table, String(row.id), parsed.fingerprint, MAPPING_VERSION]);
      }
    }
    await client.query("update ops.legacy_import_runs set status='imported', finished_at=now(), report=$2::jsonb where id=$1", [runIdValue, JSON.stringify(report)]);
    phase = "pre-commit-verification";
    await verifyImport(client, parsed, runIdValue);
    await client.query("commit");
    transaction = false;
    phase = "post-commit-verification";
    await verifyImport(client, parsed, runIdValue);
    console.log(JSON.stringify({ result: "imported-and-reconciled", stagedRows: includedCount, excludedBugReports: parsed.counts.bug_reports, credentialsCopied: 0, authAccountsCreated: 0, rolesGranted: 0, publicApplicationRowsWritten: 0, mediaObjectsChanged: 0 }));
  }
} catch (error) {
  if (transaction && client) await client.query("rollback").catch(() => {});
  const safePhase = error && typeof error === "object" && "phase" in error ? String(error.phase) : phase;
  const safeCategory = error && typeof error === "object" && "category" in error ? String(error.category) : "database-operation-failed";
  fail(safePhase, safeCategory);
} finally {
  client?.release();
  await pool.end().catch(() => {});
}

function runIdFor(fingerprint) {
  const bytes = createHash("sha256").update(`${fingerprint}:${MAPPING_VERSION}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function readCounts(connection) {
  const counts = {};
  for (const table of Object.keys(SOURCE_TABLES)) {
    const [row] = (await connection.query(`select count(*)::int as count from legacy."${table}"`)).rows;
    counts[table] = row.count;
  }
  return counts;
}

async function verifyImport(connection, source, runId) {
  const counts = await readCounts(connection);
  assertLegacyStagingCounts(source.rows, counts);
  for (const { table, row } of importedRowsForVerification(source.rows)) {
    const columns = expectedColumnAllowlist(table);
    const clauses = columns.map((column, index) => `"${column}" is not distinct from $${index + 2}`).join(" and ");
    const values = [String(row.id), ...buildSafeInsertRow(table, row).values];
    const [match] = (await connection.query(`select count(*)::int as count from legacy."${table}" where id=$1 and ${clauses}`, values)).rows;
    if (match.count !== 1) throw Object.assign(new Error(), { phase: "verification", category: "content-mismatch" });
    const [provenance] = (await connection.query("select count(*)::int as count from ops.legacy_entity_map where run_id=$1 and source_namespace='supabase-backup-unverified' and source_table=$2 and source_id=$3 and target_schema='legacy' and target_table=$2 and target_id=$3 and source_fingerprint=$4 and mapping_version=$5 and review_state='quarantined'", [runId, table, String(row.id), source.fingerprint, MAPPING_VERSION])).rows;
    if (provenance.count !== 1) throw Object.assign(new Error(), { phase: "verification", category: "provenance-mismatch" });
  }
  const [excluded] = (await connection.query("select count(*)::int as count from legacy.bug_reports")).rows;
  if (excluded.count !== 0) throw Object.assign(new Error(), { phase: "verification", category: "excluded-record-present" });
  const orphanChecks = [
    "select count(*)::int as count from legacy.content c left join legacy.media m on m.id=c.media_id where c.media_id is not null and m.id is null",
    "select count(*)::int as count from legacy.content_media cm left join legacy.content c on c.id=cm.content_id left join legacy.media m on m.id=cm.media_id where c.id is null or m.id is null",
    "select count(*)::int as count from legacy.post_media pm left join legacy.posts p on p.id=pm.post_id left join legacy.media m on m.id=pm.media_id where (pm.post_id is not null and p.id is null) or (pm.media_id is not null and m.id is null)",
  ];
  for (const query of orphanChecks) {
    const [orphans] = (await connection.query(query)).rows;
    if (orphans.count !== 0) throw Object.assign(new Error(), { phase: "verification", category: "relationship-integrity-failure" });
  }
  const [provenanceTotal] = (await connection.query("select count(*)::int as count from ops.legacy_entity_map")).rows;
  const [run] = (await connection.query("select count(*)::int as count from ops.legacy_import_runs where id=$1 and source_fingerprint=$2 and mapping_version=$3 and status='imported'", [runId, source.fingerprint, MAPPING_VERSION])).rows;
  if (provenanceTotal.count !== includedCount || run.count !== 1) throw Object.assign(new Error(), { phase: "verification", category: "ledger-mismatch" });
  const [appRows] = (await connection.query("select (select count(*) from app.posts)::int + (select count(*) from app.media)::int + (select count(*) from app.post_categories)::int + (select count(*) from app.post_tags)::int + (select count(*) from app.categories)::int + (select count(*) from app.tags)::int + (select count(*) from app.home_sections)::int + (select count(*) from app.home_media)::int + (select count(*) from app.home_projects)::int + (select count(*) from app.home_project_media)::int + (select count(*) from app.user_profiles)::int + (select count(*) from app.user_roles)::int + (select count(*) from app.user_capabilities)::int + (select count(*) from app.security_audit_events)::int + (select count(*) from app.audience_groups)::int + (select count(*) from app.audience_memberships)::int + (select count(*) from app.post_access_grants)::int + (select count(*) from app.post_access_requests)::int + (select count(*) from app.site_media)::int + (select count(*) from app.appearance_settings)::int as count")).rows;
  const [authRows] = (await connection.query("select (select count(*) from auth.\"user\")::int + (select count(*) from auth.session)::int + (select count(*) from auth.account)::int + (select count(*) from auth.verification)::int as count")).rows;
  if (appRows.count !== 0 || authRows.count !== 0) throw Object.assign(new Error(), { phase: "verification", category: "protected-tables-changed" });
}
