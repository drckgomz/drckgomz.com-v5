# Phase 3H — Development Schema Application

## Scope and target

Applied only the three reviewed Drizzle migrations to the Neon development branch after a fresh Console check. Neon Console showed project `jolly-poetry-87664309`, branch `development` / `br-nameless-dust-bewpmr4r` marked **Schema-only**, endpoint `ep-sparkling-sun-bedq0ozn`, and database `neondb`. Production was not accessed.

## Preconditions and execution

- `.env.neon.development.local` was validated by the fail-closed runner; it was the only configuration file used.
- The offline runner syntax/config check, Drizzle journal validation, all three pinned SQL SHA-256 checksums, and `git diff --check` passed before connection.
- The runner verified the database/role/version, obtained its advisory lock, and confirmed that the target had no migration ledger or pre-existing migration-target objects.
- Exactly `0000_petite_loki.sql`, `0001_bitter_tiger_shark.sql`, and `0002_many_kingpin.sql` were applied. The runner reported success.

## Read-only verification

`scripts/phase3f/verify-development-migrations.mjs` performed a catalog-only inspection inside a read-only transaction with a 15-second statement timeout, then rolled it back. It did not query application record contents.

- Database and expected migration role matched; PostgreSQL reported 18.6 and `transaction_read_only=on`.
- Six non-system schemas are present: `app`, `auth`, `drizzle`, `legacy`, `ops`, and `public`.
- 29 tables and one migration-ledger sequence are present across the application, auth, legacy staging, ops, and Drizzle schemas.
- 51 indexes were found; all were valid. The singleton-owner partial unique index is present.
- 193 constraints and 23 foreign keys were found. The positive revision/version checks are present.
- The two public enum types are intentional: both are declared in migration 0000 and referenced by app tables.
- The Drizzle ledger contains exactly three entries, in order, and each hash matches the reviewed migration SQL.
- The connected migration role has schema CREATE privileges. This is expected for the development owner role used to apply DDL; the inspection did not change permissions.

Full catalog metadata is stored in `.artifacts/phase3h/neon-postmigration-verify.log` with mode 0600. It contains no application row payloads or connection credentials.

## Result and limits

The schema application and migration-ledger verification passed. No legacy data was imported, no user or Better Auth account was created, no authentication was enabled, and no roles or production resources were changed. This verifies schema presence and migration history, not application-level reads/writes, Better Auth login, or historical-data compatibility; those require separately scoped development integration work.
