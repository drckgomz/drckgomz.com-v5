# Phase 3J.5C — Database Privilege Isolation ADR

**Status:** Accepted. Offline implementation is recorded in [Phase 3J.5D](PHASE3J5D_PRIVILEGE_ISOLATION_IMPLEMENTATION.md). No database connection, SQL execution, live migration, or service activation occurred. Supersedes the shared-role proposal in Phase 3J.5B.

## Context

The previous `drckgomz_runtime` design combined Better Auth identity operations, public and private content reads, audience reads, and owner capability writes. A compromised credential could directly read private journal rows and grant `private_blog.read`, bypassing application authorization. The existing Drizzle models remain the source of truth; this decision adds a privilege boundary without duplicating their tables. Current Clerk/Supabase behavior remains active until a separately approved integration proves the replacement.

## Options

| Design | Compromise impact | Complexity | Decision |
| --- | --- | --- | --- |
| One shared least-privilege role | Still has all privileges needed by every path; private content and capability writes remain exposed | Lowest | Reject: least privilege is not meaningful when one credential spans all trust zones |
| Identity, reader, and owner roles without RLS | Separates identity and writes, but a stolen reader credential can query every private row | Medium | Reject as incomplete |
| One role with RLS | Strong row filtering only if the database authenticates the caller identity; a caller-controlled custom GUC is spoofable by the same stolen credential | Medium | Reject alone |
| **Hybrid roles plus selective forced RLS** | Separates credentials and makes private row access conditional on a valid database session plus current audience/owner state; owner writes are behind a narrow function | Moderate | **Choose** |

## Decision

Use separate credentials and pools for identity/session operations and content reads. Keep owner audience mutation inside a narrowly granted `SECURITY DEFINER` database function. Apply forced RLS to reader-visible content tables. Do not trust a custom GUC as identity by itself: the policy helper must resolve the transaction-local opaque Better Auth session token against `auth.session`, then check expiry, enabled/banned profile state, current owner/admin or `private_blog.read` capability, and the post's current publication/visibility/deletion fields. The client role cannot read auth or authorization tables directly.

The app hashes the verified Better Auth session token and sets that SHA-256 digest transaction-locally with a bound parameter. A generated `auth.session.token_sha256` column lets PostgreSQL validate the digest against the current session without exposing the raw token to content/owner functions. The digest is still a replayable bearer proof; it must not be logged. This makes a stolen **content-reader** credential alone insufficient to mint a viewer identity. It does not prevent a compromised application process from using a legitimate user's active session.

### Role responsibilities

- `drckgomz_auth_runtime` (LOGIN): Better Auth user/account/session lifecycle and the minimum profile bootstrap/read operations. Read-only `user_roles` and `user_capabilities`; no content table access and no capability writes.
- `drckgomz_content_reader` (LOGIN): content SELECT only after forced RLS and tested policies exist. No auth, role, capability, or audit table access; no function that mutates audience state.
- `drckgomz_owner_runtime` (LOGIN): dedicated function caller with no direct table grants. It receives EXECUTE only on the bounded audience-list and grant/revoke functions, subject to an effective-function-permission check that includes inherited `PUBLIC` ACLs.
- `drckgomz_owner_admin` (NOLOGIN): function owner for narrowly scoped authorization checks and audience grant/revoke. No role memberships, content table access, superuser, ownership of content tables, or `BYPASSRLS`. Harden functions with fixed `search_path`, fully qualified object references, no dynamic SQL, and explicit EXECUTE grants. PostgreSQL executes SECURITY DEFINER as function owner; the function must validate the actor's live owner session and target state itself.
- `drckgomz_bootstrap` (LOGIN, one-shot): separate existing first-owner workflow. Keep it out of normal app pools; rotate/disable after the approved bootstrap procedure. Its use requires a separate review against the new role split.
- Migration/operator role: used only for separately approved migrations; never configured in the web runtime.

The owner grant/revoke function must use one transaction, serialize competing owner checks and capability changes with a database advisory transaction lock (or a carefully reviewed lock table), update capability and append audit event atomically, reject blocked/inactive actors and targets, and enforce the single-owner index. Phase 3J.5D replaces the TypeScript direct-write audience store with calls to the two database entry-point functions. The SQL proposal temporarily gives the no-login function owner `CREATE` on `app_private` only while transferring function ownership, then revokes it before transaction commit; the final role has `USAGE` but no `CREATE`. A dedicated non-application migration principal must be able to `SET ROLE` to the function owner, or be an authorized superuser; any temporary membership must be removed and verified before runtime use.

### Revised privilege matrix

| Resource | Auth runtime | Content reader | Owner runtime | Owner function owner | Bootstrap |
| --- | --- | --- | --- | --- | --- |
| Better Auth user/account/session | Adapter lifecycle access | None | None | Session digest/status reads; lock-only column privileges | Minimal verified-user read |
| User profile | Selected reads; baseline profile insert | None | None | Active/banned read; lock-only timestamp update | Minimal active-profile read; lock-only timestamp update for `SELECT FOR UPDATE` in one-shot bootstrap |
| Roles/capabilities | SELECT only | None | None | SELECT; capability INSERT/DELETE in function | Owner-state read and one-time owner insertion only |
| Audit events | None | None | None | INSERT in same mutation transaction | Bootstrap INSERT and narrow verification read |
| Posts/media/projects | None | SELECT under forced RLS | None | None | None |
| Owner functions | None | Content policy helper only | Two owner-management functions only | Own hardened helper functions | None |
| Legacy, ops, migration writes | None | None | None | None | Read-only migration hash check only |
| Memberships / ownership / superuser / RLS bypass | None | None | None | None | None |

All grants are additive. Effective permissions, memberships, column grants, `PUBLIC`, and cross-database CONNECT must be verified before runtime use. PostgreSQL roles are cluster-wide within a database cluster, and default `PUBLIC CONNECT` may make other databases reachable; do not change shared PUBLIC ACLs as part of this design. [PostgreSQL 18 role documentation](https://www.postgresql.org/docs/18/database-roles.html). Neon role creation is scoped to a project branch, but SQL does not attest branch identity; Console identity verification remains mandatory. [Neon branch role API](https://neon.com/docs/reference/api/branches/create-project-branch-role).

## RLS boundary and public functionality

Public portfolio and published public posts remain visible through explicit RLS predicates for `publication_state='published'`, `visibility='public'`, and non-deleted state. Private journal rows require a valid current session and owner/admin or audience capability. Private media policies must link to an authorized post; never expose a private object's permanent public URL. Public project/media rows retain their current public selection rules. Private response cache headers remain `private, no-store`.

Enable and **force** RLS on all reader-visible content tables. Content table owners, superusers, and `BYPASSRLS` roles can bypass policies; the reader login must own none of the tables and have no such attribute. Policy helper functions must not query the same protected table recursively. The offline implementation defines policies and helper functions in `drizzle/manual/phase3j5d_privilege_isolation.sql`; it is not applied or PostgreSQL-validated.

## Threat coverage

**Mitigates:** theft of only the auth-runtime credential does not directly read content or mutate audience capabilities; theft of only the content-reader credential cannot directly inspect auth tables, grant capabilities, or enumerate private content without a valid session; normal API authorization bugs cannot bypass the owner mutation function's database actor check; public/private row rules are enforced at the database boundary; concurrent grant/revoke operations and audit writes can be serialized atomically.

**Does not mitigate:** compromise of the full Next.js process that can use both credentials and a user's session; theft of a valid owner cookie/session; compromise of the owner-function owner, migration role, Neon project owner, superuser, or host; exfiltration through an already authorized response; public media URLs that already escaped into caches; timing/availability attacks; incorrect RLS policies or helper implementation; and compromise of Google/Apple accounts. Session-token context must not be logged.

## Remaining prerequisites before live provisioning

1. Validate generated migration 0003 plus the manual policy/function artifact against PostgreSQL 18 in the attested development branch. No parser/server run was performed offline.
2. Provision roles only after separate approval; verify the owner-operation role's effective EXECUTE set, including PUBLIC ACLs, and stop on unexpected functions.
3. Confirm Better Auth token hashing/redaction behavior with an offline HTTP fixture, then test current token expiry, revocation, account block, and all RLS paths in development.
4. Route any owner-role mutation/bootstrap path that could race with audience changes through compatible row/advisory locking, or suspend it during the integration window.
5. Verify database and provider logs do not expose the replayable session digest. Treat any log visibility as a blocker.

## Review-only artifacts and approval gates

The previous Phase 3J.5B SQL paths now contain only a superseded notice. The role sketches and guarded grants are under `scripts/phase3j5c/`; the generated session-hash migration is in the Drizzle journal and RLS/function SQL is in `drizzle/manual/`. These artifacts are not production-ready provisioning scripts. Their SQL was checked statically only; it was not parsed or run by PostgreSQL. See the implementation record for ordering and rollback.

Separate explicit approvals are required for: (1) applying the RLS/function schema migration to the attested Neon development branch; (2) creating and credentialing isolated development roles; (3) changing the local development process to Better Auth and configuring OAuth; (4) one synthetic Google registration/session test; (5) first-owner bootstrap; (6) owner grant/revoke and private-media tests; (7) AWS private-bucket configuration or uploads. Production, AWS, and provider consoles were not accessed in this phase.

## Offline validation

- `pnpm test:phase3e`: passed, 55 TypeScript tests and 17 Python tests.
- `pnpm test:security`: passed, 224 tests.
- `pnpm test:integration`: passed, 60 tests.
- `pnpm exec tsc --noEmit`: passed.
- Focused ESLint across changed auth, database, route, and Phase 3E test files: passed with zero diagnostics.
- `git diff --check`: passed.

These checks establish repository contracts only. They do not parse the proposed SQL on PostgreSQL, validate RLS execution plans, or establish Neon permissions. No live connection or database action occurred.
