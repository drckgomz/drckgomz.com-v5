# Phase 5 — Migration runbook and current local status

## Current state

- Prior owner report: 25 historical rows were imported into Neon development `legacy` staging with provenance; this session did not reconnect to Neon.
- PostgreSQL 18.6 migrations `0000` through `0004` were applied to the disposable repository-local `drckgomz_phase5_test` at `127.0.0.1:55441`. The Neon target guard was unchanged.
- The authorized backup was reread and verified against the prior fingerprint. The local importer staged 25 rows and 25 provenance mappings; three bug reports remained excluded. Credentials, Better Auth accounts, roles, public application rows, and media objects were not written. An idempotent rerun succeeded.
- No remote database, AWS, deployment, or external provider operation ran.

## Local normalization status (2026-11-12)

- `scripts/phase5/normalize-legacy-local.mjs` transforms the staged source into `app.posts` and `app.media` only on the pinned disposable PostgreSQL 18 target. It verifies all five local migration hashes, the staged fingerprint and provenance, takes a transaction advisory lock, and reconciles before commit.
- The local run wrote exactly 2 posts and 2 linked media rows with source-ID provenance. Post UUIDs and HTML are preserved. The backup has no slug field, so stable slugs are derived from title plus original UUID; they are not claimed as recovered original slugs.
- Both rows remain `draft/private` because the legacy `active` state does not establish audience or publication intent. Deleted rows map to archived. No identities, passwords, sessions, roles, bug reports, or public media URLs were copied. App media URLs remain null until storage objects are reviewed and migrated.
- Timestamp normalization initially exposed local-time and millisecond-precision defects. Versioned v2/v3 runs corrected them by passing timestamp text with an explicit UTC suffix and comparing inside PostgreSQL at full precision. Raw source wall-clock timestamps remain in `legacy`; UTC is a deterministic interpretation, not proof of the original timezone.
- `pnpm db:normalize:legacy:local -- --dry-run` performs read-only preflight/reconciliation. `pnpm db:normalize:legacy:local -- --apply-local-content` targets only the pinned disposable database. This is never a remote Neon import path.
- The two posts do not appear in public routes, by design. Owner preview against this local target is still unavailable. Publication requires human review of slug, date, audience, and media.
- Migration `0003_early_blizzard` was changed locally from an invalid generated digest expression to a trigger-maintained digest because PostgreSQL 18 rejects the original expression as non-immutable. The pinned local database has the trigger version. If another database ledger records the original migration hash, stop: do not rewrite that ledger or rerun `0003`; prepare an additive, state-aware forward repair only after verifying its exact schema and hash.

## Safe offline workflow

1. Preserve the original dump read-only and verify it against the existing Phase 3E sanitized fingerprint. The local importer treats COPY data as input and never executes dump SQL through `psql` or `pg_restore`; the dump contains provider DDL that is not part of the application migration.
2. Run the existing Phase 3E parser/mapping checks in dry-run mode. Confirm expected source totals (28 application rows) and mapping totals (25 stageable rows, three deferred bug reports) from the report, without displaying record values.
3. Run `pnpm db:validate:offline`. It validates ordered migration tags, checksums, snapshots, the journal, the fixed development target metadata, and deny-by-default RLS on the new tables. It makes no connection.
4. Run TypeScript, security, integration, migration-mapping tests and `git diff --check`.
5. For the disposable database only, use `pnpm exec drizzle-kit migrate --config scripts/phase5/local-drizzle.config.ts`; verify the session trigger with `psql ... -f scripts/phase5/local-session-digest-smoke.sql`. The config does not read environment files or `DATABASE_URL`.
6. Before any future remote action, independently verify project, development branch, endpoint, database, role and a restorable point in Neon Console. Use the explicit development file and exact target guards; never use inherited `DATABASE_URL` or production credentials.
7. Obtain separate approval for each remote schema write, staging import, normalized-content import, account bootstrap and storage transfer. Dry-run and precondition output must be reviewed before each approval.

## Future isolated import requirements

- The local runner at `scripts/phase5/import-legacy-local.mjs` defaults to dry-run and only accepts `--apply-local`. It verifies the backup fingerprint, loopback target, PG major, five migration hashes, empty targets, staged field values, source relationships, provenance, and unchanged application/authentication tables. It permits a rerun only when the deterministic ledger matches the same source and mapping version.
- Choose and verify a disposable local PostgreSQL or separately approved Neon development target. Never infer safety from a database name.
- Apply reviewed migration files in order on the target only after an explicit approval. Confirm all expected schema objects, effective role permissions, forced RLS behavior, helper function definitions, and application queries before loading records.
- For legacy staging, verify target tables and provenance are empty or exactly match the deterministic prior run. Use one transaction per approved import unit, deterministic mapping IDs, advisory serialization, FK-order inserts, and rollback on any mismatch.
- The local-only normalization above is a conservative private/draft cutover, not publication approval. Do not change publication or visibility until slug/date/status/audience/media decisions are resolved. Users never create Better Auth identities or roles through import.
- After import, compare aggregate source/destination counts, source-key coverage, relationships, preserved timestamps/content fingerprints, restricted state, and audit/provenance. Report only aggregates and opaque conflict identifiers.

## Recovery and rollback

For a disposable local database, discard and recreate the local database/data directory only after confirming no other test is using it. For Neon development, recover by returning to an independently verified pre-import branch/restore point or discarding the dedicated branch under separate approval. Do not attempt ad-hoc reverse-delete SQL against shared data. The source backup is immutable and is never a rollback target.

## Go/no-go

**NO-GO for full application or production use.** Local PG18 migration and historical staging are verified, but admin mutations intentionally return 503 because no Neon CMS mutation repository has replaced the legacy routes. Better Auth registration/login/email delivery have not been exercised end-to-end. New audience/appearance tables are forced-RLS with no grants/policies, so they remain unavailable by design. The appearance CMS, private media migration, complete owner dashboard, and normalized/public content cutover remain incomplete.
