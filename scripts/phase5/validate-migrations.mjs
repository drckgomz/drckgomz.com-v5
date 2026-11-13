import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PINNED_MANIFEST_SHA256 = "d0721ceacce2fc57441cb49ffa81d58aaf45038277f2692f729e6a9ac6f14962";
const PINNED_TARGET = {
  project: "jolly-poetry-87664309",
  branch: "br-nameless-dust-bewpmr4r",
  endpoint: "ep-sparkling-sun-bedq0ozn",
  hostname: "ep-sparkling-sun-bedq0ozn.c-9.us-east-2.aws.neon.tech",
  database: "neondb",
  postgresMajor: "18",
};
const RLS_TABLES = ["audience_groups", "audience_memberships", "post_access_grants", "post_access_requests", "site_media", "appearance_settings"];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function validateMigrationArtifacts(root) {
  const manifestBytes = readFileSync(resolve(root, "scripts/phase5/migration-manifest.json"));
  if (sha256(manifestBytes) !== PINNED_MANIFEST_SHA256) throw new Error("Phase 5 migration manifest checksum mismatch");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (manifest.manifestVersion !== 1 || manifest.purpose !== "offline-validation-only" ||
      JSON.stringify(manifest.target) !== JSON.stringify(PINNED_TARGET) || manifest.migrations?.length !== 6) {
    throw new Error("Phase 5 migration manifest target or shape mismatch");
  }
  const oldManifestBytes = readFileSync(resolve(root, "scripts/phase3f/development-migration-manifest.json"));
  if (sha256(oldManifestBytes) !== manifest.priorPhase3FManifestSha256) throw new Error("Previously reviewed Phase 3F manifest changed");

  const drizzle = resolve(root, "drizzle");
  const journalBytes = readFileSync(resolve(drizzle, "meta/_journal.json"));
  if (sha256(journalBytes) !== manifest.journalSha256) throw new Error("Drizzle journal checksum mismatch");
  const journal = JSON.parse(journalBytes.toString("utf8"));
  if (journal.version !== "7" || journal.dialect !== "postgresql" || journal.entries?.length !== manifest.migrations.length) {
    throw new Error("Drizzle journal shape mismatch");
  }

  const sqlFiles = readdirSync(drizzle).filter((name) => name.endsWith(".sql")).sort();
  const expectedSql = manifest.migrations.map(({ tag }) => `${tag}.sql`).sort();
  if (JSON.stringify(sqlFiles) !== JSON.stringify(expectedSql)) throw new Error("Unexpected or missing Drizzle SQL migration");
  const snapshotsDir = resolve(drizzle, "meta");
  const snapshotFiles = readdirSync(snapshotsDir).filter((name) => /^\d{4}_snapshot\.json$/.test(name)).sort();
  const expectedSnapshots = manifest.migrations.map((_, i) => `${String(i).padStart(4, "0")}_snapshot.json`);
  if (JSON.stringify(snapshotFiles) !== JSON.stringify(expectedSnapshots)) throw new Error("Unexpected or missing Drizzle schema snapshot");

  let priorWhen = -1;
  for (const [index, migration] of manifest.migrations.entries()) {
    const entry = journal.entries[index];
    if (entry?.idx !== index || entry.tag !== migration.tag || entry.version !== "7" ||
        !Number.isSafeInteger(entry.when) || entry.when <= priorWhen || entry.breakpoints !== true) {
      throw new Error("Migration journal order or metadata mismatch");
    }
    priorWhen = entry.when;
    if (sha256(readFileSync(resolve(drizzle, `${migration.tag}.sql`))) !== migration.sha256 ||
        sha256(readFileSync(resolve(snapshotsDir, expectedSnapshots[index]))) !== migration.snapshotSha256) {
      throw new Error(`Migration or snapshot checksum mismatch at index ${index}`);
    }
  }

  const newMigration = readFileSync(resolve(drizzle, "0004_sour_catseye.sql"), "utf8");
  for (const table of RLS_TABLES) {
    if (!newMigration.includes(`ALTER TABLE "app"."${table}" ENABLE ROW LEVEL SECURITY`) ||
        !newMigration.includes(`ALTER TABLE "app"."${table}" FORCE ROW LEVEL SECURITY`)) {
      throw new Error("New audience/appearance table is missing forced RLS");
    }
  }
  if (!newMigration.includes("REVOKE ALL ON TABLE") || /GRANT\s+[^;]+\s+ON\s+TABLE\s+"app"\./i.test(newMigration)) {
    throw new Error("New audience/appearance migration is not deny-by-default");
  }
  return Object.freeze({
    target: manifest.target,
    migrationCount: manifest.migrations.length,
    migrationHashes: Object.freeze(manifest.migrations.map(({ sha256: migrationHash }) => migrationHash)),
    nextMigration: "0005_session_digest_adapter_default",
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = validateMigrationArtifacts(process.cwd());
    console.log(`Offline migration artifacts verified (${result.migrationCount} ordered migrations). No database was contacted.`);
  } catch {
    console.error("Offline migration artifact validation failed; no database was contacted.");
    process.exitCode = 1;
  }
}
