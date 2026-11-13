import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDevelopmentMigrationManifest } from "../../scripts/phase3f/development-migration-manifest.mjs";
import {
  assertMutationApproval,
  classifyMigrationHistory,
  createIncrementalMigrationPlan,
  MigrationEvidenceError,
} from "../../scripts/phase3f/incremental-migration-plan.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = loadDevelopmentMigrationManifest(root);
const attestation = {
  consoleAttested: true,
  project: manifest.target.project,
  branch: manifest.target.branch,
  endpoint: manifest.target.endpoint,
  hostname: manifest.target.hostname,
  database: manifest.target.database,
  postgresMajor: manifest.target.postgresMajor,
};
const relations = [
  "app.categories", "app.home_media", "app.home_project_media", "app.home_projects", "app.home_sections",
  "app.media", "app.post_categories", "app.post_tags", "app.posts", "app.security_audit_events", "app.tags",
  "app.terminal_commands", "app.user_capabilities", "app.user_profiles", "app.user_roles", "auth.account",
  "auth.session", "auth.user", "auth.verification", "drizzle.__drizzle_migrations", "drizzle.__drizzle_migrations_id_seq", "legacy.bug_reports",
  "legacy.content", "legacy.content_media", "legacy.media", "legacy.post_media", "legacy.posts", "legacy.users",
  "ops.legacy_entity_map", "ops.legacy_import_runs",
];
const hashes = manifest.migrations.map(({ sha256 }) => sha256);

function baselineEvidence() {
  return {
    evidenceVersion: 1,
    target: { ...attestation, consoleAttested: undefined },
    connection: { database: manifest.target.database, postgresMajor: manifest.target.postgresMajor, role: "neondb_owner", transactionReadOnly: true },
    ledgerHashes: hashes.slice(0, 3),
    catalog: {
      schemas: ["app", "auth", "drizzle", "legacy", "ops", "public"],
      relations: [...relations],
      enums: ["public.content_visibility", "public.publication_state"],
      routines: [], sessionDigestColumn: false, sessionDigestDefinitionMatches: false,
      sessionTokenColumnMatches: true, sessionDigestIndexes: [],
    },
    stagingCounts: {
      "legacy.bug_reports": 0, "legacy.content": 6, "legacy.content_media": 3,
      "legacy.media": 10, "legacy.post_media": 2, "legacy.posts": 2, "legacy.users": 2,
    },
    provenanceRows: 25,
    importRuns: 1,
    applicationRows: 0,
    authenticationRows: 0,
  };
}

function emptyEvidence() {
  return {
    evidenceVersion: 1,
    target: { ...attestation, consoleAttested: undefined },
    connection: { database: manifest.target.database, postgresMajor: manifest.target.postgresMajor, role: "neondb_owner", transactionReadOnly: true },
    ledgerHashes: [],
    catalog: { schemas: ["public"], relations: [], enums: [], routines: [], sessionDigestColumn: false,
      sessionDigestDefinitionMatches: false, sessionTokenColumnMatches: false, sessionDigestIndexes: [] },
    stagingCounts: {}, provenanceRows: 0, importRuns: 0, applicationRows: 0, authenticationRows: 0,
  };
}

test("verified 0000–0002 baseline plans only 0003 with explicit prerequisites and postconditions", () => {
  const plan = createIncrementalMigrationPlan({ evidence: baselineEvidence(), attestation, root });
  assert.equal(plan.recognizedState, "verified-0000-through-0002");
  assert.deepEqual(plan.migrationsToApply.map(({ tag }) => tag), ["0003_early_blizzard"]);
  assert.equal(plan.executionAllowed, false);
  assert.ok(plan.prerequisites.some((item) => item.includes("Separate explicit approval")));
  assert.ok(plan.expectedPostconditions.some((item) => item.includes("25 legacy staging rows")));
});

test("fresh empty database is distinguished and does not use the incremental migration", () => {
  const plan = createIncrementalMigrationPlan({ evidence: emptyEvidence(), attestation, root });
  assert.equal(plan.recognizedState, "fresh-empty");
  assert.deepEqual(plan.migrationsToApply, []);
  assert.match(plan.nextAction, /fresh-database workflow/);
});

test("verified post-0003 history produces a no-op plan", () => {
  const evidence = baselineEvidence();
  evidence.ledgerHashes = hashes;
  evidence.catalog.sessionDigestColumn = true;
  evidence.catalog.sessionDigestDefinitionMatches = true;
  evidence.catalog.sessionDigestIndexes = [{ name: "auth_session_token_sha256_uq", schema: "auth", tableSchema: "auth", table: "session", isIndex: true, unique: true, valid: true }];
  assert.equal(classifyMigrationHistory(evidence, manifest), "verified-0000-through-0003");
  const plan = createIncrementalMigrationPlan({ evidence, attestation, root });
  assert.deepEqual(plan.migrationsToApply, []);
  assert.match(plan.nextAction, /No migration is pending/);
});

test("post-0003 ledger with an invalid generated-column index is ambiguous", () => {
  const evidence = baselineEvidence();
  evidence.ledgerHashes = hashes;
  evidence.catalog.sessionDigestColumn = true;
  evidence.catalog.sessionDigestDefinitionMatches = true;
  evidence.catalog.sessionDigestIndexes = [{ name: "auth_session_token_sha256_uq", schema: "auth", tableSchema: "auth", table: "session", isIndex: true, unique: true, valid: false }];
  assert.throws(() => classifyMigrationHistory(evidence, manifest), MigrationEvidenceError);
});

test("post-0003 history with a changed generated expression is ambiguous", () => {
  const evidence = baselineEvidence();
  evidence.ledgerHashes = hashes;
  evidence.catalog.sessionDigestColumn = true;
  evidence.catalog.sessionDigestIndexes = [{ name: "auth_session_token_sha256_uq", schema: "auth", tableSchema: "auth", table: "session", isIndex: true, unique: true, valid: true }];
  assert.throws(() => classifyMigrationHistory(evidence, manifest), MigrationEvidenceError);
});

test("pre-0003 state rejects a conflicting object with the future index name", () => {
  const evidence = baselineEvidence();
  evidence.catalog.sessionDigestIndexes = [{ name: "auth_session_token_sha256_uq", schema: "auth", tableSchema: "auth", table: "session", isIndex: false, unique: null, valid: null }];
  assert.throws(() => classifyMigrationHistory(evidence, manifest), MigrationEvidenceError);
});

for (const [label, mutate] of [
  ["one-entry partial ledger", (e) => { e.ledgerHashes = hashes.slice(0, 1); }],
  ["partial ledger", (e) => { e.ledgerHashes = hashes.slice(0, 2); }],
  ["unknown migration hash", (e) => { e.ledgerHashes[2] = "f".repeat(64); }],
  ["reordered ledger", (e) => { e.ledgerHashes.reverse(); }],
  ["unexpected table", (e) => { e.catalog.relations.push("app.unreviewed_table"); }],
  ["changed staging row counts", (e) => { e.stagingCounts["legacy.posts"] = 1; }],
  ["non-empty application data", (e) => { e.applicationRows = 1; }],
  ["ambiguous digest column", (e) => { e.catalog.sessionDigestColumn = true; }],
  ["missing evidence field", (e) => { delete e.provenanceRows; }],
]) {
  test(`rejects ${label}`, () => {
    const evidence = baselineEvidence();
    mutate(evidence);
    assert.throws(() => classifyMigrationHistory(evidence, manifest), MigrationEvidenceError);
  });
}

test("ambiguous empty database with leftover schema objects is rejected", () => {
  const evidence = emptyEvidence();
  evidence.catalog.relations.push("public.old_table");
  assert.throws(() => classifyMigrationHistory(evidence, manifest), MigrationEvidenceError);
});

test("empty target claim with staged rows is rejected", () => {
  const evidence = emptyEvidence();
  evidence.stagingCounts = { "legacy.posts": 1 };
  assert.throws(() => classifyMigrationHistory(evidence, manifest), MigrationEvidenceError);
});

test("Console attestation must match each pinned target field", () => {
  assert.throws(() => createIncrementalMigrationPlan({ evidence: baselineEvidence(), attestation: { ...attestation, endpoint: "ep-production" }, root }), MigrationEvidenceError);
  assert.throws(() => createIncrementalMigrationPlan({ evidence: baselineEvidence(), attestation: { ...attestation, consoleAttested: false }, root }), MigrationEvidenceError);
});

test("read-only evidence rejects production role/database/version and writable-session claims", () => {
  for (const override of [
    { database: "production" }, { postgresMajor: "17" }, { role: "drckgomz_content_reader" }, { transactionReadOnly: false },
  ]) {
    const evidence = baselineEvidence();
    evidence.connection = { ...evidence.connection, ...override };
    assert.throws(() => classifyMigrationHistory(evidence, manifest), MigrationEvidenceError);
  }
});

test("mutation approval requires Console attestation, explicit confirmation, and an approval reference", () => {
  assert.throws(() => assertMutationApproval({ attestation, manifestTarget: manifest.target, confirmSchemaApplication: false, approvalReference: "" }), MigrationEvidenceError);
  assert.equal(assertMutationApproval({ attestation, manifestTarget: manifest.target, confirmSchemaApplication: true, approvalReference: "phase3h-approved-0003" }), true);
});

test("planner contains no database client or migration execution path", () => {
  const source = readFileSync("scripts/phase3f/incremental-migration-plan.mjs", "utf8");
  assert.doesNotMatch(source, /@neondatabase|drizzle-orm\/neon|\bmigrate\s*\(/);
  assert.match(source, /This tool is plan-only and cannot execute migrations/);
});

test("planner rejects mutation mode without opening a database connection", () => {
  const result = spawnSync(process.execPath, ["scripts/phase3f/incremental-migration-plan.mjs", "--apply"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /plan-only and cannot execute migrations/);
});

test("evidence collector is read-only and refuses to run without target attestation flags", () => {
  const source = readFileSync("scripts/phase3f/collect-incremental-migration-evidence.mjs", "utf8");
  assert.match(source, /BEGIN READ ONLY/);
  assert.match(source, /statement_timeout = '15s'/);
  assert.match(source, /--console-attested/);
  assert.match(source, /\.env\.neon\.development\.local/);
  assert.doesNotMatch(source, /pool\.query\(\s*[`"']\s*(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE)\b/i);
  assert.match(source, /ROLLBACK/);
});
