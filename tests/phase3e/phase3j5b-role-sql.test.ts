import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const oldCreate = readFileSync("scripts/phase3j5b/create-development-runtime-roles-review-only.sql", "utf8");
const oldVerify = readFileSync("scripts/phase3j5b/verify-development-runtime-roles-review-only.sql", "utf8");
const roleSql = readFileSync("scripts/phase3j5c/create-development-isolated-roles-review-only.sql", "utf8");
const contentSql = readFileSync("scripts/phase3j5c/grant-content-reader-review-only.sql", "utf8");
const verifySql = readFileSync("scripts/phase3j5c/verify-isolated-roles-review-only.sql", "utf8");

test("unsafe shared-role SQL artifacts are neutralized", () => {
  for (const sql of [oldCreate, oldVerify]) {
    assert.match(sql, /SUPERSEDED/i);
    assert.match(sql, /SELECT\s+'superseded: do not execute'/i);
    assert.doesNotMatch(sql, /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE)\s+(?:ROLE|TABLE|SCHEMA|ON|INTO|FROM)/i);
  }
});

test("isolated role proposal separates identity, content, and owner-function trust", () => {
  for (const role of ["drckgomz_auth_runtime", "drckgomz_content_reader", "drckgomz_owner_runtime", "drckgomz_owner_admin", "drckgomz_bootstrap"]) {
    assert.ok(roleSql.includes(role));
  }
  assert.match(roleSql, /drckgomz_owner_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT/);
  assert.match(roleSql, /drckgomz_owner_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT/);
  assert.match(roleSql, /drckgomz_auth_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT/);
  assert.match(roleSql, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth\.session TO drckgomz_auth_runtime/);
  assert.doesNotMatch(roleSql, /GRANT\s+SELECT\s+ON TABLE app\.(?:posts|media|home_projects)/i);
  assert.doesNotMatch(roleSql, /GRANT\s+(?:INSERT|UPDATE|DELETE)[^;]*app\.user_capabilities[^;]*TO drckgomz_auth_runtime/i);
  assert.doesNotMatch(roleSql, /GRANT\s+[^;]+\s+TO\s+PUBLIC/i);
  assert.doesNotMatch(roleSql, /GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)[^;]*TO drckgomz_owner_runtime/i);
  assert.doesNotMatch(roleSql, /GRANT INSERT \([^)]*evidence_ref[^)]*\)[^;]*TO drckgomz_owner_admin/i);
  assert.match(roleSql, /GRANT UPDATE \(updated_at\) ON TABLE app\.user_profiles TO drckgomz_bootstrap/);
  assert.doesNotMatch(roleSql, /ALTER DEFAULT PRIVILEGES|PASSWORD\s*=/i);
});

test("content SELECT is gated on forced RLS, authorization helpers, and policies", () => {
  assert.match(contentSql, /c\.relrowsecurity AND c\.relforcerowsecurity/);
  assert.match(contentSql, /app_private\.can_read_blog_row/);
  assert.match(contentSql, /app_private\.set_private_journal_access/);
  assert.match(contentSql, /posts_content_reader_policy/);
  assert.match(contentSql, /media_content_reader_policy/);
  assert.match(contentSql, /GRANT SELECT ON TABLE app\.posts, app\.media, app\.home_projects, app\.home_project_media TO drckgomz_content_reader/);
  assert.doesNotMatch(contentSql, /GRANT\s+(?:INSERT|UPDATE|DELETE)[^;]*drckgomz_content_reader/i);
  assert.match(contentSql, /current_database\(\) <> 'neondb'/);
});

test("read-only verifier inspects memberships, effective access, RLS, and public reachability", () => {
  assert.match(verifySql, /BEGIN READ ONLY/);
  assert.match(verifySql, /pg_auth_members/);
  assert.match(verifySql, /has_table_privilege/);
  assert.match(verifySql, /has_any_column_privilege/);
  assert.match(verifySql, /drckgomz_owner_admin','app\.posts/);
  assert.match(verifySql, /drckgomz_owner_runtime','app\.user_roles/);
  assert.match(verifySql, /pg_catalog\.to_regprocedure\('app_private\.list_private_audience_users\(text,integer,integer\)'\)/);
  assert.match(verifySql, /pg_catalog\.to_regprocedure\('app_private\.set_private_journal_access\(text,text,boolean\)'\)/);
  assert.doesNotMatch(verifySql, /p\.proname IN \('list_private_audience_users','set_private_journal_access'\)/);
  assert.match(verifySql, /relforcerowsecurity/);
  assert.match(verifySql, /pg_policies/);
  assert.match(verifySql, /has_database_privilege/);
  assert.match(verifySql, /ROLLBACK/);
  assert.doesNotMatch(verifySql, /\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE)\s+(?:ROLE|TABLE|SCHEMA|ON|INTO|FROM)/i);
});
