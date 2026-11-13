# Phase 3E offline migration tools

These tools currently inspect the confirmed backup, compare sanitized schema contracts, map synthetic/approved source rows in memory, and validate aggregate snapshots. They do not write to Neon and do not provide a database import writer. See [`docs/PHASE3F_NEON_PREFLIGHT.md`](../../docs/PHASE3F_NEON_PREFLIGHT.md) for the gated Neon procedure.

## Backup inspection

`python3 scripts/phase3e/inspect_backup.py` reads only the literal confirmed path in that script. It refuses a symlink/non-regular file, does not execute SQL, skips COPY values as opaque lines, validates field widths, and emits schema plus aggregate findings. Any report stays under the ignored `.artifacts/phase3e/` directory and is restricted migration metadata.

## Offline contracts

`python3 scripts/phase3e/compatibility.py` compares a sanitized inventory with code-observed field contracts. It does not prove current database compatibility.

`python3 -m unittest discover -s tests/phase3e -v` exercises deterministic mapping, duplicate/conflict detection, and aggregate-only snapshot comparison. Duplicate source IDs are reported; snapshot counts do not silently treat duplicates as unique records.

The mapper preserves source IDs, timestamps and supported payload fields in memory except excluded credentials/reset tokens. Historical posts are private drafts and media/users/projects remain quarantined where semantics are unresolved. These are candidates only, not persisted imports.

## Database status

The Drizzle schema and two generated migration files now exist. `drizzle.config.ts` uses a fixed unreachable loopback placeholder and `pnpm db:generate` is offline. No database connection, preflight, migration, import or account creation has been performed. Do not run `drizzle-kit migrate` until branch identity, migration conflicts, restore/rollback and a separate schema-application approval are recorded.

There is not yet a Neon import writer. Current app functionality also remains partly on Supabase and Clerk; see `docs/PHASE3E_IMPLEMENTATION.md` for the staged replacement status.
