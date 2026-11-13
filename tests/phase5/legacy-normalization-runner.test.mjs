import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync("scripts/phase5/normalize-legacy-local.mjs", "utf8");
const validator = readFileSync("scripts/phase5/validate-migrations.mjs", "utf8");

test("normalization runner is pinned to the disposable local database and migration hashes", () => {
  assert.match(runner, /host: "127\.0\.0\.1", port: 55441, database: "drckgomz_phase5_test", user: "phase5_local", major: 18/);
  assert.match(runner, /migrationHashes/);
  assert.match(runner, /order by created_at asc/);
  assert.doesNotMatch(runner, /process\.env|\.env\.|NEON_|SUPABASE_|AWS_|https?:\/\//);
});

test("normalization preserves legacy post IDs and content but keeps posts private and unpublished", () => {
  assert.match(runner, /post\.id, slug, post\.title, post\.content/);
  assert.match(runner, /deleted \? "archived" : "draft"/);
  assert.match(runner, /'private'/);
  assert.match(runner, /publication_state,visibility,published_at,date/);
  assert.match(runner, /postsPublished: 0/);
  assert.match(runner, /credentialsImported: 0/);
  assert.match(runner, /usersCreated: 0/);
  assert.match(runner, /rolesGranted: 0/);
});

test("timestamp mapping reads source wall-clock values as text and records the UTC interpretation", () => {
  assert.match(runner, /created_at::text as created_at/);
  assert.match(runner, /function asUtcTimestamp\(value\)/);
  assert.match(runner, /source wall-clock timestamps deterministically interpreted as UTC with microsecond precision/);
  assert.match(runner, /target\.created_at at time zone 'UTC'\) is distinct from coalesce\(source\.created_at/);
  assert.match(runner, /timestamp-reconciliation-failed/);
  assert.match(runner, /PREVIOUS_MAPPING_VERSION = "phase5-normalize-v2"/);
  assert.match(runner, /Correct the known v1 timestamp parser defect/);
});

test("legacy media is linked by provenance without retaining public object URLs", () => {
  assert.match(runner, /source_media_id/);
  assert.match(runner, /values \(\$1,\$2,\$3,null,/);
  assert.match(runner, /mediaUrlsCopied: 0/);
  assert.match(runner, /legacy-post-media-/);
});

test("normalization requires staged provenance and an empty application/auth target, then reconciles idempotently", () => {
  assert.match(runner, /staged-source-provenance-missing-or-ambiguous/);
  assert.match(runner, /application-or-auth-target-not-empty/);
  assert.match(runner, /already-normalized-and-reconciled/);
  assert.match(runner, /post-content-or-privacy-mismatch/);
  assert.match(runner, /normalized-provenance-count-mismatch/);
  assert.match(runner, /pg_advisory_xact_lock/);
  assert.match(runner, /rollback/);
});

test("migration validator returns the offline-reviewed ordered migration hashes for DB comparison", () => {
  assert.match(validator, /migrationHashes: Object\.freeze\(manifest\.migrations\.map/);
});
