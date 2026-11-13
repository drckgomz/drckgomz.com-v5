import assert from "node:assert/strict";
import test from "node:test";
import { MissingConfigurationError, parseAuthConfiguration } from "../../src/lib/db/config";
import { NEON_DEVELOPMENT_TARGET, UnverifiedNeonDevelopmentTargetError, parseNeonDevelopmentRuntimeTarget } from "../../src/lib/db/neon-development-target";

const t = NEON_DEVELOPMENT_TARGET;
const valid = {
  DATABASE_URL: `postgresql://${t.runtimeRole}:synthetic-password@${t.hostname}/${t.database}?sslmode=require`,
  NEON_TARGET: "development",
  NEON_PROJECT_ID: t.project,
  NEON_BRANCH_ID: t.branch,
  NEON_ENDPOINT_ID: t.endpoint,
};

test("accepts only the exact reviewed development target and non-owner runtime role", () => {
  const config = parseNeonDevelopmentRuntimeTarget(valid);
  assert.equal(config.target.project, t.project);
  assert.equal(config.target.branch, t.branch);
  assert.equal(config.target.endpoint, t.endpoint);
});

test("each isolated pool requires its own exact role URL and the same pinned endpoint", () => {
  for (const [variable, role] of [
    ["NEON_AUTH_DATABASE_URL", "drckgomz_auth_runtime"],
    ["NEON_CONTENT_DATABASE_URL", "drckgomz_content_reader"],
    ["NEON_OWNER_DATABASE_URL", "drckgomz_owner_runtime"],
  ]) {
    const url = `postgresql://${role}:synthetic-password@${t.hostname}/${t.database}?sslmode=require`;
    const parsed = parseNeonDevelopmentRuntimeTarget({ ...valid, [variable]: url }, role, variable);
    assert.equal(parsed.role, role);
    assert.equal(parsed.connectionVariable, variable);
    assert.equal(parsed.databaseUrl, url);
    assert.throws(() => parseNeonDevelopmentRuntimeTarget({ ...valid, [variable]: undefined }, role, variable), UnverifiedNeonDevelopmentTargetError);
    assert.throws(() => parseNeonDevelopmentRuntimeTarget({ ...valid, [variable]: url.replace(role, "drckgomz_runtime") }, role, variable), UnverifiedNeonDevelopmentTargetError);
  }
});

for (const [label, override] of [
  ["wrong project", { NEON_PROJECT_ID: "another-project" }],
  ["wrong branch", { NEON_BRANCH_ID: "br-polished-shape-be2nmkl4" }],
  ["wrong endpoint", { NEON_ENDPOINT_ID: "ep-production-lookalike" }],
  ["production target selector", { NEON_TARGET: "production" }],
  ["missing branch metadata", { NEON_BRANCH_ID: undefined }],
  ["missing target selector", { NEON_TARGET: undefined }],
  ["missing endpoint metadata", { NEON_ENDPOINT_ID: undefined }],
  ["missing project metadata", { NEON_PROJECT_ID: undefined }],
  ["missing database URL", { DATABASE_URL: undefined }],
  ["wrong host", { DATABASE_URL: valid.DATABASE_URL.replace(t.hostname, "db.invalid") }],
  ["hostname lookalike", { DATABASE_URL: valid.DATABASE_URL.replace(t.hostname, `${t.hostname}.attacker.invalid`) }],
  ["production-like host", { DATABASE_URL: valid.DATABASE_URL.replace(t.hostname, "ep-polished-shape-be2nmkl4.c-9.us-east-2.aws.neon.tech") }],
  ["wrong database", { DATABASE_URL: valid.DATABASE_URL.replace("/neondb?", "/production?") }],
  ["owner role", { DATABASE_URL: valid.DATABASE_URL.replace(t.runtimeRole, "neondb_owner") }],
  ["missing TLS requirement", { DATABASE_URL: valid.DATABASE_URL.replace("?sslmode=require", "") }],
  ["weak TLS mode", { DATABASE_URL: valid.DATABASE_URL.replace("sslmode=require", "sslmode=verify-ca") }],
  ["unexpected URL parameter", { DATABASE_URL: `${valid.DATABASE_URL}&options=-csearch_path%3Dpublic` }],
] as const) {
  test(`fails closed on ${label}`, () => {
    assert.throws(() => parseNeonDevelopmentRuntimeTarget({ ...valid, ...override }), UnverifiedNeonDevelopmentTargetError);
  });
}

test("Better Auth reports missing target metadata without falling back to DATABASE_URL alone", () => {
  assert.throws(() => parseAuthConfiguration({
    NEON_AUTH_DATABASE_URL: `postgresql://drckgomz_auth_runtime:synthetic-password@${t.hostname}/${t.database}?sslmode=require`,
    BETTER_AUTH_SECRET: "x".repeat(32),
    BETTER_AUTH_URL: "http://localhost:3000",
  }), (error) => error instanceof MissingConfigurationError &&
    ["NEON_TARGET", "NEON_PROJECT_ID", "NEON_BRANCH_ID", "NEON_ENDPOINT_ID"].every((name) => error.missing.includes(name)));
});

test("target failures never echo the supplied password or URL", () => {
  const secretUrl = valid.DATABASE_URL.replace("synthetic-password", "do-not-print-this").replace(t.hostname, "incorrect.invalid");
  let message = "";
  try { parseNeonDevelopmentRuntimeTarget({ ...valid, DATABASE_URL: secretUrl }); }
  catch (error) { message = String(error); }
  assert.equal(message.includes("do-not-print-this"), false);
  assert.equal(message.includes(secretUrl), false);
});

test("Drizzle validates target and role before returning a cached pool", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("src/lib/db/client.ts", "utf8");
  assert.match(source, /parseNeonDevelopmentRuntimeTarget\(process\.env, expectedRole, connectionVariable\)/);
  assert.match(source, /getAuthDatabase\(\)[\s\S]*NEON_AUTH_DATABASE_URL/);
  assert.match(source, /getContentDatabase\(\)[\s\S]*NEON_CONTENT_DATABASE_URL/);
  assert.match(source, /getOwnerOperationDatabase\(\)[\s\S]*NEON_OWNER_DATABASE_URL/);
  assert.doesNotMatch(source, /NEON_(?:AUTH|CONTENT|OWNER)_DATABASE_URL[^\n]*\?\?/);
});
