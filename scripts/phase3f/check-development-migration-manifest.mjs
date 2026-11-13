#!/usr/bin/env node
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDevelopmentMigrationManifest } from "./development-migration-manifest.mjs";

try {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const manifest = loadDevelopmentMigrationManifest(root);
  process.stdout.write(`Offline manifest valid for pinned development target; ${manifest.migrations.length} migrations verified. No connection attempted.\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "migration manifest validation failed"}\n`);
  process.exitCode = 1;
}
