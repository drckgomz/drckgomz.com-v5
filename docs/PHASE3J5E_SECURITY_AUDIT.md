# Phase 3J.5E — Independent Offline Security Audit

**Status: NO-GO for applying the Phase 3J.5D schema/RLS artifacts or enabling the Better Auth + Drizzle content path.** The isolated role and policy design is a useful offline foundation, but migration automation, backend selection, and CMS write coverage are not ready for development integration. No provider, database, or environment file was accessed; no SQL was executed.

## Scope and repository state

- Branch: `feat/cinematic-redesign`.
- The working tree was already broadly modified and contained untracked Phase 3/CMS/auth/database/test/documentation work, including cinematic redesign files. No existing changes were reset or discarded. This audit did not edit landing-page components.
- Reviewed the Phase 3J.5C ADR, Phase 3J.5D implementation record, Drizzle journal and migration 0003, manual policy/function SQL, role/grant/verifier SQL, database clients and repositories, auth/session helpers, route selectors, bootstrap code, and migration/import scripts.
- Read no `.env` files or credentials and made no network or database connections.

## Findings

### P1 — Backend selectors can silently keep using Supabase service-role access

`BLOG_READ_BACKEND` and `PROJECT_READ_BACKEND` select Drizzle only when their value is exactly `drizzle`; missing or misspelled values use the existing Supabase path. `AUTH_PROVIDER` is independent. Blog reads and protected-media lookup can therefore continue through `supabaseAdmin()` while Better Auth is active, with authorization enforced only by application code and the Supabase service role bypassing PostgreSQL RLS. Many admin post/media/project/user mutations and homepage/project API routes also still use Supabase clients. There is no Neon content-writer role or equivalent reviewed CMS mutation API in the isolation design.

**Affected:** `src/lib/blog/read.ts`, `src/app/api/private/journal-media/[mediaId]/route.ts`, `src/lib/projects/public.ts`, `src/app/api/home/projects/**`, `src/app/api/admin/**`, `src/lib/supabase/admin.server.ts`, Phase 3E/3J readiness docs.

**Required before integrated development testing:** define an explicit backend mode that rejects unknown values and incompatible `AUTH_PROVIDER`/reader combinations; inventory every route and repository that accesses content; decide which legacy Supabase paths are intentionally retained during the test window; and design/test least-privilege Neon write operations for CMS behavior before claiming that CMS operations are covered by the new boundary. Do not enable a combined Better Auth/content cutover until this is done.

### P1 — Existing migration runners reject Drizzle migration 0003

The Phase 3F migration runner, migration verifier, and Phase 3J.5A bootstrap runner pin the three Phase 3H migrations and reject other SQL files/journal entries. Adding `0003_early_blizzard.sql` makes those runners stop before migration. The Phase 3I import/verification tools also compare against the original three-entry ledger and will report a mismatch after 0003 is applied. The Phase 3J.5D document proposes applying 0003 but does not provide a reviewed runner/manifest for the four-entry state.

**Affected:** `scripts/phase3f/apply-development-migrations.mjs`, `scripts/phase3f/verify-development-migrations.mjs`, `scripts/phase3j5a/bootstrap-first-owner-development.mjs`, `scripts/phase3i/import-legacy-development.mjs`, `scripts/phase3i/verify-legacy-import.mjs`, `drizzle/0003_early_blizzard.sql`.

**Required before applying 0003:** prepare a new development-only migration manifest/runner with the reviewed fourth checksum, exact schema-state guards, lock handling, and no production fallback. Update read-only verification tools to recognize the post-0003 ledger while preserving the original Phase 3H verification mode. Review those changes separately before any database operation.

### P1 — RLS policy grant preflight checks names, not policy semantics

The content-reader grant script verifies RLS enabled/forced, helper signatures, and policy names, but does not compare each policy's command, role list, permissive/restrictive mode, or predicate. A same-named permissive policy with a broader predicate could pass this preflight and then receive table `SELECT`. The manual migration now refuses pre-existing policies on the four protected tables, which helps with a clean target, but does not replace post-migration catalog verification before granting `SELECT`.

**Affected:** `scripts/phase3j5c/grant-content-reader-review-only.sql`, `scripts/phase3j5c/verify-isolated-roles-review-only.sql`, `drizzle/manual/phase3j5d_privilege_isolation.sql`.

**Required before granting content `SELECT`:** compare exact policy definitions and applicable roles against the reviewed SQL, and verify each helper's owner, `SECURITY DEFINER` flag, fixed `search_path`, and effective execute grants from `pg_catalog`. Stop on any drift. Do not rely on policy names alone.

### P1 — CMS and homepage compatibility is incomplete

The Drizzle content repositories cover blog reads and one project detail path. Homepage project list/detail APIs, homepage sections/media, terminal storage, user administration, and existing CMS write flows remain on Supabase. The new roles intentionally cannot create, edit, publish, reorder, replace media, or delete Neon content. This is a migration coverage gap rather than a defect in the audience functions, but it prevents a complete Neon/Drizzle compatibility test.

**Affected:** `src/lib/db/repositories/blog.ts`, `src/lib/db/repositories/projects.ts`, `src/app/api/home/projects/**`, `src/app/api/admin/**`, `src/lib/db/schema.ts`.

**Required:** map each legacy feature to a Drizzle repository or narrowly scoped database function, preserve its existing URL/DTO behavior, and test writes and transaction boundaries using synthetic development rows before declaring CMS compatibility.

### P2 — Session digest is replayable and its exposure controls are only partly tested

The server obtains the token from Better Auth's verified `getSession`, hashes it, and PostgreSQL checks that digest against a unique generated digest column and a current unexpired session row. Expiration, session deletion/logout, disabled/banned state, and current capability/role state are checked on protected reads; the owner function rechecks owner state and serializes mutation. This is stronger than trusting a user ID or arbitrary GUC, but the digest remains bearer material. Drizzle logging is disabled and `/api/auth/get-session` removes the token, but database/provider parameter logging and all Better Auth response paths have not been verified. Existing tests exercise the pure redaction helper and static SQL contracts, not the actual Next response or PostgreSQL behavior.

**Affected:** `src/lib/auth/session-token-digest.ts`, `src/lib/db/content-session.ts`, `src/app/api/auth/[...all]/route.ts`, `drizzle/manual/phase3j5d_privilege_isolation.sql`.

**Required before a live synthetic-session test:** demonstrate no token or digest in application, driver, server, or provider logs; exercise the actual `/get-session` response; and test expiry, logout, session deletion, revocation, and concurrent role/capability changes against PostgreSQL 18. Treat digest exposure as session compromise.

### P2 — Cross-database `PUBLIC CONNECT` and owner-function blast radius need explicit acceptance

The role scripts grant `CONNECT` only to `neondb` and correctly avoid changing shared `PUBLIC` ACLs. PostgreSQL role memberships and `PUBLIC CONNECT` can still make other databases in the same cluster reachable. The owner function role also has table-level `DELETE` on `app.user_capabilities` because PostgreSQL cannot scope DELETE by row; safety therefore depends on its `NOLOGIN` state, no application memberships, and the small hardened function surface.

**Affected:** `scripts/phase3j5c/create-development-isolated-roles-review-only.sql`, `drizzle/manual/phase3j5d_privilege_isolation.sql`, `scripts/phase3j5c/verify-isolated-roles-review-only.sql`.

**Required:** review the verifier's per-database `CONNECT` results and direct/effective table and column ACLs. Any unexpected owner-runtime table privilege, owner-admin content-table privilege, owner-runtime function execution, role membership, or database reachability outside the accepted development boundary is a stop condition.

## Corrections made during this audit

- Added a lock-only `UPDATE (updated_at)` grant for the one-shot bootstrap role because `bootstrapFirstOwner()` performs `SELECT ... FOR UPDATE` on `app.user_profiles`. The role receives no profile-field update privilege.
- Removed the unused `evidence_ref` insert privilege from `drckgomz_owner_admin`; the grant/revoke function writes only actor, subject, and action.
- Added a fail-closed check that protected content tables have no pre-existing policies before adding the Phase 3J.5D policies.
- Tightened the owner-runtime function verifier to whitelist exact function signatures by OID resolution instead of allowlisting function names, so unexpected overloads remain visible.
- Clarified that the dedicated migration operator—not application logins—needs temporary `SET ROLE` ability for ownership transfer, and that any temporary membership must be removed and verified before runtime use.

## Security review summary

- All five proposed `SECURITY DEFINER` functions use `SET search_path = pg_catalog`, schema-qualify non-catalog objects, and contain no dynamic SQL. The migration revokes `PUBLIC` function execution and grants the content helper or two owner functions narrowly. `owner_runtime` has no direct table grant in the provisioning SQL.
- The owner mutation function derives the actor from a live session digest and current owner row, checks verified email and active profile, rejects self-change/blocked grants, locks actor and target state, serializes grant/revoke operations, and writes audit in the same function statement. Audit failure aborts the capability mutation.
- Session lookup is unique by the generated digest index and checks current expiry. Logout/session deletion removes the matching row. An in-flight statement may finish under its statement snapshot; subsequent requests observe revocation.
- The RLS rules cover `app.posts`, `app.media`, `app.home_projects`, and `app.home_project_media`; they do not protect the still-Supabase-backed content paths or private object URLs already exposed publicly.
- Better Auth 1.7.16 and `@better-auth/drizzle-adapter` 1.7.16 match; Drizzle ORM is 0.45.4 and Neon serverless is 1.2.0. Offline schema mapping checks pass, but no adapter CRUD or RLS integration was exercised against PostgreSQL.

## Validation

- `pnpm test:phase3e`: **55 TypeScript tests and 17 Python tests passed**.
- `pnpm test:security`: **224 passed**.
- `pnpm test:integration`: **60 passed**.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm exec drizzle-kit check`: passed (“Everything's fine”); this checks local Drizzle migration consistency only.
- Focused ESLint: source and test files pass; an initial command also included a `.sql` file, which ESLint ignored with a warning. No SQL lint/parser was run.
- `git diff --check`: passed.
- No PostgreSQL parser/server, Neon connection, AWS/provider call, environment file read, SQL execution, or migration was used.

## Development integration gate

**Current recommendation: NO-GO.** Keep `AUTH_PROVIDER` and backend selectors unchanged. Before separately approving a development-database operation:

1. Prepare a reviewed migration runner/verifier for Drizzle 0003 and update post-0003 ledger validation.
2. Close the legacy Supabase selector downgrade paths for the intended Better Auth test configuration and define the remaining Supabase-only features explicitly.
3. Design the least-privilege Neon CMS write path and verify all homepage, project, media, list, detail, and admin flows.
4. Harden content-reader grant preflight to verify policy semantics and function properties, not just names.
5. Inspect effective ACLs and `CONNECT` reachability read-only on the approved development branch.
6. Test actual Better Auth session redaction, digest non-logging, expiry/logout/revocation, and RLS behavior with synthetic accounts/content on PostgreSQL 18.

PostgreSQL 18 documents that function ownership transfer requires the new owner to have `CREATE` on the function schema and the migration principal to be able to `SET ROLE` to it. The artifact now checks for this and revokes the temporary schema privilege, but that behavior remains unexecuted locally. [PostgreSQL 18 `ALTER FUNCTION`](https://www.postgresql.org/docs/18/sql-alterfunction.html)
