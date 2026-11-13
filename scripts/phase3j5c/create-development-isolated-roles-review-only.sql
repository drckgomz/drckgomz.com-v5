-- REVIEW ONLY — proposal; do not execute without separate approval.
-- Requires fresh Neon Console attestation for development branch
-- br-nameless-dust-bewpmr4r / endpoint ep-sparkling-sun-bedq0ozn.
-- PostgreSQL itself cannot validate Neon project/branch identity.
-- This provisions isolated LOGIN identities and a NOLOGIN function owner only.
-- Content access is withheld until the RLS migration is separately applied.
BEGIN;
DO $preflight$
BEGIN
  IF current_database() <> 'neondb' THEN RAISE EXCEPTION 'Wrong database'; END IF;
  IF current_setting('server_version_num')::integer / 10000 <> 18 THEN RAISE EXCEPTION 'Unexpected PostgreSQL major'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN
    ('drckgomz_auth_runtime','drckgomz_content_reader','drckgomz_owner_runtime','drckgomz_owner_admin','drckgomz_bootstrap'))
  THEN RAISE EXCEPTION 'A proposed role already exists; stop'; END IF;
END
$preflight$;

CREATE ROLE drckgomz_auth_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
CREATE ROLE drckgomz_content_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
CREATE ROLE drckgomz_owner_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
CREATE ROLE drckgomz_owner_admin NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
CREATE ROLE drckgomz_bootstrap LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;

GRANT CONNECT ON DATABASE neondb TO drckgomz_auth_runtime, drckgomz_content_reader, drckgomz_owner_runtime, drckgomz_bootstrap;
GRANT USAGE ON SCHEMA auth, app TO drckgomz_auth_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE auth."user", auth.account TO drckgomz_auth_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth.session TO drckgomz_auth_runtime;
GRANT SELECT (id, username, first_name, last_name, avatar_color, enabled, banned_at)
  ON TABLE app.user_profiles TO drckgomz_auth_runtime;
GRANT INSERT (id, username, enabled, first_name) ON TABLE app.user_profiles TO drckgomz_auth_runtime;
GRANT SELECT (user_id, role) ON TABLE app.user_roles TO drckgomz_auth_runtime;
GRANT SELECT (user_id, capability) ON TABLE app.user_capabilities TO drckgomz_auth_runtime;
-- No profile row-lock UPDATE grant: replace FOR UPDATE paths with the
-- transaction-safe SECURITY DEFINER mutation function in a later migration.
-- No access to content tables or capability INSERT/UPDATE/DELETE is granted.

-- Reserved no-login owner for hardened functions. Application login roles may
-- not SET ROLE to this role; a separately approved migration operator needs
-- temporary ownership-transfer ability for the unapplied function migration.
GRANT USAGE ON SCHEMA auth, app TO drckgomz_owner_admin;
-- The digest-column grant is added by the subsequent Phase 3J.5D function/RLS
-- migration after Drizzle migration 0003 creates auth.session.token_sha256.
-- The function owner gets no raw token.
GRANT UPDATE (updated_at) ON TABLE auth.session TO drckgomz_owner_admin;
GRANT SELECT (id, email_verified) ON TABLE auth."user" TO drckgomz_owner_admin;
GRANT UPDATE (updated_at) ON TABLE auth."user" TO drckgomz_owner_admin;
GRANT SELECT (id, enabled, banned_at) ON TABLE app.user_profiles TO drckgomz_owner_admin;
GRANT UPDATE (updated_at) ON TABLE app.user_profiles TO drckgomz_owner_admin;
GRANT SELECT (user_id, role) ON TABLE app.user_roles TO drckgomz_owner_admin;
GRANT UPDATE (granted_at) ON TABLE app.user_roles TO drckgomz_owner_admin;
GRANT SELECT (user_id, capability) ON TABLE app.user_capabilities TO drckgomz_owner_admin;
GRANT INSERT (user_id, capability, granted_by), DELETE ON TABLE app.user_capabilities TO drckgomz_owner_admin;
GRANT INSERT (actor_user_id, subject_user_id, action) ON TABLE app.security_audit_events TO drckgomz_owner_admin;
-- drckgomz_owner_runtime gets no direct table privileges. Only the subsequent
-- RLS/function migration grants EXECUTE on the approved owner functions.

-- One-shot bootstrap remains isolated from normal auth/content runtime roles.
GRANT USAGE ON SCHEMA auth, app, drizzle TO drckgomz_bootstrap;
GRANT SELECT (id, email_verified) ON TABLE auth."user" TO drckgomz_bootstrap;
GRANT SELECT (id, enabled, banned_at) ON TABLE app.user_profiles TO drckgomz_bootstrap;
-- SELECT FOR UPDATE in the one-shot bootstrap needs UPDATE on one column;
-- this lock-only grant matches the implementation and does not permit profile edits.
GRANT UPDATE (updated_at) ON TABLE app.user_profiles TO drckgomz_bootstrap;
GRANT SELECT (user_id, role) ON TABLE app.user_roles TO drckgomz_bootstrap;
GRANT INSERT (user_id, role) ON TABLE app.user_roles TO drckgomz_bootstrap;
GRANT INSERT (actor_user_id, subject_user_id, action, evidence_ref) ON TABLE app.security_audit_events TO drckgomz_bootstrap;
GRANT SELECT (id, hash) ON TABLE drizzle.__drizzle_migrations TO drckgomz_bootstrap;
-- No memberships, default privileges, PUBLIC changes, passwords, content,
-- capabilities, ownership, or migration writes are proposed.
COMMIT;
