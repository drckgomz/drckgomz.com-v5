# Phase 3E — Neon, Drizzle, Better Auth implementation review

**Status:** local architecture foundation implemented; database connection, schema application, and legacy import are not authorized and have not run.

## Summary

Added a side-by-side Drizzle schema for application content, authorization, Better Auth, exact-shape legacy staging, and import provenance. Added lazy server-side Neon/Better Auth configuration, closed public registration, a verified-identity/explicit-approval first-owner bootstrap routine, and opt-in read repositories for blog and project detail content. Added deterministic offline legacy target candidates and conflict checks. The existing Clerk/Supabase implementation remains present and is still the default, so existing users and routes are unaffected until separate development testing and deliberate flag selection.

## Implemented files

- Schema, lazy connection, and offline migration generator: [`schema.ts`](../src/lib/db/schema.ts), [`client.ts`](../src/lib/db/client.ts), [`config.ts`](../src/lib/db/config.ts), [`drizzle.config.ts`](../drizzle.config.ts), [`drizzle/`](../drizzle/).
- Better Auth route/config/viewer/owner gate: [`better-auth.ts`](../src/lib/auth/better-auth.ts), [`route.ts`](../src/app/api/auth/%5B...all%5D/route.ts), [`get-better-auth-viewer.ts`](../src/lib/auth/get-better-auth-viewer.ts), [`bootstrap-first-owner.ts`](../src/lib/auth/bootstrap-first-owner.ts).
- Provider-aware layout and client session compatibility: [`RootAuthProvider.tsx`](../src/components/auth/RootAuthProvider.tsx), [`BetterAuthSessionProvider.tsx`](../src/components/auth/BetterAuthSessionProvider.tsx), [`BetterAuthSignIn.tsx`](../src/components/auth/BetterAuthSignIn.tsx), and `/sign-in`/`/sign-up` pages.
- Opt-in blog/project readers: [`blog.ts`](../src/lib/db/repositories/blog.ts), [`projects.ts`](../src/lib/db/repositories/projects.ts), [`read.ts`](../src/lib/blog/read.ts), [`public.ts`](../src/lib/projects/public.ts).
- Offline transforms/tests and development gating: [`legacy_mapping.py`](../scripts/phase3e/legacy_mapping.py), [`validate_migration.py`](../scripts/phase3e/validate_migration.py), [`PHASE3E_IMPLEMENTATION.md`](PHASE3E_IMPLEMENTATION.md), [`PHASE3E_TEST_MATRIX.md`](PHASE3E_TEST_MATRIX.md).

## Security and compatibility decisions

- Better Auth has email/password sign-in enabled but sign-up disabled. Email verification is required. Session state is checked server-side; profile activity and roles/capabilities are re-read from application tables.
- No legacy password hashes, sessions, reset tokens, or tokens are mapped into Better Auth. Imported users remain restricted legacy records; the historical `is_admin` flag is not authority.
- Owner bootstrap is not an HTTP endpoint. It serializes with a transaction advisory lock, requires a verified Better Auth identity plus a separately approved evidence reference, and denies when an owner role already exists, including inactive owners.
- Posts use separate `publication_state` and `visibility` fields. Legacy active posts become private drafts in target candidates. Backup rows have no slugs and timestamps lack timezone provenance, so route/date blockers remain explicit.
- Public Drizzle reads enforce published/public state, soft-delete guards, existing slug and UUID route compatibility, media ordering, and sanitization. The blog/project read flags are opt-in. Supabase/Clerk remain default; admin CMS writes, terminal commands, user administration, and homepage section reads still use existing repositories.
- Missing database/auth settings produce bounded 503 responses or a service-unavailable page without echoing configuration values. Schema generation always uses a fixed loopback placeholder and does not read `DATABASE_URL`.

## Legacy data preparation

The earlier read-only backup inventory and schema comparison remain authoritative as a historical snapshot only. New target candidates preserve source identifiers and payloads, omit user password/reset fields, retain media references/relationships in restricted legacy staging, and never grant permissions. Synthetic validation detects source duplicate IDs, relationship orphans, and existing target post ID/slug conflicts. The planner remains in-memory and does not serialize private rows or connect to a database. Current source-v5 content may differ from the dated backup; no live current database was compared.

## Dependency changes

Project-local pnpm changes added exact `better-auth@1.7.16`, `@better-auth/drizzle-adapter@1.7.16`, `drizzle-orm@0.45.4`, `@neondatabase/serverless@1.2.0`, `drizzle-kit@0.31.11`, and `tsx@4.23.15` (lockfile updated). The script uses `tsc` + Node instead of tsx because tsx tries to open an IPC pipe and hits sandbox `EPERM`; tsx remains a dev dependency. `next` and `eslint-config-next` moved from 16.0.7 to 16.4.5 for upstream security fixes. Clerk/Supabase remain installed for live legacy code paths. Nothing was installed globally.

## Validation (this session)

| Command/check | Result |
|---|---|
| `pnpm test:phase3e` | Pass: 5 TypeScript auth/config/access tests and 16 Python inventory/mapping tests |
| `pnpm test:security` | Pass: 218/218 |
| `pnpm test:integration` | Pass: 60/60; these use the repository's in-process mocks, not Neon or a real DB |
| `pnpm exec tsc --noEmit --incremental false` | Pass |
| `pnpm exec eslint src/lib/auth src/lib/db src/lib/blog/read.ts src/lib/projects/public.ts tests/phase3e` | Pass |
| `pnpm lint` | Fails: 101 errors, 5 warnings across the app; unrelated legacy/style diagnostics remain. Earlier Phase 3C figure was 93/5 and the ESLint/Next config has since changed, so the counts are not a clean like-for-like regression measurement. No lint rules were disabled. |
| `pnpm db:generate` | Pass; generated local SQL only using the fixed offline placeholder. No network/database access. |
| `BLOG_REVIEW_OUTPUT=.artifacts/phase3e/browser node scripts/blog-review-server.cjs --build-only` | Pass; synthetic component JS/CSS compiled without starting a server |
| `pnpm build` | Attempt remained running without further output during optimized compilation and held the Next build lock; it was stopped after extended silence. A retry was refused while the original attempt owned the lock. No successful full production build is claimed. Next.js reports that `middleware` is deprecated in favor of Next 16 `proxy`. |
| `git diff --check` | Pass at last run before final docs/mapping changes; rerun before completion |
| Browser QA | Not run in this phase; no claim of browser coverage |
| Neon connection/import/schema migration | Not run; requires explicit later approval and verified isolated development branch |

## Remaining blockers and next steps

1. Review generated SQL, policy semantics, and schema evolution before an approved development application. The DDL has not been tested against PostgreSQL/Neon.
2. Complete an isolated-branch connection gate and get separate approval for read-only identity verification, schema application, and import.
3. Review source-to-target treatment of missing blog slugs, timezone-naive timestamps, current-vs-backup changes, projects/home content semantic mappings, bug reports, ownership, and media exposure. Do not expose synthetic legacy slugs as public URLs.
4. Build transaction-backed repositories for CMS create/update/publish/unpublish, media replace/reorder/delete, user/role changes, and homepage section content. Add race/rollback tests against an approved dev branch after the local mock contracts are ready.
5. Define a verified Better Auth account enrollment/reset process before switching `AUTH_PROVIDER`; no existing Clerk or Supabase identity is implicitly linked.
6. Keep public object URLs and the AWS storage risks documented in the private-media plan. No AWS changes are part of this work.
7. Migrate `middleware.ts` to the Next 16 `proxy.ts` convention in a separate behavior-tested change.

The user must review this phase output before any later live database operation. Current database migration status remains **NOT RUN / NOT VALIDATED**.
