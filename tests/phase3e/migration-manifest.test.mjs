import assert from "node:assert/strict";
import test from "node:test";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDevelopmentMigrationManifest } from "../../scripts/phase3f/development-migration-manifest.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
function fixture() {
  const temp = mkdtempSync(resolve(tmpdir(), "phase3f-manifest-"));
  cpSync(resolve(root, "drizzle"), resolve(temp, "drizzle"), { recursive: true });
  mkdirSync(resolve(temp, "scripts/phase3f"), { recursive: true });
  cpSync(resolve(root, "scripts/phase3f/development-migration-manifest.json"), resolve(temp, "scripts/phase3f/development-migration-manifest.json"));
  return temp;
}

test("manifest pins target, journal, all four migrations, and snapshots without reading environment files", () => {
  const manifest = loadDevelopmentMigrationManifest(root);
  assert.equal(manifest.target.branch, "br-nameless-dust-bewpmr4r");
  assert.equal(manifest.target.endpoint, "ep-sparkling-sun-bedq0ozn");
  assert.equal(manifest.target.database, "neondb");
  assert.deepEqual(manifest.migrations.map(({ tag }) => tag), [
    "0000_petite_loki", "0001_bitter_tiger_shark", "0002_many_kingpin", "0003_early_blizzard",
  ]);
});

test("manifest rejects an unexpected migration file", () => {
  const temp = fixture();
  try {
    writeFileSync(resolve(temp, "drizzle/0004_unreviewed.sql"), "-- synthetic unexpected migration\n");
    assert.throws(() => loadDevelopmentMigrationManifest(temp), /unreviewed SQL files/);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("manifest rejects a missing migration or modified snapshot", () => {
  const temp = fixture();
  try {
    rmSync(resolve(temp, "drizzle/0002_many_kingpin.sql"));
    assert.throws(() => loadDevelopmentMigrationManifest(temp), /missing or unreviewed SQL files/);
  } finally { rmSync(temp, { recursive: true, force: true }); }

  const second = fixture();
  try {
    writeFileSync(resolve(second, "drizzle/meta/0003_snapshot.json"), "{}\n");
    assert.throws(() => loadDevelopmentMigrationManifest(second), /snapshot checksum mismatch/);
  } finally { rmSync(second, { recursive: true, force: true }); }
});

test("manifest rejects journal edits and migration checksum drift", () => {
  const temp = fixture();
  try {
    const journalPath = resolve(temp, "drizzle/meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    journal.entries[3].tag = "0003_unreviewed";
    writeFileSync(journalPath, JSON.stringify(journal));
    assert.throws(() => loadDevelopmentMigrationManifest(temp), /manifest or journal differs/);
  } finally { rmSync(temp, { recursive: true, force: true }); }

  const second = fixture();
  try {
    writeFileSync(resolve(second, "drizzle/0003_early_blizzard.sql"), "-- changed checksum\n");
    assert.throws(() => loadDevelopmentMigrationManifest(second), /checksum mismatch/);
  } finally { rmSync(second, { recursive: true, force: true }); }
});
