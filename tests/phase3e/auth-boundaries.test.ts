import test from "node:test";
import assert from "node:assert/strict";
import { configuredSocialProviderIds, InvalidConfigurationError, MissingConfigurationError, parseAuthConfiguration, parseDatabaseConfiguration } from "../../src/lib/db/config";
import { NEON_DEVELOPMENT_TARGET } from "../../src/lib/db/neon-development-target";
import { canReadPost, isAdmin, readablePostStatuses } from "../../src/lib/auth/policy";
import { initialOwnerDenial } from "../../src/lib/auth/owner-bootstrap-policy";
import { newPublicMemberProfile } from "../../src/lib/auth/registration-policy";
import { safeAuthRedirect } from "../../src/lib/auth/redirect";

test("database configuration reports only missing variable names", () => {
  assert.throws(() => parseDatabaseConfiguration({}), (error) => {
    assert.ok(error instanceof MissingConfigurationError);
    assert.equal(error.message, "Service configuration is missing: DATABASE_URL");
    return true;
  });
});

test("auth config rejects short secrets and non-HTTPS production origins", () => {
  const base = {
    NEON_AUTH_DATABASE_URL: `postgresql://drckgomz_auth_runtime:password@${NEON_DEVELOPMENT_TARGET.hostname}/${NEON_DEVELOPMENT_TARGET.database}?sslmode=require`,
    NEON_TARGET: "development", NEON_PROJECT_ID: NEON_DEVELOPMENT_TARGET.project,
    NEON_BRANCH_ID: NEON_DEVELOPMENT_TARGET.branch, NEON_ENDPOINT_ID: NEON_DEVELOPMENT_TARGET.endpoint,
    BETTER_AUTH_SECRET: "x".repeat(32), BETTER_AUTH_URL: "https://example.test",
  };
  assert.equal(parseAuthConfiguration(base).baseURL, "https://example.test");
  assert.throws(() => parseAuthConfiguration({ ...base, BETTER_AUTH_SECRET: "short" }), InvalidConfigurationError);
  assert.throws(() => parseAuthConfiguration({ ...base, NODE_ENV: "production", BETTER_AUTH_URL: "http://example.test" }), InvalidConfigurationError);
  assert.throws(() => parseAuthConfiguration({ ...base, NEON_AUTH_DATABASE_URL: "not-a-database-url" }));
  assert.throws(() => parseAuthConfiguration({ ...base, BETTER_AUTH_URL: "https://example.test/custom/path" }), InvalidConfigurationError);
});

test("auth callback redirects accept local paths and reject hostile or malformed targets", () => {
  assert.equal(safeAuthRedirect("/admin/private-access"), "/admin/private-access");
  assert.equal(safeAuthRedirect(["/blog", "https://attacker.invalid"]), "/blog");
  for (const target of ["https://attacker.invalid", "//attacker.invalid", "/\\attacker.invalid", "/%2f%2fattacker.invalid", "/%5c%5cattacker.invalid", "/%0d%0aLocation:evil", "/%ZZ"]) {
    assert.equal(safeAuthRedirect(target), "/blog", target);
  }
});

test("OAuth provider configuration is optional by provider but rejects partial credentials", () => {
  const base = {
    NEON_AUTH_DATABASE_URL: `postgresql://drckgomz_auth_runtime:password@${NEON_DEVELOPMENT_TARGET.hostname}/${NEON_DEVELOPMENT_TARGET.database}?sslmode=require`,
    NEON_TARGET: "development", NEON_PROJECT_ID: NEON_DEVELOPMENT_TARGET.project,
    NEON_BRANCH_ID: NEON_DEVELOPMENT_TARGET.branch, NEON_ENDPOINT_ID: NEON_DEVELOPMENT_TARGET.endpoint,
    BETTER_AUTH_SECRET: "x".repeat(32), BETTER_AUTH_URL: "https://example.test",
  };
  assert.deepEqual(parseAuthConfiguration(base).socialProviders, {});
  const configured = parseAuthConfiguration({
    ...base,
    BETTER_AUTH_GOOGLE_CLIENT_ID: "google-client-id",
    BETTER_AUTH_GOOGLE_CLIENT_SECRET: "not-a-real-secret",
    BETTER_AUTH_APPLE_CLIENT_ID: "apple-client-id",
    BETTER_AUTH_APPLE_CLIENT_SECRET: "not-a-real-secret",
  });
  assert.deepEqual(Object.keys(configured.socialProviders).sort(), ["apple", "google"]);
  assert.equal(configured.socialProviders.apple?.requireEmailVerification, true);
  assert.equal(configured.socialProviders.google?.requireEmailVerification, true);
  assert.deepEqual(configuredSocialProviderIds({
    BETTER_AUTH_APPLE_CLIENT_ID: "apple-client-id",
    BETTER_AUTH_APPLE_CLIENT_SECRET: "apple-secret",
  }), ["apple"]);
  assert.throws(() => parseAuthConfiguration({ ...base, BETTER_AUTH_GOOGLE_CLIENT_ID: "partial" }), InvalidConfigurationError);
  assert.throws(() => parseAuthConfiguration({
    ...base,
    BETTER_AUTH_GOOGLE_CLIENT_ID: "   ",
    BETTER_AUTH_GOOGLE_CLIENT_SECRET: "   ",
  }), InvalidConfigurationError);
});

test("new OAuth members receive an active public profile without roles or private grants", () => {
  const profile = newPublicMemberProfile("synthetic-auth-user");
  assert.deepEqual(profile, {
    id: "synthetic-auth-user",
    username: "member-synthetic-auth-user",
    enabled: true,
    firstName: null,
  });
  const access = { ...profile, is_banned: false, can_view_private: false };
  assert.equal(canReadPost({ status: "public" }, access), true);
  assert.equal(canReadPost({ status: "private" }, access), false);
  assert.equal(canReadPost({ status: "draft" }, access), false);
});

test("private journal audience requires an explicit grant and remains revocable", () => {
  const publicMember = { id: "member", enabled: true, is_banned: false, can_view_private: false };
  const approvedAudienceMember = { ...publicMember, can_view_private: true };
  assert.equal(canReadPost({ status: "private" }, publicMember), false);
  assert.equal(canReadPost({ status: "private" }, approvedAudienceMember), true);
  assert.equal(canReadPost({ status: "private" }, { ...approvedAudienceMember, enabled: false }), false);
});

test("unknown users and imported admin claims do not authorize anything", () => {
  const imported = { id: "legacy", enabled: false, is_banned: false, role: "admin" };
  assert.equal(isAdmin(imported), false);
  assert.deepEqual(readablePostStatuses(imported), []);
  assert.equal(canReadPost({ status: "public" }, imported), false);
});

test("public content excludes private, draft, archived, and deleted content", () => {
  const anonymous = null;
  assert.equal(canReadPost({ status: "public" }, anonymous), true);
  for (const status of ["private", "draft", "archived", "active", "unknown"]) {
    assert.equal(canReadPost({ status }, anonymous), false, status);
  }
  assert.equal(canReadPost({ status: "public", deleted_at: "2020-01-01" }, anonymous), false);
});

test("owner bootstrap requires approval, verified identity, and no existing owner", () => {
  const approved = { separatelyApproved: true, verifiedBetterAuthIdentity: true, activeProfile: true, activeOwnerCount: 0, evidenceRef: "approved-ticket-123" };
  assert.equal(initialOwnerDenial(approved), null);
  assert.equal(initialOwnerDenial({ ...approved, separatelyApproved: false }), "approval-required");
  assert.notEqual(initialOwnerDenial({ ...approved, activeOwnerCount: 1 }), null);
  assert.notEqual(initialOwnerDenial({ ...approved, evidenceRef: "" }), null);
  assert.equal(initialOwnerDenial({ ...approved, activeProfile: false }), "active-profile-required");
});
