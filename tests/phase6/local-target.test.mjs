import assert from "node:assert/strict";
import test from "node:test";
import { parseLocalPostgresTarget, verifyAllLocalPostgresTargets, UnverifiedLocalPostgresTargetError } from "../../src/lib/db/local-postgres-target.ts";

const base = {
  NODE_ENV: "development",
  LOCAL_PG_INTEGRATION: "1",
  LOCAL_PG_TARGET: "phase6-local",
  LOCAL_PG_AUTH_DATABASE_URL: "postgresql://drckgomz_local_auth@127.0.0.1:55441/drckgomz_phase5_test?sslmode=disable",
  LOCAL_PG_CONTENT_DATABASE_URL: "postgresql://drckgomz_local_content@127.0.0.1:55441/drckgomz_phase5_test?sslmode=disable",
  LOCAL_PG_OWNER_DATABASE_URL: "postgresql://drckgomz_local_owner@127.0.0.1:55441/drckgomz_phase5_test?sslmode=disable",
};

test("accepts only the explicit local development role URLs for the pinned disposable target", () => {
  assert.equal(verifyAllLocalPostgresTargets(base).owner.role, "drckgomz_local_owner");
});

for (const [name, mutate] of [
  ["production mode", (env) => { env.NODE_ENV = "production"; }],
  ["missing opt-in", (env) => { delete env.LOCAL_PG_INTEGRATION; }],
  ["offline fixture mode", (env) => { env.OFFLINE_DESIGN_MODE = "1"; }],
  ["wrong target selector", (env) => { env.LOCAL_PG_TARGET = "production"; }],
  ["lookalike hostname", (env) => { env.LOCAL_PG_OWNER_DATABASE_URL = env.LOCAL_PG_OWNER_DATABASE_URL.replace("127.0.0.1", "127.0.0.10"); }],
  ["wrong port", (env) => { env.LOCAL_PG_OWNER_DATABASE_URL = env.LOCAL_PG_OWNER_DATABASE_URL.replace("55441", "55440"); }],
  ["wrong database", (env) => { env.LOCAL_PG_OWNER_DATABASE_URL = env.LOCAL_PG_OWNER_DATABASE_URL.replace("drckgomz_phase5_test", "neondb"); }],
  ["wrong role", (env) => { env.LOCAL_PG_OWNER_DATABASE_URL = env.LOCAL_PG_OWNER_DATABASE_URL.replace("drckgomz_local_owner", "phase5_local"); }],
  ["password-bearing URL", (env) => { env.LOCAL_PG_OWNER_DATABASE_URL = env.LOCAL_PG_OWNER_DATABASE_URL.replace("@127.0.0.1", ":secret@127.0.0.1"); }],
  ["unexpected query parameter", (env) => { env.LOCAL_PG_OWNER_DATABASE_URL += "&options=--cluster=prod"; }],
  ["missing role URL", (env) => { delete env.LOCAL_PG_CONTENT_DATABASE_URL; }],
]) {
  test(`fails closed for ${name}`, () => {
    const env = { ...base };
    mutate(env);
    assert.throws(() => name === "missing role URL" ? verifyAllLocalPostgresTargets(env) : parseLocalPostgresTarget(env, "owner"), UnverifiedLocalPostgresTargetError);
  });
}
