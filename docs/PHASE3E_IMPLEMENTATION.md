# Phase 3E local implementation and development gate

## Implemented locally

- `src/lib/db/schema.ts` defines Better Auth tables in `auth`, application content/identity/permissions in `app`, exact-shape legacy staging tables in `legacy`, and run/source-key provenance in `ops`.
- `src/lib/db/client.ts` creates a lazy server-only Neon WebSocket pool. Importing a page or building the app does not connect. Its pool is instantiated only when a database repository is called.
- `src/lib/auth/better-auth.ts` defines server sessions and the Drizzle adapter. Sign-up is disabled, email verification is required, cookies are HTTP-only, `SameSite=Lax`, and secure in production. Auth routes return bounded configuration errors without echoing values.
- `src/components/auth/RootAuthProvider.tsx` selects either the legacy Clerk provider or a Better Auth session provider. Shared client auth state covers blog reads, user menu, inactivity logout, terminal sign-out, and admin user-list requests. The existing `/sign-in` path switches to a password form for Better Auth; `/sign-up` displays a closed-registration message. Clerk remains the default.
- `src/lib/auth/get-better-auth-viewer.ts` resolves the current Better Auth session and reloads active profile roles/capabilities from the database. Session claims and legacy imported admin flags are not permissions.
- `src/lib/auth/bootstrap-first-owner.ts` is an operator-only function, not an HTTP endpoint. It uses a transaction advisory lock, requires explicit approval/evidence and a verified Better Auth identity, and refuses when any owner role already exists. It was not invoked.
- `src/lib/db/repositories/blog.ts` and `projects.ts` provide explicitly projected public/private reads, state/deletion checks, media ordering, sanitization, and legacy slug/UUID lookups. Existing Supabase/Clerk readers remain the defaults. The Drizzle readers are selected only by `BLOG_READ_BACKEND=drizzle` and `PROJECT_READ_BACKEND=drizzle`; admin writes and homepage section reads have not been moved, so do not set these flags until a development database contains compatible reviewed data.
- `drizzle/0000_petite_loki.sql` is generated schema DDL only. It has not been applied. Drizzle config uses a fixed loopback placeholder and does not read `DATABASE_URL` during generation.
- `scripts/phase3e/legacy_mapping.py::target_candidate` creates deterministic, non-writing app/staging candidates. It preserves original payload and source IDs, drops legacy password/reset fields, marks posts private drafts with unpublished deterministic legacy slugs, and leaves user, project semantics, and media delivery quarantined for review. No record-level migration report is written.

## Current boundary and remaining implementation

This is a side-by-side architecture foundation, not a cutover. Current production-shaped app flows still depend on Clerk/Supabase for CMS writes, user administration records, homepage sections, terminal command storage, and most public reads. Better Auth sessions are selectable with `AUTH_PROVIDER=better-auth`, but that provider and Drizzle readers must not be enabled against a database that has not been created and populated on an attested disposable development branch. Sign-in UI does not complete account provisioning, password recovery, or identity linking.

The schema is a reviewed starting point, not an assertion that legacy historical records directly fit v5. Historical posts have no source slug, excerpt, thumbnail, publication timestamp, or audience. Legacy timestamps are naive wall times. Candidate posts therefore remain `draft` + `private`; source status/date/content remain in the restricted legacy payload for reconciliation. The deterministic `legacy-<source-id>` slug is reserved for a later approved route map and must not be exposed as canonical until checked against current slugs and URLs.

## Exact isolated development connection checklist

This checklist is preparatory only. No database operation has been run.

1. In Neon console or another approved control plane, an operator independently verifies the project and branch IDs, confirms it is a dedicated disposable **development** branch with no production traffic, and records an attestation reference outside this repository. A hostname, branch-looking string, or local environment variable is not proof.
2. Create/confirm a restore point for that branch and test that it can be restored or that the branch can be discarded/recreated. Record the restore reference outside Git. Do not use production credentials or production data.
3. Create a least-privilege development role limited to the isolated branch and required schema DDL/DML. Keep its credential in the developer's local secret manager/environment; never paste it into chat or a repository artifact. Do not inspect or print `.env` values.
4. Review `drizzle/0000_petite_loki.sql`, dependency versions, table ownership, enum placement, unique constraints, FK delete behavior, transaction usage, and rollback procedure. Resolve mapping, timezone, slug, media, owner/bootstrap, and private-object decisions first.
5. Obtain explicit approval for the first live connection and separately for applying schema. Only then set a local development-only `DATABASE_URL` and run a read-only identity query with output limited to an opaque branch identity. Do not use the application pool to infer environment; the migration runner must require an explicit attestation token/reference and verify target identity before writes.
6. Only after a second explicit approval, apply generated DDL to the isolated branch. Do not use `drizzle-kit push`; use reviewed, versioned SQL migration files. Capture sanitized command exit codes, schema object counts, and applied migration ID, without recording connection strings.
7. Before import, run the Python offline transform/dry-run over an explicitly approved snapshot copy. Report aggregate counts, duplicates, orphans, unmapped rows, slug conflicts, timezone blockers, and credential-field exclusions. Do not emit source records, content, URLs, emails, or per-record hashes.
8. Require review of every unresolved/quarantined class. Import only approved records in an idempotent transaction with source-key provenance and row conflict comparison. Never import Better Auth sessions/password hashes or grant roles from legacy `is_admin`.
9. Compare source/target counts, identifiers, relationships, byte-for-byte content and media-reference preservation, source timestamps, routes, publication states, and homepage/project/blog render output. Exercise anonymous/private/admin access boundaries against synthetic and imported-development records. Record database-backed results separately from mocked tests.
10. If any check fails, stop and restore/discard only the disposable development branch using its verified restore point. Leave the source backup and S3 objects untouched. Do not call it a successful migration until reconciliation and route tests pass.

## Rollback and approval checkpoint

No import/migration command is provided by the application package scripts; the only database script is offline `db:generate`. `drizzle/0000_petite_loki.sql` is not executable by this phase as an operational step. Live connection, DDL, import, and any production cutover each require explicit later approval. The user has explicitly prohibited live Neon operations in this phase, so this document stops before them.

Rollback is by restoring the verified development restore point or discarding/recreating the disposable branch, never by inverse deleting rows in a shared database. The migration report must contain aggregate counts, opaque run/source fingerprints, status and attestation reference only; raw personal fields and credentials remain outside logs and Git.

## Local validation

Run `pnpm test:phase3e` for pure auth/config policy and synthetic mapping tests; `pnpm exec tsc --noEmit --incremental false` for TypeScript; and `pnpm db:generate` to regenerate local SQL without reading environment credentials or connecting. `tsx --test` is unsuitable in this sandbox because it starts a local IPC pipe and gets `EPERM`; tests compile with `tsc` and run with Node's built-in test runner instead. For offline UI compilation, `BLOG_REVIEW_OUTPUT=.artifacts/phase3e/browser node scripts/blog-review-server.cjs --build-only` compiles synthetic component JS/CSS without starting a server. Full `pnpm build` was attempted but stalled during optimized compilation without progress; it was stopped and is not counted as a pass. No live database test is claimed.

## Dependency record

Project-local dependencies added with pnpm (lockfile updated): `better-auth@1.7.16`, `@better-auth/drizzle-adapter@1.7.16`, `drizzle-orm@0.45.4`, `@neondatabase/serverless@1.2.0`, `drizzle-kit@0.31.11`, and `tsx@4.23.15`. Next and its ESLint config were patched from `16.0.7` to `16.4.5` in response to upstream Next.js security advisories; React remains 19.2.0. Legacy Clerk/Supabase dependencies remain installed because active application paths still use them. No package was installed globally.
