# Phase 3J.5H — Safe Incremental Development Migration Readiness

**Status:** Offline plan-only workflow prepared. No environment file was read, no database was connected, and no SQL or migration was executed. Better Auth remains disabled.

## Decision and scope

Migration `0003_early_blizzard.sql` is the only candidate for the verified 0000–0002 development baseline. This phase adds a plan-only classifier; it does not replace the existing fresh-database runner and does not provide an executable migration path. It distinguishes a genuinely empty database, the exact imported three-migration state, the exact four-migration state, and every partial or ambiguous state.

The current website remains in Clerk/Supabase mode. The migration changes only the Neon development schema; they do not migrate or publish historical content.

## Offline planner

Run the planner only after an independently approved read-only preflight has produced a local, aggregate-only evidence JSON file. The planner itself reads no environment file and has no PostgreSQL client or migration dependency. Example command shape:

```sh
node scripts/phase3f/incremental-migration-plan.mjs \
  --plan --evidence .artifacts/phase3f/incremental-migration-evidence.json \
  --console-attested \
  --project-id jolly-poetry-87664309 \
  --branch-id br-nameless-dust-bewpmr4r \
  --endpoint-id ep-sparkling-sun-bedq0ozn \
  --hostname ep-sparkling-sun-bedq0ozn.c-9.us-east-2.aws.neon.tech \
  --database neondb --postgres-major 18
```

The `--console-attested` flag is an operator attestation, not cryptographic proof. The operator must independently verify the project, branch-to-endpoint mapping, database, host, and PostgreSQL version in Neon Console immediately before any future live operation. The planner compares every supplied value with the pinned manifest. Missing or mismatched identity stops planning.

### Evidence contract

Evidence format version 1 must contain:

- Pinned target metadata and connection facts (`database=neondb`, PostgreSQL major `18`, role `neondb_owner`, and `transactionReadOnly=true`).
- Ordered migration hashes.
- Complete non-system schema, table/relation, enum, and application-routine inventories.
- Exact aggregate counts for the seven legacy staging tables, provenance row total, and import run total.
- Aggregate application/authentication row counts.
- Whether the generated session digest column exists and whether its definition matches the reviewed expression.
- Whether the digest index exists with the exact reviewed name, is unique, and is valid.

The verified pre-0003 state requires exactly hashes 0000–0002, the reviewed schema/table/enum inventory, no application or authentication rows, staging distribution `0/6/3/10/2/2/2`, 25 provenance mappings, one import run, and no digest column/index. A fresh-empty state requires no ledger and no user objects beyond the default `public` schema. A four-hash state is treated as complete only when the generated digest definition and unique valid index are verified. This exact evidence has **not** been collected in this phase.

The evidence must be produced from read-only catalog and aggregate queries in a separately approved preflight, never from application records or a hand-edited claim. `scripts/phase3f/collect-incremental-migration-evidence.mjs` is the prepared collector. It requires exact Console-attestation flags, reads only `.env.neon.development.local` when separately invoked, makes one connection, starts `BEGIN READ ONLY`, sets a 15-second statement timeout, and collects catalog metadata and aggregate counts only. It rolls back, closes the client/pool, and writes a mode-0600 evidence artifact under `.artifacts/phase3f/`. It was not executed in this phase.

Future read-only command shape (requires separate approval before invocation):

```sh
node scripts/phase3f/collect-incremental-migration-evidence.mjs \
  --collect-read-only-evidence --console-attested \
  --project-id jolly-poetry-87664309 \
  --branch-id br-nameless-dust-bewpmr4r \
  --endpoint-id ep-sparkling-sun-bedq0ozn \
  --hostname ep-sparkling-sun-bedq0ozn.c-9.us-east-2.aws.neon.tech \
  --database neondb --postgres-major 18
```

After that separately approved read-only collection succeeds, use the offline `--plan` command above with the generated `.artifacts/phase3f/incremental-migration-evidence.json` path. The planner does not open that generated file during this phase.

## Dry-run outcomes

| Recognized evidence | Planned action | Result |
|---|---|---|
| Fresh empty target | No incremental migration; directs operator to the separately reviewed fresh schema workflow | No changes |
| Exact 0000–0002 baseline plus reviewed staging state | Only `0003_early_blizzard.sql` with pinned SQL and snapshot hashes | Candidate plan, execution disabled |
| Exact 0000–0003 state and verified digest/index | No migration pending | No changes |
| Partial, reordered, unknown, drifted, or internally inconsistent state | Reject | Stop for manual review; never repair or retry |

For the 0000–0002 baseline, the plan lists the generated column and unique index, the exact four-hash ledger as a postcondition, unchanged 25 staging/provenance records, and unchanged application/authentication counts. It reports `executionAllowed: false` in every case. `--apply` is rejected; this planner cannot connect or mutate.

## Future mutation approval gate

Any future execution tool must be a separate reviewed program. Before it can mutate, it must require all of:

1. Fresh independent Neon Console target attestation for project `jolly-poetry-87664309`, development branch `br-nameless-dust-bewpmr4r`, endpoint `ep-sparkling-sun-bedq0ozn`, the exact development hostname, database `neondb`, PostgreSQL 18.
2. Exact local manifest, migration journal, SQL, and snapshot validation.
3. A fresh read-only catalog preflight that classifies exactly the 0000–0002 state and matches staging/provenance counts.
4. A separate explicit schema-application approval flag and a non-empty approval reference.
5. A verified development restore point and an operator available to stop on any partial/unknown state.

`assertMutationApproval()` encodes the separate confirmation and approval-reference predicate for a future runner; no present script calls it to execute SQL. This document and an offline plan do not constitute migration approval.

## Recovery and rollback limits

The current 0003 change is additive: a stored generated column and a unique index. If an approved execution fails, do not automatically rerun or repair. First use read-only inspection to establish the exact ledger and object state, then stop for review. A partial index/column or missing ledger entry is ambiguous and is a no-go.

Rollback is not an automatic inverse. It requires a separately reviewed migration that drops the exact index and generated column after the app is confirmed not to use the digest. Preserve the three earlier migrations and all legacy staging/provenance data. If cleanup is not necessary, prefer leaving a verified additive migration in place over an improvised rollback. Restore the development branch only from a verified restore point under separate approval.

## Operator responsibilities

- Verify Console branch-to-endpoint identity immediately before any live preflight or migration; a URL is not proof of branch identity.
- Supply only a generated, aggregate-only evidence artifact; review it for expected staging and empty app/auth counts without displaying personal records.
- Keep Clerk/Supabase as the active website mode and keep Better Auth disabled.
- Treat a count, hash, schema, role, or endpoint mismatch as stop-only; do not edit the evidence to force a plan.
- Request separate approval for read-only evidence collection, and a different explicit approval for schema mutation.
- After any later approved migration, verify the four ordered ledger hashes, generated expression, unique index validity, and unchanged row counts in a read-only transaction. Stop on partial state.

## Validation in this phase

- The planner tests distinguish empty, exact three-migration, and exact four-migration states.
- Negative tests reject one- and two-entry partial ledgers, unknown/reordered hashes, extra relations, changed staging counts, non-empty app data, mismatched digest state, invalid indexes, incorrect target attestation, writable/non-target connection evidence, and missing fields.
- Existing migration-manifest tests continue to reject unexpected files, journal drift, and checksum mismatch.
- The evidence collector was syntax/lint reviewed only; its database behavior has not been executed or verified.
- No live database evidence was collected. The workflow is ready only for a separately approved **read-only development evidence-collection rehearsal**. It is **not ready for schema application**; PostgreSQL 18 semantic verification and a separate migration-application runner/approval remain required.
