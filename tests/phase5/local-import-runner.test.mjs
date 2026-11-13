import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync("scripts/phase5/import-legacy-local.mjs", "utf8");
const smoke = readFileSync("scripts/phase5/local-session-digest-smoke.sql", "utf8");
const verify = readFileSync("scripts/phase5/verify-local-import.sql", "utf8");

test("local legacy import is pinned to the disposable loopback PostgreSQL target", () => {
  assert.match(runner, /host: "127\.0\.0\.1", port: 55441, database: "drckgomz_phase5_test", user: "phase5_local", major: "18"/);
  assert.ok(runner.includes("postgresql://phase5_local@127.0.0.1:55441/drckgomz_phase5_test"));
  assert.doesNotMatch(runner, /process\.env|\.env\.|NEON_|SUPABASE_|AWS_/);
  assert.doesNotMatch(runner, /@neondatabase|fetch\(|https?:\/\//);
});

test("local legacy import quarantines exactly 25 rows and excludes bug reports and credentials", () => {
  assert.match(runner, /includedCount !== 25/);
  assert.match(runner, /parsed\.counts\.bug_reports !== 3/);
  assert.match(runner, /const credentialFields = new Set\(\["password", "reset_token", "reset_token_expires"\]\)/);
  assert.match(runner, /publicApplicationRowsWritten: 0/);
  assert.match(runner, /authAccountsCreated: 0/);
  assert.match(runner, /rolesGranted: 0/);
  assert.match(runner, /mediaObjectsChanged: 0/);
  assert.match(runner, /select count\(\*\)::int as count from legacy\.bug_reports/);
  assert.match(runner, /relationship-integrity-failure/);
  assert.match(runner, /app\.user_roles/);
  assert.match(runner, /auth\.verification/);
  assert.ok(runner.includes('const clauses = columns.map((column, index) => `"${column}" is not distinct from $${index + 2}`)'));
  assert.match(runner, /assertLegacyStagingCounts\(source\.rows, counts\)/);
});

test("session digest local test is synthetic and rolls back", () => {
  assert.match(smoke, /phase5-synthetic@example\.invalid/);
  assert.match(smoke, /phase5-token-one/);
  assert.match(smoke, /phase5-token-two/);
  assert.match(smoke, /current_database\(\) <> 'drckgomz_phase5_test'/);
  assert.match(smoke, /ROLLBACK;/);
  assert.match(verify, /BEGIN READ ONLY/);
  assert.match(verify, /ROLLBACK;/);
  assert.doesNotMatch(verify, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP)\b/i);
  assert.match(verify, /application_rows/);
  assert.match(verify, /authentication_rows/);
});
