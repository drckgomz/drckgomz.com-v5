import { loadDevelopmentMigrationManifest } from "./development-migration-manifest.mjs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_SCHEMAS = ["app", "auth", "drizzle", "legacy", "ops", "public"];
const EXPECTED_RELATIONS = [
  "app.categories", "app.home_media", "app.home_project_media", "app.home_projects",
  "app.home_sections", "app.media", "app.post_categories", "app.post_tags", "app.posts",
  "app.security_audit_events", "app.tags", "app.terminal_commands", "app.user_capabilities",
  "app.user_profiles", "app.user_roles", "auth.account", "auth.session", "auth.user",
  "auth.verification", "drizzle.__drizzle_migrations", "drizzle.__drizzle_migrations_id_seq", "legacy.bug_reports", "legacy.content",
  "legacy.content_media", "legacy.media", "legacy.post_media", "legacy.posts", "legacy.users",
  "ops.legacy_entity_map", "ops.legacy_import_runs",
];
const EXPECTED_ENUMS = ["public.content_visibility", "public.publication_state"];
const EXPECTED_STAGING_COUNTS = Object.freeze({
  "legacy.bug_reports": 0,
  "legacy.content": 6,
  "legacy.content_media": 3,
  "legacy.media": 10,
  "legacy.post_media": 2,
  "legacy.posts": 2,
  "legacy.users": 2,
});
const EXPECTED_PROVENANCE_ROWS = 25;
const EXPECTED_IMPORT_RUNS = 1;
const sameArray = (left, right) => Array.isArray(left) && JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
const sameObject = (left, right) => left && typeof left === "object" && !Array.isArray(left) &&
  JSON.stringify(Object.fromEntries(Object.entries(left).sort(([a], [b]) => a.localeCompare(b)))) ===
  JSON.stringify(Object.fromEntries(Object.entries(right).sort(([a], [b]) => a.localeCompare(b))));

export class MigrationEvidenceError extends Error {
  constructor(message = "Migration evidence is incomplete, unexpected, or ambiguous") {
    super(message);
    this.name = "MigrationEvidenceError";
  }
}

function verifyTarget(target, manifestTarget) {
  const keys = ["project", "branch", "endpoint", "hostname", "database", "postgresMajor"];
  if (!target || keys.some((key) => target[key] !== manifestTarget[key])) throw new MigrationEvidenceError("Target evidence does not match the pinned development target");
}

function isEmptyEvidence(evidence) {
  const allStagingCountsAreZero = evidence.stagingCounts && typeof evidence.stagingCounts === "object" &&
    !Array.isArray(evidence.stagingCounts) && Object.values(evidence.stagingCounts).every((count) => count === 0);
  return evidence.ledgerHashes.length === 0 && sameArray(evidence.catalog.schemas, ["public"]) &&
    evidence.catalog.relations.length === 0 && evidence.catalog.enums.length === 0 &&
    evidence.catalog.routines.length === 0 && evidence.catalog.sessionDigestColumn === false &&
    evidence.catalog.sessionDigestDefinitionMatches === false &&
    evidence.catalog.sessionTokenColumnMatches === false &&
    evidence.catalog.sessionDigestIndexes.length === 0 && allStagingCountsAreZero &&
    evidence.provenanceRows === 0 && evidence.importRuns === 0 &&
    evidence.applicationRows === 0 && evidence.authenticationRows === 0;
}

function isBaseSchemaEvidence(evidence) {
  return sameArray(evidence.catalog.schemas, EXPECTED_SCHEMAS) &&
    sameArray(evidence.catalog.relations, EXPECTED_RELATIONS) &&
    sameArray(evidence.catalog.enums, EXPECTED_ENUMS) && sameArray(evidence.catalog.routines, []) &&
    evidence.provenanceRows === EXPECTED_PROVENANCE_ROWS && evidence.importRuns === EXPECTED_IMPORT_RUNS &&
    sameObject(evidence.stagingCounts, EXPECTED_STAGING_COUNTS) &&
    evidence.applicationRows === 0 && evidence.authenticationRows === 0;
}

export function classifyMigrationHistory(evidence, manifest) {
  if (!evidence || evidence.evidenceVersion !== 1 || !Array.isArray(evidence.ledgerHashes) ||
      !evidence.catalog || !Array.isArray(evidence.catalog.schemas) || !Array.isArray(evidence.catalog.relations) ||
      !Array.isArray(evidence.catalog.enums) || !Array.isArray(evidence.catalog.routines) ||
      typeof evidence.catalog.sessionDigestColumn !== "boolean" ||
      typeof evidence.catalog.sessionDigestDefinitionMatches !== "boolean" ||
      typeof evidence.catalog.sessionTokenColumnMatches !== "boolean" ||
      !Array.isArray(evidence.catalog.sessionDigestIndexes) || !evidence.stagingCounts ||
      typeof evidence.stagingCounts !== "object" || Array.isArray(evidence.stagingCounts)) {
    throw new MigrationEvidenceError();
  }
  verifyTarget(evidence.target, manifest.target);
  if (evidence.connection?.database !== manifest.target.database ||
      evidence.connection?.postgresMajor !== manifest.target.postgresMajor ||
      evidence.connection?.role !== "neondb_owner" || evidence.connection?.transactionReadOnly !== true) {
    throw new MigrationEvidenceError("Read-only connection identity evidence does not match the reviewed development target");
  }
  const expectedHashes = manifest.migrations.map(({ sha256 }) => sha256);
  const hashes = evidence.ledgerHashes;

  if (isEmptyEvidence(evidence)) return "fresh-empty";
  if (hashes.length === 3 && hashes.every((hash, index) => hash === expectedHashes[index]) &&
      evidence.catalog.sessionDigestColumn === false && evidence.catalog.sessionDigestDefinitionMatches === false &&
      evidence.catalog.sessionTokenColumnMatches === true && evidence.catalog.sessionDigestIndexes.length === 0 &&
      isBaseSchemaEvidence(evidence)) {
    return "verified-0000-through-0002";
  }
  if (hashes.length === 4 && hashes.every((hash, index) => hash === expectedHashes[index]) &&
      isBaseSchemaEvidence(evidence) && evidence.catalog.sessionDigestColumn === true &&
      evidence.catalog.sessionDigestDefinitionMatches === true && evidence.catalog.sessionTokenColumnMatches === true &&
      evidence.catalog.sessionDigestIndexes.length === 1 &&
      evidence.catalog.sessionDigestIndexes[0]?.name === "auth_session_token_sha256_uq" &&
      evidence.catalog.sessionDigestIndexes[0]?.schema === "auth" && evidence.catalog.sessionDigestIndexes[0]?.table === "session" &&
      evidence.catalog.sessionDigestIndexes[0]?.tableSchema === "auth" &&
      evidence.catalog.sessionDigestIndexes[0]?.isIndex === true &&
      evidence.catalog.sessionDigestIndexes[0]?.unique === true && evidence.catalog.sessionDigestIndexes[0]?.valid === true) {
    return "verified-0000-through-0003";
  }
  throw new MigrationEvidenceError();
}

export function verifyConsoleAttestation(attestation, manifestTarget) {
  if (attestation?.consoleAttested !== true) throw new MigrationEvidenceError("Independent Neon Console attestation is required");
  verifyTarget(attestation, manifestTarget);
  return true;
}

export function assertMutationApproval({ attestation, manifestTarget, confirmSchemaApplication, approvalReference }) {
  verifyConsoleAttestation(attestation, manifestTarget);
  if (confirmSchemaApplication !== true || typeof approvalReference !== "string" || approvalReference.trim().length < 8) {
    throw new MigrationEvidenceError("Separate schema-application approval and reference are required");
  }
  return true;
}

export function createIncrementalMigrationPlan({ evidence, attestation, root }) {
  const manifest = loadDevelopmentMigrationManifest(root);
  verifyConsoleAttestation(attestation, manifest.target);
  const history = classifyMigrationHistory(evidence, manifest);

  if (history === "fresh-empty") return Object.freeze({
    mode: "plan-only",
    target: manifest.target,
    recognizedState: history,
    migrationsToApply: [],
    nextAction: "Use the separately reviewed fresh-database workflow for 0000–0003; this incremental plan does not target an empty database.",
    executionAllowed: false,
  });

  if (history === "verified-0000-through-0003") return Object.freeze({
    mode: "plan-only",
    target: manifest.target,
    recognizedState: history,
    migrationsToApply: [],
    nextAction: "No migration is pending. Do not rerun 0003.",
    executionAllowed: false,
  });

  const migration = manifest.migrations[3];
  return Object.freeze({
    mode: "plan-only",
    target: manifest.target,
    recognizedState: history,
    migrationsToApply: [{ tag: migration.tag, sha256: migration.sha256, snapshotSha256: migration.snapshotSha256 }],
    prerequisites: [
      "Fresh independent Neon Console attestation for the pinned project, development branch, endpoint, hostname, database, and PostgreSQL major version.",
      "Read-only catalog evidence exactly matches the 0000–0002 baseline and reviewed legacy staging/provenance counts.",
      "auth.session.token exists as non-null text, while token_sha256 and its index are absent.",
      "Separate explicit approval for schema application, recorded with an approval reference.",
      "PostgreSQL 18 review of generated-column/index semantics and a verified restore point for the development branch.",
    ],
    expectedPostconditions: [
      "Migration ledger contains exactly the four manifest hashes in order.",
      "auth.session.token_sha256 exists as a stored generated SHA-256 digest of auth.session.token.",
      "auth_session_token_sha256_uq exists, is unique, and is valid.",
      "The 25 legacy staging rows, 25 provenance mappings, and one import run are unchanged.",
      "Application/authentication row counts remain unchanged; no accounts, roles, or published content are created.",
    ],
    executionAllowed: false,
    approvalGate: "A separate approved execution runner must require --confirm-schema-application, a nonempty approval reference, and the same fresh Console attestation. This planner cannot mutate a database.",
  });
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--apply")) {
    process.stderr.write("This tool is plan-only and cannot execute migrations. Use a separately approved execution runner.\n");
    process.exitCode = 2;
  } else if (process.argv.includes("--plan")) {
    try {
      const evidencePath = argument("--evidence");
      if (!evidencePath || !process.argv.includes("--console-attested")) throw new MigrationEvidenceError("Plan requires local read-only evidence and independent Console attestation flags");
      const { readFileSync } = await import("node:fs");
      const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
      const attestation = {
        consoleAttested: true,
        project: argument("--project-id"),
        branch: argument("--branch-id"),
        endpoint: argument("--endpoint-id"),
        hostname: argument("--hostname"),
        database: argument("--database"),
        postgresMajor: argument("--postgres-major"),
      };
      const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
      const plan = createIncrementalMigrationPlan({ evidence, attestation, root });
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : "migration planning failed"}\n`);
      process.exitCode = 2;
    }
  } else {
    process.stderr.write("No action taken. Use --plan; this tool never executes migrations.\n");
    process.exitCode = 2;
  }
}
