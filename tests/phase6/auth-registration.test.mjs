import assert from "node:assert/strict";
import test from "node:test";
import { isStrongPassword, validateRegistrationInput } from "../../src/lib/auth/password-policy.ts";
import { newPublicMemberProfile } from "../../src/lib/auth/registration-policy.ts";
import { hasValidLocalAuthRuntimeConfiguration } from "../../src/lib/auth/local-runtime-policy.ts";
import { resolveProfileDisplayName } from "../../src/lib/profile/display-name.ts";

const goodPassword = "LocalMember!2026";
const localEnv = {
  NODE_ENV: "development",
  LOCAL_PG_INTEGRATION: "1",
  LOCAL_PG_TARGET: "phase6-local",
  LOCAL_PG_AUTH_DATABASE_URL: "postgresql://drckgomz_local_auth@127.0.0.1:55441/drckgomz_phase5_test?sslmode=disable",
  LOCAL_PG_CONTENT_DATABASE_URL: "postgresql://drckgomz_local_content@127.0.0.1:55441/drckgomz_phase5_test?sslmode=disable",
  LOCAL_PG_OWNER_DATABASE_URL: "postgresql://drckgomz_local_owner@127.0.0.1:55441/drckgomz_phase5_test?sslmode=disable",
  BETTER_AUTH_SECRET: "x".repeat(48),
  BETTER_AUTH_URL: "http://localhost:3000",
};

test("registration accepts a valid public account and assigns only a baseline profile", () => {
  assert.equal(validateRegistrationInput({ name: "Reader", email: "reader@example.test", password: goodPassword }), true);
  const profile = newPublicMemberProfile("synthetic-user-id");
  assert.equal(profile.enabled, true);
  assert.equal("role" in profile, false);
  assert.equal("capability" in profile, false);
  assert.equal("can_view_private" in profile, false);
});

test("display names come from Better Auth name and never fall back to the internal profile username", () => {
  assert.equal(resolveProfileDisplayName("Derick Gomez", "Derick", "Gomez"), "Derick Gomez");
  assert.equal(resolveProfileDisplayName("Member Custom", "Earlier", "Profile"), "Member Custom");
  assert.equal(resolveProfileDisplayName(null, "Derick", "Gomez"), "Derick Gomez");
  assert.equal(resolveProfileDisplayName("Custom Name", "Earlier", "Profile"), "Custom Name");
});

test("registration rejects malformed names, emails, and weak passwords", () => {
  for (const password of ["short", "alllowercase123!", "ALLUPPERCASE123!", "NoNumberOrSymbolPassword"]) {
    assert.equal(isStrongPassword(password), false);
    assert.equal(validateRegistrationInput({ name: "Reader", email: "reader@example.test", password }), false);
  }
  assert.equal(validateRegistrationInput({ name: " \n ", email: "reader@example.test", password: goodPassword }), false);
  assert.equal(validateRegistrationInput({ name: "Reader", email: "not-an-email", password: goodPassword }), false);
  assert.equal(validateRegistrationInput({ name: "Reader\u0000", email: "reader@example.test", password: goodPassword }), false);
});

test("local auth accepts only the pinned localhost:3000 auth URL", () => {
  assert.equal(hasValidLocalAuthRuntimeConfiguration(localEnv), true);
  for (const mutate of [
    (env) => { env.BETTER_AUTH_URL = "http://127.0.0.1:3001"; },
    (env) => { env.NODE_ENV = "production"; },
    (env) => { env.BETTER_AUTH_SECRET = "short"; },
  ]) {
    const env = { ...localEnv };
    mutate(env);
    assert.equal(hasValidLocalAuthRuntimeConfiguration(env), false);
  }
});
