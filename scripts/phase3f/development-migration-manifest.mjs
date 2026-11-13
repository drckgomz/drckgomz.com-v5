import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const PINNED_MANIFEST_SHA256 = "2e101ed07f0dc9d044a76f63f7d87d1e7055faaf2381eeabad9b2babf781e142";
const PINNED_TARGET = Object.freeze({
  project: "jolly-poetry-87664309",
  branch: "br-nameless-dust-bewpmr4r",
  endpoint: "ep-sparkling-sun-bedq0ozn",
  hostname: "ep-sparkling-sun-bedq0ozn.c-9.us-east-2.aws.neon.tech",
  database: "neondb",
  postgresMajor: "18",
});

export function loadDevelopmentMigrationManifest(root) {
  const manifestPath = resolve(root, "scripts/phase3f/development-migration-manifest.json");
  const drizzlePath = resolve(root, "drizzle");
  let manifest;
  let journal;
  try {
    const manifestBytes = readFileSync(manifestPath);
    if (sha256(manifestBytes) !== PINNED_MANIFEST_SHA256) throw new Error("manifest checksum mismatch");
    manifest = JSON.parse(manifestBytes.toString("utf8"));
    journal = readFileSync(resolve(drizzlePath, "meta/_journal.json"));
  } catch {
    throw new Error("development migration manifest or Drizzle journal is unavailable");
  }

  if (manifest.manifestVersion !== 1 || manifest.migrations?.length !== 4 ||
      sha256(journal) !== manifest.journalSha256 ||
      JSON.stringify(manifest.target) !== JSON.stringify(PINNED_TARGET)) {
    throw new Error("development migration manifest or journal differs from reviewed state");
  }

  let parsedJournal;
  try { parsedJournal = JSON.parse(journal.toString("utf8")); }
  catch { throw new Error("Drizzle journal is invalid"); }
  if (parsedJournal.version !== "7" || parsedJournal.dialect !== "postgresql" ||
      parsedJournal.entries?.length !== manifest.migrations.length) {
    throw new Error("Drizzle journal shape differs from reviewed migration state");
  }

  const expectedFiles = manifest.migrations.map(({ tag }) => `${tag}.sql`).sort();
  const sqlFiles = readdirSync(drizzlePath).filter((name) => name.endsWith(".sql")).sort();
  if (JSON.stringify(sqlFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error("Drizzle directory contains missing or unreviewed SQL files");
  }

  let previousWhen = -1;
  manifest.migrations.forEach((migration, index) => {
    const entry = parsedJournal.entries[index];
    if (!entry || entry.idx !== index || entry.tag !== migration.tag || entry.version !== "7" ||
        !Number.isSafeInteger(entry.when) || entry.when <= previousWhen || entry.breakpoints !== true) {
      throw new Error("Drizzle migration order or journal metadata changed");
    }
    previousWhen = entry.when;
    if (sha256(readFileSync(resolve(drizzlePath, `${migration.tag}.sql`))) !== migration.sha256) {
      throw new Error(`checksum mismatch for migration ${migration.tag}`);
    }
    const snapshotPath = resolve(drizzlePath, `meta/${String(index).padStart(4, "0")}_snapshot.json`);
    let snapshot;
    try { snapshot = readFileSync(snapshotPath); }
    catch { throw new Error(`snapshot missing for migration ${migration.tag}`); }
    if (migration.snapshotSha256 && sha256(snapshot) !== migration.snapshotSha256) {
      throw new Error(`snapshot checksum mismatch for migration ${migration.tag}`);
    }
  });

  const expectedSnapshots = manifest.migrations.map((_, index) => `${String(index).padStart(4, "0")}_snapshot.json`).sort();
  const snapshotFiles = readdirSync(resolve(drizzlePath, "meta")).filter((name) => /^\d{4}_snapshot\.json$/.test(name)).sort();
  if (JSON.stringify(snapshotFiles) !== JSON.stringify(expectedSnapshots)) {
    throw new Error("Drizzle metadata contains missing or unexpected snapshots");
  }

  return Object.freeze(manifest);
}
