# Phase 3: database and identity readiness

Original Phase 3 inspection: local names and URL structure only, on feat/cinematic-redesign. No database client, SQL, provider API, migration, import or production connection was used. No URL/hostname/username/database identifier/credential is reproduced here. Phase 3E later added local Drizzle/Neon code; it still has not connected or applied schema.

## Observed versus unverified

- `.env.local` names observed: DATABASE_URL, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_URL. DATABASE_URL parses as a PostgreSQL URL and has a Neon hostname. Values were withheld.
- **Development versus production is unverified.** A URL's endpoint and database name do not prove its branch purpose, data classification or access level. Database-dependent work stopped; Phase 3 uses synthetic local fixtures.
- At the time of the original Phase 3 inspection, no application source consumed DATABASE_URL and Drizzle/Neon drivers were not installed. Phase 3E now has a lazy Neon pool, Drizzle schema, and opt-in readers; adding a variable still does not replace legacy Supabase repositories.
- Current app uses Supabase service-role repositories in admin/blog/profile paths, anonymous Supabase clients for public homepage/project data, PostgREST filters/embedded relations and Clerk for identity. Required runtime names include SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY and Clerk server configuration; the locally inspected file does not establish a complete runtime environment. Do not copy secrets into public-prefixed variables to work around this.
- [Proposed Drizzle schema](PROPOSED_DRIZZLE_SCHEMA.md), [migration strategy](DATA_MIGRATION_STRATEGY.md) and [original migration plan](DATABASE_MIGRATION_PLAN.md) remain proposals. Legacy backup metadata is not proof of the current live schema.

## Approval gate before database work

An authorized operator must confirm, without sharing credentials in chat/Git, the Neon project/branch mapping, whether the branch is development, whether its contents include real users, and whether the chosen role is least-privilege. Confirm a dedicated disposable development branch and a no-production-network test configuration. Provider verification/configuration is a separate approved action; no inference from an endpoint nickname authorizes it.

Then review intended schema, adapter ownership, migration SQL, backup/recovery and rollback. No real schema migration or Supabase transfer is authorized by this phase. Database URL parsing is not a connectivity or TLS/permission test.

## Replacement sequence

1. Inventory actual current schema/RLS/functions under separately authorized read access; compare to historical forensic documents. Confirm deletion columns, slug collisions, content/media IDs and nullable flags.
2. Choose pinned Drizzle and transaction-capable Postgres/Neon driver after verifying adapter/runtime support. Establish server-only typed repository interfaces and contract tests against fixtures first. Replace PostgREST embedded relationships with explicit joins/projections and bounded queries. Preserve endpoint DTOs, status guards, ID fallbacks and sanitized rendering.
3. Review generated SQL for tables, FK/index/check behavior and adapter schemas. Owner transitions need a serialized database transaction covering every writer; the present HTTP CAS is not that invariant. Do not deploy a guessed RPC or count-then-write fix.
4. Separately authorize applying schema to a confirmed development branch, then load only synthetic data. Test migrations/rollback, transaction isolation, connection pooling, permissions and query plans.
5. Design real transfer as a distinct approved operation with restricted reconciliation files, immutable source IDs, placeholder/media references, state mapping, counts/checksums and explicit quarantine for unknown states. No source data in Git. Keep S3 until private delivery is verified; PostgreSQL metadata does not make objects private.
6. Cut over one repository at a time with parity tests and a reviewed rollback; avoid unsafe dual writes. Authentication replacement can be decoupled from content database replacement.

## Clerk identity mapping

Keep Clerk for this phase. Treat its stable subject ID as a namespaced external identity, not an email address or automatically trusted role. Proposed app users have independent IDs; auth_links uniquely maps (provider namespace, subject) to the existing app user. Preserve current bans/disabled/private grants and ownership in app-owned tables; default uncertain privilege state to denied.

When Better Auth or Auth.js is selected, generate only its exact supported adapter tables in authentication-owned storage. Link a newly verified identity to an existing account only through an approved proof/recovery workflow; never automatically merge by matching email, display name or OAuth email alone. Preserve explicit link provenance and conflict review. Do not import Clerk sessions, provider tokens or password verifiers. Existing Clerk passwords must not be assumed exportable or directly portable. Password reset/re-enrollment, verified OAuth relinking and fresh passkey enrollment require a separate user-facing migration/recovery plan.

Decisions still requiring review: confirmed Neon development branch/role; exact source schema; account recovery/linking proof; publication/audience mapping; transactional CMS repositories; private-media rollout; migration/rollback and a single authoritative package manager. Phase 3E implements a side-by-side Better Auth foundation, not an identity cutover.

## Phase 3E local implementation addendum (2026-11-11)

The app now has a side-by-side Drizzle/Neon schema, a Better Auth adapter and session-to-profile resolver, an operator-only owner bootstrap routine, read-only blog and project Drizzle repositories, and an offline-only generated SQL snapshot. These are local code artifacts only. Clerk/Supabase remain installed and are the default for the existing app. CMS writes, admin user management, terminal commands, and homepage sections remain on legacy repositories. No `DATABASE_URL` value was inspected or used by migration generation; the Drizzle config is pinned to a loopback placeholder. No database connection, schema apply, or import has occurred.

Before configuring `AUTH_PROVIDER=better-auth`, `BLOG_READ_BACKEND=drizzle`, or `PROJECT_READ_BACKEND=drizzle`, verify a dedicated disposable Neon development branch, role scope, data classification, restore point, reviewed DDL, and compatible fixture data. Get separate approval for read-only identity verification, schema application, and import. The local deployment gate and exact checklist are in [Phase 3E implementation](PHASE3E_IMPLEMENTATION.md).

## Phase 3B recheck and exact development checklist

Historical Phase 3B recheck: the configured URL was present, with PostgreSQL scheme and Neon hostname; no development-branch attestation was found. No connection or provider operation was attempted. This environment observation is not a current-branch attestation. Supabase/Clerk remain active dependencies; Phase 3E adds Drizzle as an installed side-by-side runtime. Prior database planning documents contain historical behavior (including PATCH upsert); current post PATCH is update-only and requires a revision.

Before a separately authorized development migration:

- [ ] Operator records verified project/branch/compute/role mapping in an appropriate restricted system, confirms dedicated development purpose and absence of production traffic, and confirms whether real data exists. Do not place connection details in Git.
- [ ] Approve a least-privilege development role, network scope and driver/runtime/pooling choice; inspect exact schema/types/constraints/deletion flags only after read access is separately authorized.
- [ ] Review current source-to-target table/ID/state/visibility/media placeholder mapping, slug Unicode/case collisions, nullable permission flags and timezone provenance. Unknown legacy states stay nonpublic/quarantined.
- [ ] Select exact pinned Drizzle/driver and authentication adapter schemas. Keep app roles/capabilities separate from auth-owned secrets/sessions. Keep Clerk initially; map namespaced immutable subjects, never silently link by email or copy passwords/sessions.
- [ ] Review generated SQL as a document: PK/FK/check/index/RESTRICT behavior, adapter compatibility, integer revisions and transactional owner/post/media invariants. No schema push or migration execution follows automatically.
- [ ] Approve disposable-development-only execution, synthetic fixtures, rollback/recreate procedure, migration ordering and acceptance evidence. No real imports until a separate transfer approval.
- [ ] In that approved environment, check both empty install and upgrade/rollback paths; assert public/private/draft/archive/deleted query parity, stale update conflicts, slug/ID links and permission behavior. Test serialized last-owner operations under competing sessions; count-then-write is insufficient.
- [ ] Verify bounded list/child queries, indexes/query plans, TLS/role limits/pooling and migration-role/runtime-role separation. Compare repository DTO contracts with synthetic source fixtures; do not use live content to make tests pass.
- [ ] Obtain separate approval for real transfer, reconciliation counts/checksums, private media handling, identity enrollment/recovery, production cutover and rollback. Never export credentials or legacy password verifiers to reports.

Remaining decisions: branch attestation, exact source schema, driver/adapter versions, identity proof/recovery, role ownership, timestamp/version semantics, atomic deletion/reorder, private origin access and package-manager consolidation. The new in-process Next/repository tests provide local contract evidence only; they do not prove Neon compatibility or authorize this checklist's execution.

## Phase 3D integration gate (2026-11-11)

No connection or environment-value inspection was performed for this phase. **A separate development branch is still unverified.** Before even recommending live integration commands, obtain explicit operator confirmation that the chosen target is a dedicated, disposable development branch with no production traffic, along with approved data classification, least-privilege role and exact test scope. An existing DATABASE_URL or the historical endpoint syntax is not that confirmation. Approval to inspect repository code is not approval to connect.

New local evidence: real Next request/response handlers with synthetic provider repositories test simultaneous post revisions, moved media, private preview denial, upload/storage-record partial failures, and replacement/reorder interleavings. Existing reorder can produce duplicate indexes under concurrent requests, and failed replacement insert can follow successful deletion. The five `transaction-contract.test.cjs` cases are proposed serializable/rollback contracts implemented only by an in-memory test double; no application route or production repository uses that fake transaction engine.

Add to the separately authorized development acceptance checklist:

- [ ] Inspect and approve exact version columns, foreign keys, uniqueness/check constraints and isolation/locking protocol. Use monotonic parent/media-set revisions rather than timestamp-only coordination.
- [ ] Implement a transaction-capable repository that rechecks fresh actor authority and target association inside the write transaction. Do not wrap separate PostgREST HTTP calls and label them atomic.
- [ ] Serialize every writer of owner/role/enabled/banned state and enforce at least one active owner at commit, including restoration, deletion and operator paths.
- [ ] Lock parent/media associations consistently for replacement/reorder/delete/publication. Test two sessions, ownership changes, insertion/deletion races, rollback after the final write and unique sequential ordering.
- [ ] Reserve upload/publication outbox jobs transactionally; reconcile external storage side effects separately. Database rollback cannot undo a completed S3 PUT or revoke an already public copy.
- [ ] Run the same application repository tests against the approved disposable development adapter with synthetic data only; verify actual SQL/RLS/grants, pooling, timeouts and deadlock retries. Keep mock/model results labeled separately.

See [private-media migration proposal](infrastructure/PRIVATE_MEDIA_MIGRATION_PLAN.md) for the proposed object/publication model. This Phase 3D checklist introduced no live-test command. Phase 3E added a generated local schema migration snapshot but did not apply it or connect to Neon.

## Phase 3E legacy data migration gate (2026-11-11)

The owner confirmed the exact external backup path, and Phase 3E re-read that one file only. The independent read-only parser confirmed its format/counts and emitted sanitized aggregate output. These historical counts are not evidence of current production data. No connection, import, database snapshot comparison, or imported-data validation is complete.

Before any development import:

- [x] Confirm exact backup path and repeat bounded read-only non-executing inspection; compare sanitized counts/schema to prior audit. Keep all record values out of logs and repository artifacts.
- [ ] Separately identify the authoritative current-v5 source; do not treat a historical backup as a production cutover snapshot.
- [ ] Approve a versioned source-to-target field map, ambiguous status/audience rules, timezone handling, slug/route aliases, identity proof and bug-report retention. Preserve unknown fields and source provenance in restricted reconciliation data.
- [ ] Implement and review an offline, deterministic dry-run mapper against synthetic fixtures; require explicit conflict and orphan reports, stable IDs, second-run idempotence and fail-closed behavior.
- [ ] Explicitly attest a dedicated disposable Neon development branch, no production traffic, data classification and least-privilege role. Confirm rollback/restore point out of Git; a URL hostname or existing local setting is not sufficient.
- [ ] Obtain separate approval for a database connection/import. Import no provider roles, grants, SQL routines, auth sessions, password verifiers or unreviewed privileges. Keep media URLs/keys intact and do not move/delete S3 objects.
- [ ] Compare counts, IDs, relationships, content, dates, status/audience, route compatibility, rendered homepage/blog/projects and authorization against the imported development dataset. Until all assertions pass, report migration status as NOT RUN/NOT PASSED.

Clerk/Supabase identities are not assumed compatible with Better Auth. Preserve historical ownership references where evidenced, but require verified enrollment/linking; no email-only identity merge or imported admin/owner grant. Never import legacy password hashes unless compatibility and security are separately verified and explicitly approved.

The local Phase 3E parser/mapping contracts are under `scripts/phase3e/` with synthetic tests in `tests/phase3e/`. Drizzle/Neon and Better Auth code/dependencies now exist locally, but there is no import writer, provider connectivity, verified branch identity, or database-backed migration validation.
