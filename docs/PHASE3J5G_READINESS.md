# Phase 3J.5G — Fail-Closed Backend Configuration and Migration Readiness

**Scope:** Offline source/configuration work only. No environment file was opened; no database, provider, or external service was contacted; no SQL or migration was executed. Better Auth remains disabled for development integration.

## Backend configuration contract

`src/lib/backend-configuration.ts` is the single parser for runtime backend selectors. Missing variables retain the existing legacy defaults:

| Selector | Existing default | Accepted values |
|---|---|---|
| `AUTH_PROVIDER` | `clerk` | `clerk`, `better-auth` |
| `BLOG_READ_BACKEND` | `supabase` | `supabase`, `drizzle` |
| `PROJECT_READ_BACKEND` | `supabase` | `supabase`, `drizzle` |
| `PRIVATE_MEDIA_BACKEND` | follows `BLOG_READ_BACKEND` (therefore `supabase` by default) | `supabase`, `drizzle` |
| `CMS_MUTATION_BACKEND` | `supabase` | `supabase`, `disabled` |

Currently supported combination is Clerk + Supabase blog reads + Supabase private-media lookup + Supabase CMS mutations. Public project reads may use either reviewed public reader. Blog and private-media readers must agree. A misspelling, unknown value, or mixed provider/reader/mutation combination throws a generic configuration error without echoing a supplied value.

The future Better Auth combination is explicit in the parser's compatibility contract: blog reads and private-media lookup both use Drizzle, and legacy CMS mutations are disabled. Even that coherent combination currently returns unavailable because the 3J.5E gates are open. The Better Auth auth/session route, UI, middleware, profile paths, private media, and owner-audience path now pass through the central contract; unsupported settings fail closed before privileged route handlers can use Supabase service-role clients. Existing Clerk/Supabase defaults remain unchanged.

`PRIVATE_MEDIA_BACKEND` is a new optional selector. Omitting it inherits `BLOG_READ_BACKEND` for compatibility. It must not be configured differently from blog reads.

## Migration manifest and validators

`scripts/phase3f/development-migration-manifest.json` records the reviewed development target and exact Drizzle migration 0000–0003 SQL hashes, journal hash, and snapshot hashes. `development-migration-manifest.mjs` independently pins the manifest digest and target, rejects unreviewed generated SQL/snapshots, checks journal metadata/order, and verifies each SQL/snapshot checksum. The offline check is:

```sh
node scripts/phase3f/check-development-migration-manifest.mjs
```

The Phase 3F apply runner, migration verifier, Phase 3I validators, and first-owner bootstrap now share these expected hashes and recognize the known pre-0003 ledger (0000–0002) and post-0003 ledger (0000–0003). Any unknown/partial hash sequence fails. The read-only Phase 3I SQL verifier also accepts exactly those two aggregate ledger states.

The migration runner still has its original **empty-target** application precondition. It is not a prepared incremental runner for the existing development database, which contains the first three migrations and historical staging rows. Therefore it will stop before applying on that populated target. A separately reviewed incremental `0003` runner must verify the exact pre-0003 schema state and preservation of the reviewed 25 staging/provenance records before migration approval. This phase does not make 0003 applicable and does not change that approval boundary.

The manifest pins project `jolly-poetry-87664309`, development branch `br-nameless-dust-bewpmr4r`, endpoint `ep-sparkling-sun-bedq0ozn`, hostname, database `neondb`, and PostgreSQL major version 18. Connection strings alone do not establish branch identity; any future operation still requires fresh Neon Console attestation. This offline validator does not read a URL or environment file.

## Verification results

- `node scripts/phase3f/check-development-migration-manifest.mjs`: passed; four migrations, target and generated artifacts matched.
- `node --test tests/phase3e/migration-manifest.test.mjs`: passed, 3 tests. Covers expected manifest, unexpected SQL file, journal modification, and SQL checksum drift.
- Backend configuration tests cover defaults, valid project-reader choices, missing/empty values, typos, mismatched blog/private-media backends, Clerk/Drizzle mismatch, Better Auth with legacy reads/mutations, and the deliberately disabled coherent Better Auth configuration.
- No live or read-only database operation was performed.

## Remaining blockers / no-go conditions

1. Better Auth/Neon remains disabled pending all Phase 3J.5E findings. Passing these offline tests does not change that status.
2. PostgreSQL 18 must validate migration 0003, RLS semantics, helper functions, grants, effective privileges, and rollback behavior on the independently attested development branch.
3. RLS verification must compare policy command, permissive mode, roles, `USING`/`WITH CHECK`, helper owner/security/search path, function ACLs, and effective inherited privileges; policy names alone are inadequate.
4. The current migration runner cannot incrementally apply 0003 to the populated staging database. An incremental, exact-state runner and read-only pre/post verification are still required.
5. CMS writes, homepage sections/media, project media, terminal/admin-user routes, and private object storage are still Supabase/storage owned. Better Auth cannot serve as a global admin identity until those routes are explicitly denied or migrated with tested permissions and contracts.
6. Session-token digest logging, actual Next.js response redaction, expiration/logout/revocation, and concurrency must be tested against PostgreSQL 18 and the real development runtime before activation.
7. Public object URLs and previously cached media remain outside database RLS and need a private-storage solution before private media is claimed secure.

## Files changed in Phase 3J.5G

- `src/lib/backend-configuration.ts`
- `src/lib/auth/viewer.ts`
- `src/lib/auth/session-token-digest.ts`
- `src/lib/admin/requireAdminApi.ts`
- `src/lib/blog/read.ts`
- `src/lib/projects/public.ts`
- `src/app/api/private/journal-media/[mediaId]/route.ts`
- `src/app/api/auth/[...all]/route.ts`
- `src/app/api/profile/route.ts`
- `src/app/api/admin/private-audience/route.ts`
- `src/app/sign-in/[[...sign-in]]/page.tsx`
- `src/app/sign-up/[[...sign-up]]/page.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/private-access/page.tsx`
- `src/components/auth/RootAuthProvider.tsx`
- `src/middleware.ts`
- `scripts/phase3f/development-migration-manifest.json`
- `scripts/phase3f/development-migration-manifest.mjs`
- `scripts/phase3f/check-development-migration-manifest.mjs`
- `scripts/phase3f/apply-development-migrations.mjs`
- `scripts/phase3f/verify-development-migrations.mjs`
- `scripts/phase3i/import-legacy-development.mjs`
- `scripts/phase3i/verify-legacy-import.mjs`
- `scripts/phase3i/neon-readonly-import-verification.sql`
- `scripts/phase3j5a/bootstrap-first-owner-development.mjs`
- `tests/phase3e/backend-configuration.test.ts`
- `tests/phase3e/migration-manifest.test.mjs`
- `tests/phase3e/tsconfig.json`

## Next approval boundaries

Offline work may continue on route/feature test coverage and a separate incremental migration runner. Applying migration 0003, applying manual RLS/functions, role changes, enabling Better Auth, OAuth setup, owner bootstrap, private storage changes, and any data import each remain separate live-operation approval gates. No approval is requested or implied by this document.
