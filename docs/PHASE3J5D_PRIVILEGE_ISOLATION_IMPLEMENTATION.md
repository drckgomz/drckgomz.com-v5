# Phase 3J.5D — Offline Privilege Isolation Implementation

**Status:** Implemented locally for review. No database or provider connection, SQL execution, credential change, deployment, or Better Auth activation occurred. The cinematic landing-page work was not touched.

## Decision implemented

Three LOGIN identities have separate, exact development URLs: `drckgomz_auth_runtime`, `drckgomz_content_reader`, and `drckgomz_owner_runtime`. The no-login `drckgomz_owner_admin` owns only the hardened `SECURITY DEFINER` helpers and receives narrowly scoped table privileges for those functions. `drckgomz_owner_runtime` has no direct table grants; its intended application entry points are the bounded audience-list and audience-mutation functions. It has no role memberships. The existing one-shot bootstrap role remains separate.

Application database pools are keyed by role and validated against the same pinned project, branch, endpoint, host, and database before a cached pool can be used. The role-specific environment names are `NEON_AUTH_DATABASE_URL`, `NEON_CONTENT_DATABASE_URL`, and `NEON_OWNER_DATABASE_URL`; there is no fallback to `DATABASE_URL`. Better Auth now uses the auth pool. Blog, project, and protected-media Drizzle readers use the content pool and a single transaction per read. The owner store calls only database functions through the owner-operation pool; it no longer reads or mutates capability/audit tables directly.

## Session proof analysis

The installed Better Auth 1.7.16 implementation creates a session token, stores it in `auth.session.token`, signs it into the session cookie, verifies the cookie before `getSession` returns the server-side session, and includes a `token` field in the session output schema. The repository disables Better Auth cookie-cache mode. The catch-all route now strips `session.token` from browser-facing `/api/auth/get-session` JSON. Internal server code reads the verified session object and immediately computes SHA-256; it never returns or logs the raw token.

The Drizzle schema and pending generated migration `drizzle/0003_early_blizzard.sql` add a stored generated `auth.session.token_sha256` column and unique index, using PostgreSQL 18's built-in SHA-256. The RLS and owner functions compare the supplied 64-character digest against this generated value, check session expiry on each statement, and join the current profile/role/capability state. No Better Auth adapter lookup is changed: the adapter continues using the original token column. The generated digest column is an additional database projection, not an imported credential.

The digest is still a replayable bearer proof. It is less revealing than sending the raw token to a second database pool, but anyone who obtains the digest can use it until the underlying session expires or is revoked. Treat it as secret: do not log parameters, `set_config` values, or function arguments. The application Drizzle logger remains disabled. PostgreSQL/Neon parameter logging and operational telemetry have not been inspected and must be checked before live use. Session deletion/expiry and current banned/disabled/capability state deny subsequent requests.

## Reviewable SQL and migration order

- `drizzle/0003_early_blizzard.sql` is a Drizzle-generated, unapplied schema migration for the generated session digest. It is in the Drizzle journal/snapshot. It was generated offline from the local schema.
- `drizzle/manual/phase3j5d_privilege_isolation.sql` is an unapplied, explicit transaction for the `app_private` functions, forced RLS, policies, and function ACLs. It is deliberately outside the Drizzle journal because Drizzle does not model these policies/functions. It fails closed if migration 0003, required tables, roles, or database/version checks are missing.
- `scripts/phase3j5c/create-development-isolated-roles-review-only.sql` now includes the owner-operation login and no-login function owner. It does not grant direct table rights to owner runtime. The function-owner digest-column grant is deferred until the column exists.
- `scripts/phase3j5c/grant-content-reader-review-only.sql` is separate and refuses to grant content SELECT until forced RLS, all expected policies, and helper routines exist.
- `scripts/phase3j5c/verify-isolated-roles-review-only.sql` reports memberships, effective table access, RLS flags, function execution rights, and inherited `PUBLIC` function execution outside approved owner functions.

Proposed order for a future, separately approved development integration:

1. Re-attest project, development branch, endpoint, host, database, and PostgreSQL version in Neon Console. Confirm target is the isolated development branch and expected staging data is intact.
2. Separately approve and apply the generated Drizzle migration 0003. Stop on any migration hash or schema-state mismatch.
3. Separately approve provisioning the isolated roles and interactive credential setup. Do not give any app role role memberships.
4. Separately approve the manual RLS/function transaction. PostgreSQL requires the new function owner to hold `CREATE` on the function schema at ownership transfer. The reviewed transaction grants this to the `NOLOGIN` `drckgomz_owner_admin` only temporarily, then revokes it before commit. The migration principal must be a dedicated, non-application operator that can `SET ROLE` to `drckgomz_owner_admin` (or be an authorized superuser); the script refuses application-role memberships. Remove any temporary operator membership after migration and verify that no membership to or from the application roles or function owner remains.
5. Separately approve the guarded content-reader SELECT grant, after checking the actual RLS policies and effective ACLs.
6. Configure the three role URLs in an ignored development-only file and run only after validating that each has the exact expected role and same endpoint. Keep existing Clerk/Supabase defaults unchanged.
7. Approve synthetic public/private reads and owner grant/revoke tests individually. Confirm expiry, logout, revocation, disabled/banned status, transaction rollback, and no token/hash values in logs.

No step above is authorized by this phase.

## Authorization behavior

- Public post rows are visible only when published, public, and not deleted. Private published rows require a current session plus an active profile and either owner/content-admin role or `private_blog.read`. Owner/content admins retain access to non-deleted draft/archived rows through the database policy; ordinary audience members do not.
- Media RLS evaluates the owning post's policy. Project and project-media RLS exposes only published, public, non-deleted projects. Private media still uses the application proxy and no-store response headers.
- The digest custom setting is only lookup context. Policies do not accept user IDs or caller-supplied owner flags. Any arbitrary value fails unless it matches an unexpired token digest in `auth.session` and current authorization tables.
- Owner mutation rechecks a verified, unexpired owner session in PostgreSQL, serializes changes with a transaction advisory lock, locks the actor and target state rows, rejects self-change and blocked grants, changes `app.user_capabilities`, and writes the corresponding audit event in the same function statement/transaction. A failed audit insert aborts the capability change. Revocation is idempotent and remains allowed for blocked targets.
- `owner_runtime` has no direct `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, or audit/capability/content table privileges. The `NOLOGIN` function owner has only session/profile/role/capability reads, narrow lock-only timestamp UPDATE column grants, capability INSERT/DELETE, and audit INSERT. Those UPDATE column grants exist solely because PostgreSQL requires UPDATE privilege for row-locking SELECT; the owner role has no login and no membership.

## Rollback

Rollback is a new, separately reviewed development operation. First stop the development app. Revoke only the two owner function EXECUTE grants and the content policy-helper EXECUTE grant. Drop the four policies by exact name, then disable and remove FORCE RLS on only the four listed tables. Drop the five functions and `app_private` only after confirming there are no dependent objects. Keep the generated digest column/index; it is non-sensitive derived state and is safe to leave. Do not drop roles or alter PUBLIC ACLs in an automatic rollback. Reverting RLS restores the earlier application-only private-content boundary, so the app must remain stopped until its reader grants are removed or a reviewed replacement is active.

The generated migration 0003 is additive and can be rolled back only after removing its index and generated column in a separate reviewed migration. No automatic rollback or cleanup is prepared.

## Remaining risks and blockers

1. **SQL runtime behavior is unverified.** No PostgreSQL parser/server was used. Verify function signatures, RLS recursion/plans, row-lock permissions, generated-column behavior, and transaction rollback against an isolated development branch before enabling any role.
2. **Owner-role changes outside this function.** Row locks protect owner/profile/target rows during audience mutation, but every future role-demotion/bootstrap path must use compatible locking or be disabled during integration. Existing Clerk/Supabase paths were preserved and not migrated in this phase.
3. **Effective ACL verification.** PostgreSQL's `PUBLIC` and column-level grants are additive. The read-only verifier checks table and column privileges for the owner login and no-login function owner, plus every effective user-defined function execution outside the two approved functions. Any unexpected result is a blocker requiring a separately reviewed scoped ACL fix; do not treat `NOINHERIT` as removing PUBLIC privileges.
4. **Digest logging.** The SHA-256 digest is still bearer material. PostgreSQL/Neon statement/parameter logs and provider diagnostics remain unverified.
5. **External ACL and storage behavior.** No Neon, AWS, OAuth, or live media checks occurred. Existing public object URLs cannot be revoked by this work.
6. **Legacy reader compatibility.** Content read-backend flags must be switched as a group with `AUTH_PROVIDER=better-auth`; with Clerk authentication there is no Better Auth session digest and RLS intentionally denies private database rows. Default Clerk/Supabase operation was not activated or changed.
7. **Better Auth token response compatibility.** The browser-facing route redacts `session.token`; verify actual Next.js response headers and payload in an offline HTTP fixture before live auth. The server-only `api.getSession` result remains internal.

## Offline validation record

- `pnpm test:phase3e`: passed, 55 TypeScript tests and 17 Python tests.
- `pnpm test:security`: passed, 224 tests.
- `pnpm test:integration`: passed, 60 tests.
- `pnpm exec tsc --noEmit`: passed.
- Focused ESLint across changed auth, database, route, and Phase 3E test files: passed with zero diagnostics.
- `git diff --check`: passed.

These are repository-level regression contracts only. They do not parse the SQL against PostgreSQL, prove RLS execution semantics, or establish live Neon ACL state. The manual SQL is review-only and was not executed.
