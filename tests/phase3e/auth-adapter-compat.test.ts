import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { authAccounts, authSessions, authUsers, authVerifications } from "../../src/lib/db/schema";

const migration = readFileSync("drizzle/0000_petite_loki.sql", "utf8");
const digestMigration = readFileSync("drizzle/0003_early_blizzard.sql", "utf8");
const authConfig = readFileSync("src/lib/auth/better-auth.ts", "utf8");
const ownerBootstrap = readFileSync("src/lib/auth/bootstrap-first-owner.ts", "utf8");
const ownerBootstrapRunner = readFileSync("scripts/phase3j5a/bootstrap-first-owner-development.mjs", "utf8");
const migrationRunner = readFileSync("scripts/phase3f/apply-development-migrations.mjs", "utf8");
const migrationVerifier = readFileSync("scripts/phase3f/verify-development-migrations.mjs", "utf8");
const importVerifier = readFileSync("scripts/phase3i/verify-legacy-import.mjs", "utf8");

test("Better Auth Drizzle tables match the reviewed auth schema migration", () => {
  const tables = [authUsers, authSessions, authAccounts, authVerifications];
  for (const table of tables) {
    const config = getTableConfig(table);
    assert.equal(config.schema, "auth", `${config.name} must stay in the auth schema`);
    const createTable = new RegExp(`CREATE TABLE \\"auth\\"\\.\\"${config.name}\\" \\(([\\s\\S]*?)\\n\\);`).exec(migration);
    assert.ok(createTable, `migration must create auth.${config.name}`);
    const migrationColumns = [...createTable[1].matchAll(/^\s*"([^"]+)"\s+/gm)].map((match) => match[1]);
    const schemaColumns = config.columns.map((column) => column.name);
    if (config.name === "session") {
      assert.deepEqual(migrationColumns.sort(), schemaColumns.filter((name) => name !== "token_sha256").sort(), `${config.name} Better Auth base column mapping drift`);
      assert.match(digestMigration, /ALTER TABLE "auth"\."session" ADD COLUMN "token_sha256" text;/);
      assert.match(digestMigration, /CREATE TRIGGER "auth_session_token_sha256_trg"/);
      assert.match(digestMigration, /ALTER TABLE "auth"\."session" ALTER COLUMN "token_sha256" SET NOT NULL/);
      assert.match(digestMigration, /CREATE UNIQUE INDEX "auth_session_token_sha256_uq"/);
    } else {
      assert.deepEqual(migrationColumns.sort(), schemaColumns.sort(), `${config.name} column mapping drift`);
    }
  }
});

test("Better Auth adapter explicitly maps all core models to the auth schema tables", () => {
  assert.match(authConfig, /basePath:\s*"\/api\/auth"/);
  assert.match(authConfig, /schemaName:\s*"auth"/);
  assert.match(authConfig, /schema:\s*\{\s*user:\s*authUsers,\s*session:\s*authSessions,\s*account:\s*authAccounts,\s*verification:\s*authVerifications,/);
  assert.match(authConfig, /encryptOAuthTokens:\s*true/);
  assert.match(authConfig, /accountLinking:\s*\{\s*enabled:\s*false,\s*disableImplicitLinking:\s*true/);
  assert.match(authConfig, /trustedOrigins:\s*socialProviders\.apple\s*\?\s*\[baseURL,\s*"https:\/\/appleid\.apple\.com"\]\s*:\s*\[baseURL\]/);
});

test("owner bootstrap runner is exact-target, explicit-file, dry-run-first, and approval gated", () => {
  assert.match(ownerBootstrapRunner, /\.env\.neon\.bootstrap\.development\.local/);
  assert.match(ownerBootstrapRunner, /check-ignore/);
  assert.doesNotMatch(ownerBootstrapRunner, /\.env\.local/);
  assert.match(ownerBootstrapRunner, /--dry-run/);
  assert.match(ownerBootstrapRunner, /--apply/);
  assert.match(ownerBootstrapRunner, /--console-identity-verified/);
  assert.match(ownerBootstrapRunner, /--confirm-owner-bootstrap/);
  assert.match(ownerBootstrapRunner, /--approval-ref/);
  assert.match(ownerBootstrapRunner, /--owner-user-id/);
  assert.match(ownerBootstrapRunner, /BEGIN READ ONLY/);
  assert.match(ownerBootstrapRunner, /statement_timeout = '15s'/);
  assert.match(ownerBootstrapRunner, /bootstrapFirstOwner\(\{ userId, separatelyApproved: true, evidenceRef \}\)/);
  assert.match(ownerBootstrapRunner, /identity and credentials were not logged/i);
  assert.doesNotMatch(ownerBootstrapRunner, /console\.(?:log|error)\([^\n]*(?:databaseUrl|ownerUserId|userId|password)/i);
});

test("database preparation runners reject hostname lookalikes with exact host equality", () => {
  for (const source of [migrationRunner, migrationVerifier, importVerifier]) {
    assert.match(source, /hostname\s*!==\s*target\.hostname/);
    assert.doesNotMatch(source, /hostname\.startsWith\(/);
  }
});

test("first-owner bootstrap reuses and locks the OAuth-created active profile", () => {
  assert.match(ownerBootstrap, /getDatabase\("drckgomz_bootstrap"\)/);
  assert.match(ownerBootstrap, /from\(userProfiles\)\.where\(eq\(userProfiles\.id, input\.userId\)\)\.for\("update"\)/);
  assert.match(ownerBootstrap, /activeProfile:\s*profile\?\.enabled === true && profile\.bannedAt === null/);
  assert.doesNotMatch(ownerBootstrap, /tx\.insert\(userProfiles\)/);
});
