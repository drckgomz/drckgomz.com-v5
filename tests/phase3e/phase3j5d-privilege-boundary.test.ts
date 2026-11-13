import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { digestSessionToken, isSessionTokenDigest } from "../../src/lib/auth/session-token-digest-policy";
import { withoutSessionToken } from "../../src/lib/auth/public-session-payload";

const migration = readFileSync("drizzle/manual/phase3j5d_privilege_isolation.sql", "utf8");
const digestMigration = readFileSync("drizzle/0003_early_blizzard.sql", "utf8");
const roles = readFileSync("scripts/phase3j5c/create-development-isolated-roles-review-only.sql", "utf8");
const contentGrant = readFileSync("scripts/phase3j5c/grant-content-reader-review-only.sql", "utf8");
const ownerStore = readFileSync("src/lib/auth/private-audience-store.ts", "utf8");
const contentSession = readFileSync("src/lib/db/content-session.ts", "utf8");
const digestSource = readFileSync("src/lib/auth/session-token-digest.ts", "utf8");

test("session token digest is deterministic SHA-256 and format checked", () => {
  const digest = digestSessionToken("synthetic-session-token-value-32chars");
  assert.equal(digest, "fd8c836d2ef6a5c45726bf6eec4aa053bea0fd80573519c0d827f2757d160ede");
  assert.equal(isSessionTokenDigest(digest), true);
  assert.equal(isSessionTokenDigest("synthetic-session-token-value-32chars"), false);
  assert.equal(isSessionTokenDigest("a".repeat(64)), true);
  assert.equal(isSessionTokenDigest("g".repeat(64)), false);
});

test("browser-facing Better Auth get-session payload omits its bearer token", () => {
  const safe = withoutSessionToken({ session: { id: "synthetic-session", token: "secret-bearer", expiresAt: "future" }, user: { id: "synthetic-user" } }) as {
    session: Record<string, unknown>; user: { id: string };
  };
  assert.deepEqual(safe.session, { id: "synthetic-session", expiresAt: "future" });
  assert.equal("token" in safe.session, false);
  assert.deepEqual(safe.user, { id: "synthetic-user" });
});

test("Better Auth session token is digested server-side and only the digest is passed to content transactions", () => {
  assert.match(digestSource, /session\?\.session\?\.token/);
  assert.match(digestSource, /digestSessionToken\(token\)/);
  assert.doesNotMatch(digestSource, /return token\b|console\.(?:log|info|debug)/);
  assert.match(contentSession, /db\.transaction\(async \(tx\)/);
  assert.match(contentSession, /set_config\('app\.session_token_sha256', \$\{safeDigest\}, true\)/);
  assert.match(digestMigration, /ADD COLUMN "token_sha256" text;/);
  assert.match(digestMigration, /CREATE TRIGGER "auth_session_token_sha256_trg" BEFORE INSERT OR UPDATE OF "token"/);
  assert.match(digestMigration, /NEW\.token_sha256 := pg_catalog\.encode\(pg_catalog\.sha256\(pg_catalog\.convert_to\(NEW\.token, 'UTF8'\)\), 'hex'\)/);
  assert.match(digestMigration, /ALTER TABLE "auth"\."session" ALTER COLUMN "token_sha256" SET NOT NULL/);
  assert.doesNotMatch(digestMigration, /GENERATED ALWAYS AS/);
  assert.match(digestMigration, /SET search_path = pg_catalog/);
  assert.match(digestMigration, /REVOKE ALL ON FUNCTION "auth"\."maintain_session_token_sha256"\(\) FROM PUBLIC/);
  assert.match(migration, /s\.token_sha256 = pg_catalog\.lower\(p_token_sha256_hex\)/);
  assert.match(migration, /s\.expires_at > pg_catalog\.statement_timestamp\(\)/);
  assert.match(migration, /profile\.enabled IS TRUE/);
  assert.match(migration, /profile\.banned_at IS NULL/);
});

test("RLS is forced on every content reader table and public policies expose only public rows", () => {
  assert.match(migration, /Unexpected pre-existing content policy/);
  for (const table of ["posts", "media", "home_projects", "home_project_media"]) {
    assert.match(migration, new RegExp(`ALTER TABLE app\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(migration, new RegExp(`ALTER TABLE app\\.${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /posts_public_rows ON app\.posts TO PUBLIC USING \([\s\S]*publication_state='published' AND visibility='public'[\s\S]*deleted_at IS NULL AND deletion_date IS NULL/);
  assert.match(migration, /posts_content_reader_policy ON app\.posts TO drckgomz_content_reader USING \([\s\S]*can_read_blog_row/);
  assert.match(migration, /media_content_reader_policy ON app\.media TO drckgomz_content_reader USING \([\s\S]*EXISTS \(SELECT 1 FROM app\.posts/);
  assert.match(migration, /home_projects_public_rows ON app\.home_projects TO PUBLIC/);
  assert.match(migration, /home_project_media_public_rows ON app\.home_project_media TO PUBLIC/);
});

test("session and audience decisions are database-derived; owner writes and audit are one function transaction", () => {
  assert.match(migration, /current_active_user\(p_token_sha256_hex pg_catalog\.text\)/);
  assert.match(migration, /assert_active_owner\(p_token_sha256_hex pg_catalog\.text\)/);
  assert.match(migration, /active_user\.email_verified IS TRUE/);
  assert.match(migration, /role_row\.role = 'owner'/);
  assert.match(migration, /pg_advisory_xact_lock\(1651279904, 1\)/);
  assert.match(migration, /INSERT INTO app\.user_capabilities[\s\S]*?INSERT INTO app\.security_audit_events/);
  assert.match(migration, /DELETE FROM app\.user_capabilities[\s\S]*?INSERT INTO app\.security_audit_events/);
  assert.match(migration, /v_actor_user_id = p_target_user_id/);
  assert.match(migration, /v_target_enabled IS DISTINCT FROM true[\s\S]*v_target_verified IS DISTINCT FROM true/);
  assert.doesNotMatch(migration, /p_actor_user_id|p_is_owner|p_owner_flag/);
});

test("definer functions use fixed catalog-only paths and owner login receives no table grants", () => {
  const definerCount = (migration.match(/SECURITY DEFINER/g) ?? []).length;
  const fixedPathCount = (migration.match(/SET search_path = pg_catalog/g) ?? []).length;
  assert.ok(definerCount >= 5);
  assert.equal(fixedPathCount, definerCount);
  assert.doesNotMatch(migration, /\bEXECUTE\s+format\s*\(/i);
  assert.match(migration, /REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC/);
  assert.match(migration, /pg_catalog\.pg_has_role\(current_user, 'drckgomz_owner_admin', 'SET'\)/);
  assert.match(migration, /parent\.rolname='drckgomz_owner_admin' AND member\.rolname <> current_user/);
  assert.match(migration, /GRANT CREATE ON SCHEMA app_private TO drckgomz_owner_admin/);
  assert.match(migration, /ALTER FUNCTION app_private\.set_private_journal_access[\s\S]*?REVOKE CREATE ON SCHEMA app_private FROM drckgomz_owner_admin/);
  assert.match(migration, /TO drckgomz_content_reader/);
  assert.match(migration, /TO drckgomz_owner_runtime/);
  assert.doesNotMatch(roles, /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)[^;]*TO drckgomz_owner_runtime/i);
  assert.match(roles, /drckgomz_owner_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT/);
  assert.match(roles, /drckgomz_owner_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION app_private\.list_private_audience_users[\s\S]*app_private\.set_private_journal_access[\s\S]*TO drckgomz_owner_runtime/);
  assert.doesNotMatch(contentGrant, /GRANT EXECUTE[^;]*set_private_journal_access/i);
});

test("owner application store invokes only bounded database functions, not direct table writes", () => {
  assert.match(ownerStore, /app_private\.list_private_audience_users/);
  assert.match(ownerStore, /app_private\.set_private_journal_access/);
  assert.doesNotMatch(ownerStore, /\.insert\(|\.update\(|\.delete\(|userCapabilities|securityAuditEvents/);
});
