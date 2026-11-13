#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseNeonDevelopmentRuntimeTarget, NEON_DEVELOPMENT_TARGET } from "../../src/lib/db/neon-development-target.ts";
import { loadDevelopmentMigrationManifest } from "../phase3f/development-migration-manifest.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = resolve(root, ".env.neon.bootstrap.development.local");
const migrationsPath = resolve(root, "drizzle");
const BOOTSTRAP_ROLE = "drckgomz_bootstrap";
const EXPECTED_MIGRATIONS = loadDevelopmentMigrationManifest(root).migrations.map(({ sha256 }) => sha256);
const IDENTITY_FLAGS = [
  ["--project-id", NEON_DEVELOPMENT_TARGET.project],
  ["--branch-id", NEON_DEVELOPMENT_TARGET.branch],
  ["--endpoint-id", NEON_DEVELOPMENT_TARGET.endpoint],
  ["--database", NEON_DEVELOPMENT_TARGET.database],
];

function fail(phase, category) {
  console.error(`STOP phase=${phase} category=${category}; raw diagnostics suppressed; no retry attempted`);
  process.exit(2);
}

function value(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function validateArguments() {
  const applying = process.argv.includes("--apply");
  if (applying && process.argv.includes("--dry-run")) fail("arguments", "conflicting-mode-flags");
  if (!applying && !process.argv.includes("--dry-run")) {
    // Safe default: no flags means dry-run, not apply.
    return false;
  }
  for (const [flag, expected] of IDENTITY_FLAGS) if (value(flag) !== expected) fail("arguments", "target-confirmation-mismatch");
  if (!process.argv.includes("--console-identity-verified")) fail("arguments", "fresh-console-attestation-required");
  if (applying) {
    if (!process.argv.includes("--confirm-owner-bootstrap") || !value("--owner-user-id") || !value("--approval-ref")) {
      fail("arguments", "separate-owner-bootstrap-approval-required");
    }
    if (value("--approval-ref").trim().length < 8) fail("arguments", "approval-reference-required");
  }
  return applying;
}

function explicitDatabaseUrl() {
  const ignored = spawnSync("git", ["check-ignore", "-q", ".env.neon.bootstrap.development.local"], { cwd: root, stdio: "ignore" });
  if (ignored.status !== 0) fail("local-preflight", "explicit-bootstrap-env-file-not-ignored");
  let contents;
  try { contents = readFileSync(envPath, "utf8"); }
  catch { fail("local-preflight", "explicit-bootstrap-env-file-unavailable"); }
  const match = contents.match(/^\s*(?:export\s+)?DATABASE_URL\s*=\s*(.*?)\s*$/m);
  if (!match) fail("local-preflight", "database-url-missing-from-explicit-file");
  let raw = match[1].trim();
  if ((raw[0] === "\"" || raw[0] === "'") && raw.at(-1) === raw[0]) raw = raw.slice(1, -1);
  try { return parseNeonDevelopmentRuntimeTarget({
    DATABASE_URL: raw,
    NEON_TARGET: "development",
    NEON_PROJECT_ID: NEON_DEVELOPMENT_TARGET.project,
    NEON_BRANCH_ID: NEON_DEVELOPMENT_TARGET.branch,
    NEON_ENDPOINT_ID: NEON_DEVELOPMENT_TARGET.endpoint,
  }, BOOTSTRAP_ROLE).databaseUrl; }
  catch { fail("local-preflight", "database-url-target-mismatch"); }
}

function validateMigrationFiles() {
  const tags = EXPECTED_MIGRATIONS.map((_, index) => ["0000_petite_loki", "0001_bitter_tiger_shark", "0002_many_kingpin", "0003_early_blizzard"][index]);
  try {
    const actualFiles = readdirSync(migrationsPath).filter((name) => name.endsWith(".sql")).sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(tags.map((tag) => `${tag}.sql`).sort())) fail("local-preflight", "migration-file-set-mismatch");
    for (let index = 0; index < tags.length; index += 1) {
      const hash = createHash("sha256").update(readFileSync(resolve(migrationsPath, `${tags[index]}.sql`))).digest("hex");
      if (hash !== EXPECTED_MIGRATIONS[index]) fail("local-preflight", "migration-checksum-mismatch");
    }
  } catch { fail("local-preflight", "migration-manifest-unavailable"); }
}

async function inspectTarget(databaseUrl, userId) {
  const { Pool } = await import("@neondatabase/serverless");
  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 5_000 });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const identity = (await client.query(`SELECT current_database() AS database_name,
      current_user AS role_name, current_setting('server_version_num') AS server_version_num,
      current_setting('transaction_read_only') AS read_only,
      (SELECT NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication
        AND NOT rolbypassrls AND NOT rolinherit FROM pg_catalog.pg_roles WHERE rolname=current_user) AS role_is_restricted,
      NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members m
        JOIN pg_catalog.pg_roles r ON r.oid=m.member WHERE r.rolname=current_user) AS has_no_role_memberships`)).rows[0];
    if (identity.database_name !== NEON_DEVELOPMENT_TARGET.database || identity.role_name !== BOOTSTRAP_ROLE ||
        String(identity.server_version_num).slice(0, 2) !== "18" || identity.read_only !== "on" ||
        identity.role_is_restricted !== true || identity.has_no_role_memberships !== true) {
      throw new Error("identity mismatch");
    }
    const migrationRows = (await client.query("SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id")).rows;
    const actualHashes = migrationRows.map((row) => row.hash);
    if (!((actualHashes.length === 3 || actualHashes.length === 4) &&
        actualHashes.every((hash, index) => hash === EXPECTED_MIGRATIONS[index]))) throw new Error("migration mismatch");
    const gate = (await client.query(`SELECT
      (SELECT count(*)::int FROM app.user_roles WHERE role='owner') AS owner_count,
      EXISTS (SELECT 1 FROM auth.\"user\" WHERE id=$1 AND email_verified=true) AS verified_identity,
      EXISTS (SELECT 1 FROM app.user_profiles WHERE id=$1 AND enabled=true AND banned_at IS NULL) AS active_profile`, [userId])).rows[0];
    if (gate.owner_count !== 0 || gate.verified_identity !== true || gate.active_profile !== true) throw new Error("bootstrap precondition mismatch");
    await client.query("ROLLBACK");
    return true;
  } catch {
    await client?.query("ROLLBACK").catch(() => {});
    throw new Error("read-only target preflight failed");
  } finally {
    client?.release();
    await pool.end().catch(() => {});
  }
}

async function verifyCommittedOwner(databaseUrl, userId) {
  const { Pool } = await import("@neondatabase/serverless");
  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 5_000 });
  try {
    const result = await pool.query(`SELECT
      (SELECT count(*)::int FROM app.user_roles WHERE role='owner') AS owner_count,
      EXISTS (SELECT 1 FROM app.user_roles WHERE user_id=$1 AND role='owner') AS selected_owner,
      EXISTS (SELECT 1 FROM app.security_audit_events WHERE subject_user_id=$1 AND action='initial_owner_bootstrapped') AS audit_written`, [userId]);
    const row = result.rows[0];
    return row?.owner_count === 1 && row.selected_owner === true && row.audit_written === true;
  } finally {
    await pool.end().catch(() => {});
  }
}

async function main() {
  const applying = validateArguments();
  validateMigrationFiles();
  const databaseUrl = explicitDatabaseUrl();
  if (!applying) {
    console.log("Local target syntax, explicit file ignore rule, and migration hashes passed. Dry-run made no database connection or writes.");
    return;
  }

  const userId = value("--owner-user-id");
  const evidenceRef = value("--approval-ref");
  await inspectTarget(databaseUrl, userId);
  process.env.DATABASE_URL = databaseUrl;
  process.env.NEON_TARGET = NEON_DEVELOPMENT_TARGET.target;
  process.env.NEON_PROJECT_ID = NEON_DEVELOPMENT_TARGET.project;
  process.env.NEON_BRANCH_ID = NEON_DEVELOPMENT_TARGET.branch;
  process.env.NEON_ENDPOINT_ID = NEON_DEVELOPMENT_TARGET.endpoint;
  let result;
  try {
    const [{ bootstrapFirstOwner }, { closeDatabasePool }] = await Promise.all([
      import("../../src/lib/auth/bootstrap-first-owner.ts"),
      import("../../src/lib/db/client.ts"),
    ]);
    try {
      result = await bootstrapFirstOwner({ userId, separatelyApproved: true, evidenceRef });
    } finally {
      await closeDatabasePool();
    }
  } catch {
    fail("bootstrap-transaction", "owner-bootstrap-rejected-or-rolled-back");
  }
  if (result?.role !== "owner") fail("bootstrap-transaction", "unexpected-bootstrap-result");
  try {
    if (!await verifyCommittedOwner(databaseUrl, userId)) fail("post-commit-verification", "owner-or-audit-state-mismatch");
  } catch { fail("post-commit-verification", "read-only-verification-failed-no-retry"); }
  console.log("Development owner bootstrap completed and verified. Identity and credentials were not logged.");
}

main().catch(() => fail("runner", "unclassified-failure"));
