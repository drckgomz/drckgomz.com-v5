# Local build handoff — current completion status

## What is implemented locally

- A minimal cinematic home shell with centered text navigation and decorative, noninteractive video/poster handling. It is configured to render a static CSS fallback until a reviewed local asset/configuration is provided.
- The original blog page/article components remain in place. Offline preview substitutes labeled fixtures while retaining the original card presentation; configured public blog reads use the Drizzle repository, with existing public/private checks and protected media routing.
- The terminal has a fixed allowlisted command interpreter. It does not run a shell, fetch a database command registry, or display media controls. `drckgomz` links home.
- Public project listing/detail now reads through Drizzle and has a responsive gallery page. `/about`, `/travel`, and `/contact` resolve but are honest placeholders, not restored content.
- Better Auth and role-specific Drizzle connection foundations exist. Runtime configuration rejects Clerk/Supabase selectors and CMS writes stay disabled. The old protected CMS route implementations are not yet replaced and their API guard returns 503 before business queries.
- Migration `0004_sour_catseye.sql` adds audience-group/access-request/site-media/appearance schema and forces RLS without grants. These tables are intentionally unusable until reviewed SQL policies and repositories are ready.
- The new offline-only migration validator pins all five checked-in Drizzle migrations, journal, snapshots, and the documented development target. It never opens a connection.

## Phase 5 local database and legacy staging update (2026-11-12)

- PostgreSQL 18.6 is installed locally. A separate disposable cluster lives at `.artifacts/phase5/local-postgres18`, listens only on `127.0.0.1:55441`, and contains `drckgomz_phase5_test`. The application Neon endpoint guard was not changed. Homebrew also initialized its package-default cluster; this work did not connect to it. The earlier PostgreSQL 17 test cluster is not the selected integration target.
- Migration 0003 initially failed because PostgreSQL marks `convert_to(text, name)` `STABLE`, so it cannot be used inside a generated column. It now maintains the digest with a `BEFORE INSERT OR UPDATE OF token` trigger, backfills existing sessions, and enforces a non-null unique digest. The trigger has a fixed `pg_catalog` search path and no PUBLIC execute grant. All five checked-in migrations apply successfully to disposable PG18.6. A synthetic token insert/update was verified inside a transaction that rolled back.
- The authorized backup was reread by the safe Phase 3E inspector. It remains 201,030 bytes with the previously reviewed fingerprint. Its sanitized inventory reports 28 website rows: 2 posts, 10 media, 6 content, 3 content-media, 2 post-media, 2 users, and 3 bug reports.
- A local-only staging runner imports the 25 allowlisted rows and provenance into `legacy`/`ops`. It excludes all 3 bug reports, credentials, Better Auth accounts, roles, public application rows, and media-object operations. It compares each imported field, validates relationships/provenance, and checks that application/auth tables remain empty. Initial import and idempotent rerun both succeeded. This is not a normalized/public content cutover.
- Phase 5 follow-up has now normalized the two staged historical posts and their two linked media references into the local `app` tables. They remain unpublished private drafts; slugs are deterministic derivatives because the source backup has no slug field. Media URLs remain null pending storage review. A repeat dry-run verified source IDs, content, relationship, provenance, conservative state, migration hashes, and timestamp reconciliation.
- The runner defaults to dry-run. Only `--apply-local` enables a write; host, port, database, role, PG major, migration history, and source fingerprint are pinned. It does not read environment files or inherited connection settings.

## Not complete / go-no-go

**Not ready for production or a full Neon cutover.** The normalized local historical rows remain private drafts and are not shown by public blog routes. This checkout still lacks a working Neon-backed admin CMS, object-storage upload/configuration UI, transaction-safe CMS mutation functions, complete MEMBERS/CLOSE_FRIENDS/SELECTED_PEOPLE enforcement, email delivery, and verified OAuth flows. No auth accounts were created and no historical post was published.

The existing `can_view_private` capability is still the only wired nonpublic reader permission. New enum values remain inaccessible by default. Historical active posts remain staged and unreviewed. Existing public S3 URLs cannot be made private by application routing; object migration and bucket configuration need a separately approved storage plan.

## Validation recorded in this implementation session

| Check | Result |
|---|---|
| `pnpm test:security` | Passed: 227 tests |
| `pnpm test:integration` | Passed: 68 tests (in-process repositories/providers; no live database) |
| `pnpm test:phase3e` | Passed: 67 Node tests and 17 Python tests; its test TypeScript compilation passed |
| `pnpm test:phase5` | Passed: 11 offline migration/import-safety/normalization tests |
| `pnpm exec tsc --noEmit` | Passed |
| `pnpm exec drizzle-kit check` | Passed |
| `pnpm db:validate:offline` | Passed for five ordered local migrations; no connection opened |
| Focused ESLint on changed application/test files | Passed |
| Full `pnpm lint` | Still fails: 85 errors and 5 warnings across existing application code |
| `node scripts/blog-review-server.cjs --build-only` | Passed; fixture components/CSS compiled without starting a server |
| `pnpm test:browser` | Passed: 57 Playwright fixture cases (responsive reading/editor, media, privacy, and navigation contracts). |
| Actual offline Next.js browser review | Passed: `/`, `/blog`, and two public fixture posts returned 200; unknown/private and protected routes were blocked; 390/768/1440 widths had no horizontal overflow; public card/back links and bug-report dialog worked; no page errors or external requests. Screenshots are under `.artifacts/phase5/`. |
| Normal `pnpm build` | Stalled in optimized Turbopack compilation without a diagnostic for about 75 seconds; only this build process was stopped. `.next` was not deleted. |
| `node scripts/phase3c-compile.cjs --phase3d` | Passed Webpack compile mode in 7.6 seconds using `.artifacts/phase3d/compile`, with no provider environment inherited. It does not perform final production generation. |
| PostgreSQL 18.6 `drizzle-kit migrate` | Passed: all five migrations applied to `.artifacts/phase5/local-postgres18` at `127.0.0.1:55441/drckgomz_phase5_test`; no remote DB was accessed. |
| Local session digest smoke test | Passed: insert/update digest checks; transaction rolled back. |
| Local legacy staging import | Passed: 25 staged rows, 25 provenance rows, 3 bug reports excluded, field/relationship reconciliation; repeat run did not duplicate rows. |
| Local historical normalization | Passed: 2 source-ID-preserving posts and 2 media relationships normalized; private/draft states, null media URLs, no auth identities or role grants; deterministic rerun reconciled. Timestamp conversion was corrected to retain full source precision under an explicit UTC interpretation. |
| Legacy source inspector | Passed: source size/fingerprint match prior review; output contained schema and aggregate data only. |
| `git diff --check` | Passed |

Browser interaction tests and screenshots completed successfully for both the fixture suite and the actual offline Next.js pages.

## Offline local use

Run `OFFLINE_DESIGN_MODE=1 pnpm dev` for the local public preview. Offline mode is development-only, does not initialize provider clients, and permits only the home, terminal shell, blog index, and the two named fixture articles. Provider-backed sign-in, admin, APIs, project data, and unapproved article paths remain unavailable. Offline fixtures are previews, not restored legacy records.

If the homepage/blog data backend is not configured, no fake provider credentials should be added. CMS mutation endpoints stay disabled. Actual offline HTTP and browser interactions were verified in this session; protected routes remained unavailable.

For local schema work, the PostgreSQL 18 cluster remains running on `127.0.0.1:55441`. `scripts/phase5/local-drizzle.config.ts` is pinned to it. `pnpm db:import:legacy:local` defaults to dry-run; append `-- --apply-local` to stage the reviewed source locally. `pnpm db:normalize:legacy:local -- --dry-run` verifies the normalized content; append `-- --apply-local-content` only for the pinned disposable database. Historical posts stay private drafts and media URLs stay unset. Do not change these runners into a Neon/production connection path.

## Development configuration checklist (names only; no values in this file)

Before enabling Better Auth or any database access:

1. In Neon Console independently verify the isolated development project, branch, endpoint, region, database and restore point. The local target guard is pinned to the previously approved development branch and is not a production URL selector.
2. Provision only separately approved auth, content-reader and owner-runtime credentials. Keep their URLs distinct; code expects `NEON_AUTH_DATABASE_URL`, `NEON_CONTENT_DATABASE_URL`, and `NEON_OWNER_DATABASE_URL` plus `NEON_TARGET`, `NEON_PROJECT_ID`, `NEON_BRANCH_ID`, and `NEON_ENDPOINT_ID`. There is no permitted production fallback. Do not put credentials in tracked docs.
3. Configure `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET`. Provider login additionally requires the paired `BETTER_AUTH_GOOGLE_CLIENT_ID`/`BETTER_AUTH_GOOGLE_CLIENT_SECRET` and/or `BETTER_AUTH_APPLE_CLIENT_ID`/`BETTER_AUTH_APPLE_CLIENT_SECRET`. Callback paths are `${BETTER_AUTH_URL}/api/auth/callback/google` and `${BETTER_AUTH_URL}/api/auth/callback/apple`; register exact HTTPS origins/redirect URIs with providers. Apple also needs its Services ID, domain association and private-key-derived client secret configured through a secure provider-console flow. Do not use production credentials for development.
4. Email verification/password reset requires an approved development mail sink/provider and a tested delivery adapter. No live email sender is configured by this work.
5. Before private storage testing, independently approve a dedicated private bucket with account-level public access blocks, encryption, no public ACL/policy, narrow object GET/PUT roles, bounded size/MIME validation, and private/no-store delivery. Relevant current code expects `S3_PRIVATE_JOURNAL_BUCKET`, `S3_PRIVATE_JOURNAL_PREFIX`, and `AWS_REGION`; it was not connected to AWS. Appearance media needs a separate admin upload and publication implementation.
6. Local staging and conservative normalization are complete in the disposable database. Before public rendering or remote use, review slug/date/audience/media mappings and test owner preview. Obtain separate approval for owner bootstrap, OAuth, storage, and any remote schema/data operation. Run the offline validator first; do not use the historical Phase 3F runner, which pins an older migration set.

## Production release prerequisites

- Replace the fixed development-only Neon target guard with an explicitly reviewed production deployment guard; do not accept arbitrary URLs.
- Finish database role grants, RLS policy behavior, functions, migration verification and real PostgreSQL integration tests.
- Implement transaction-safe Neon CMS repositories and owner dashboard; verify every route no longer reaches Supabase.
- Complete Better Auth email verification/reset, rate limiting, OAuth callback allowlists, account revocation and owner bootstrap testing.
- Migrate/reconcile data from an authoritative current source, then review every historical post slug/audience/date/media before publication.
- Reconcile and migrate public/private storage without changing live objects until separately approved; verify revocation and cache behavior.
- Complete end-to-end reader/admin/appearance/terminal workflows; run Playwright at 390/768/1440 px and keyboard/reduced-motion checks; capture new screenshots.
- Resolve full-lint diagnostics and obtain a successful optimized build, review dependency patches and prepare an explicit rollback point.
- Independently review, approve and execute production migration, storage changes, OAuth setup and deployment only in their own authorization gates.

## Phase 6 implementation update (2026-11-12)

The local-only Phase 6 slice now supersedes the earlier statement that all CMS mutations are disabled. Both `pnpm dev` and its `pnpm dev:phase6-local` alias use `scripts/phase6/dev-local.mjs`. The launcher reads only the generated mode-0600 synthetic owner artifact, pins all three local database URLs to the approved loopback PostgreSQL target `127.0.0.1:55441/drckgomz_phase5_test` with role-specific usernames, clears inherited/provider variables, validates the exact local target, and never falls back to Neon. It binds the app to `127.0.0.1:3000` and exits with a clear message if that port is already occupied.

Better Auth local email/password sign-in, persisted session, sign-out, owner profile resolution, owner dashboard listing, and secure private-draft reads were verified in a real browser against PostgreSQL 18.6. The two normalized historical posts remained private drafts. One post title was edited and restored through the UI; refresh showed the persisted title both times. After logout, the admin route redirected to sign-in, the post API returned 401, and its private article URL returned 404.

The owner dashboard now supports local draft creation, status changes (`public`, `private`, `draft`, `archived`), restore-to-draft, and deletion of posts with no linked media. Status updates use optimistic integer revisions and same-origin checks. Historical posts with linked media are rejected by delete with 409. Creation uses a parameterized explicit-column INSERT to preserve column-scoped privileges; it does not request broad table INSERT. The local `phase6_posts_owner_insert` and `phase6_posts_owner_delete` RLS policies require a current authenticated owner session. These grants/policies exist only on the disposable local cluster and are not part of a Neon migration.

The actual Phase 6 browser suite passed two tests: owner edit with persistence/logout/private denial and the draft-to-public/private/draft/archive/restore/delete lifecycle. Final aggregate verification reported exactly 2 app posts, 2 media relations, 1 synthetic Better Auth user, and 1 owner role; the synthetic lifecycle post was deleted. The runtime role has no table-level INSERT on posts but has the explicitly granted insert-column rights. All local login credentials remain under the ignored `.artifacts/phase6/local-owner.json` with mode 0600.

Focused TypeScript and ESLint checks passed for the changed routes, repository, create form, list hook, and browser spec. The offline migration manifest validator still verifies six ordered migrations and no database was contacted by that validator. The historical broad `tests/security` and `tests/integration` suites still contain assumptions about Supabase-backed CMS routes and the former timestamp mutation API; they do not pass as a whole against this incremental Better Auth/Drizzle route implementation. They need replacement contract tests for the new owner repository boundary rather than loosened security assertions. Upload/media mutation, audience grant management, appearance settings, email verification/reset delivery, and real provider/OAuth workflows remain unimplemented or unavailable.

## Public refresh-loop investigation (2026-11-12)

- `AllPostsGrid` previously requested `status=all` and depended on an auth context object recreated on provider renders. It now requests only `status=public`, has no auth-state dependency for public reads, and shows a manual retry button after failures. The collection API rejects all non-public status selectors before querying content. It returns only published public posts; restricted results are not included in the list.
- `BetterAuthSessionProvider` now memoizes its context value and keeps methods stable. Session API failure represents a signed-out state and does not trigger a public-page redirect or refresh.
- Use `pnpm dev` (or the equivalent `pnpm dev:phase6-local`) for the verified app at `http://localhost:3000`. The launcher pins PostgreSQL to `127.0.0.1:55441/drckgomz_phase5_test`, validates it before starting Next.js, clears provider variables, and does not fall back to Neon or Supabase. If PostgreSQL is stopped or the target identity differs, startup fails with a sanitized diagnostic. The launcher does not change `.env.local`.
- Actual Playwright verified one document navigation during 30 seconds on `/` and `/blog`; owner login and edit tests run against the same runtime. Anonymous `GET /api/auth/get-session` returns 200 with no session, `/api/profile` returns the expected 401, and the public list returns 200. `status=all` returns 400. A disposable post is visible in the public collection while published and disappears immediately when made private.
- A simulated 503 session response plus 500 blog response shows a stable error. In-flight sharing holds the public-grid request to one even with development Strict Mode; it makes no automatic retry over five seconds. Clicking Retry produces exactly one additional request. Interrupted-run cleanup matches only the suite's unique `phase-6-local-lifecycle-*` slug and title prefix.

## Local Better Auth completion (2026-11-12)

The local runtime supports member registration, email verification, login, persistent sessions, profile display-name updates, password change, sign-out, generic password recovery, and token reset. Local verification and reset messages are written to an ignored, mode-0600 inbox under `.artifacts/phase6/local-mailbox/`; open `/dev/mailbox` on the local app to use verification and reset links. The inbox API does not return tokens in its listing response, and verification/reset tokens are submitted in request bodies rather than token-bearing URLs. No real email is sent. Remote registration/recovery remains disabled until an approved mail provider is configured; this is intentional.

Verified on the actual local app and isolated PostgreSQL: registration and verification; profile update; logout/login; password change; forgot/reset; replay and expired-token denial; admin denial for an ordinary member; owner session persistence and post editing; private-post denial after logout; public blog access; and `/` plus `/blog` stability for 30 seconds. The full Phase 6 browser suite passed 5/5, Phase 6 offline tests passed 15/15, the focused authorization set passed 32/32, TypeScript and changed-file ESLint passed, the offline six-migration validator passed, and an isolated webpack production build passed. The legacy security/integration harnesses still have Supabase-era contract/mock failures (175/227 security and 53/68 integration passed); their assertions require a separate architecture-aware repair.

For the complete local authentication flow, run `pnpm dev`, open `http://localhost:3000/sign-up`, and use `http://localhost:3000/dev/mailbox` to verify the account. Password recovery starts at `/forgot-password`; retrieve its message from the same local inbox. Do not use the local inbox as a production email mechanism. The synthetic development owner credentials remain only in the ignored, mode-0600 `.artifacts/phase6/local-owner.json` file.
- The repeated document GETs in the original log were not reproduced. No server redirect or browser reload occurred during the 30-second checks. The client-side blog fetch churn is addressed; available evidence does not establish whether the earlier document requests came from HMR or a stale browser/server process.
