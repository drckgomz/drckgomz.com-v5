# Phase 8 CMS restoration progress

**Latest: Phase 9 blog metadata grant applied and verified locally (2026-11-13). Only `local-post-metadata.prepared.sql` was applied; the other three candidates remain unapplied. Earlier checkpoints below are historical.**

Updated 2026-11-13 after autonomous overnight development. **Batch A remains PARTIAL pending approved owner Playwright verification. Batch B is PARTIAL; C–F have additional validated code paths but their new persistence backends remain BLOCKED. No migration was applied.**

## Current state

All six formerly missing destinations now exist, have owner authorization, and returned 200 in the existing Safari owner session and server logs. There are **17 page-file route patterns** and 22 admin API patterns. The old “11” inventory counted the project-create destination even though it did not have its own page file.

| Section | Status | Implemented / remaining |
|---|---|---|
| Overview / shared shell | PARTIAL | Real counts/recent posts, sidebar/mobile navigation, breadcrumbs, loading/error states; owner three-width automation pending |
| Posts | PARTIAL | Rich formatting, source-safe saves, attached-image insertion, inert video embeds, global search and dirty-navigation checks added; live synthetic heading save/refresh/delete passed. Text-only duplicate verified on synthetic source/copy, including matching content hashes and cleanup. Taxonomy/SEO/featured editing/history and full publishing regression remain |
| `/admin/media` | PARTIAL | Real owner/RLS post attachments; global search over caption/media title/post title; type filter, bounded pagination, grid/list, protected image preview and attachment links. Upload/metadata/assignment/insertion/site+project coverage pending |
| `/admin/home` | PARTIAL | Effective shared hero/nav configuration, public preview, live appearance-read attempt and refresh. Writes unavailable |
| `/admin/appearance` | PARTIAL | Canonical CSS declarations, token search and real light/dark sample preview. Stored settings currently unreadable; persistent editing/publish/default restore unavailable |
| `/admin/navigation` | PARTIAL | Effective labels/order/links from the same source used by the public renderer. Editing/persistence unavailable |
| `/admin/settings` | PARTIAL | Effective shared site metadata and own display name, account-settings link. Global branding/social/SEO persistence unavailable |
| `/admin/bugs` | BLOCKED | Real backend catalog check confirms no application report table. Honest unavailable inbox with working reload; no fake “0 reports” |
| Projects | BLOCKED | Legacy APIs still 503. `/admin/projects/new` is now an explicit route reporting unavailable, no longer existing ID `new` |
| Users / roles / bans | BLOCKED | Legacy management API unavailable; errors do not display an empty list or misleading sign-in instruction |
| Private Access | BLOCKED | Correct owner guard plus server readiness check; both required SQL functions absent. Prepared migration/preflight only; no grants changed |
| Terminal registry | BLOCKED | Legacy API unavailable; no empty result/count claims after failure. Public terminal still uses the safe compiled allowlist |

No navigation destination was hidden. The repaired pages provide catalog, review, preview, or backend-readiness tools; they are not represented as complete editing workflows. No decoration-only or fake-save forms were added.

## Changes in this continuation

- Added all six owner-only routes, shared management UI, fixed-source theme reader, owner media catalog, and backend-readiness queries.
- Extracted only nonsecret public metadata/navigation/hero configuration into `src/lib/site/public-config.ts`; public renderers and admin review use that same source. Public content values were preserved.
- Added the six sections to the sidebar and updated overview links; explicit project-create route and Create breadcrumb.
- Repaired terminal error counts, remaining misleading user-message handling, and list alert semantics. Projects/users/private-access/terminal do not combine errors with empty results. Removed expected-failure console logging from terminal loader and resolved its seven previous lint errors.
- Added early Private Access API owner denial before storage initialization. Owner SQL authorization proof remains required; it was not replaced by the UI check.
- Added server Private Access function/EXECUTE readiness check so missing functions do not trigger a failing client fetch. Reload status uses `router.refresh()` with pending state and was verified manually.
- Prepared `scripts/phase8/local-private-audience.prepared.sql` and a pinned read-only preflight. **Not applied.** See `docs/PHASE8_PRIVATE_ACCESS_MIGRATION.md` for scope/preconditions/testing still required.
- Extended Playwright to all 17 inventory destinations and real post-detail reads for owner mode. Supports either a supplied credential artifact or supplied Playwright storage-state file; no discovery/search or extraction of secrets.
- Updated the legacy harness only for a fixed canonical CSS read and actual Next `searchParams`. Updated audience authorization tests to exact 401/403 plus zero business reads/writes; added authorized-but-unconfigured 503 coverage. No security assertion bypasses.

## Earlier Batch A verification results (superseded by overnight results below)

| Check | Result |
|---|---|
| TypeScript | PASS |
| Focused lint across all continuation files and touched terminal client | PASS |
| Phase 8 unit tests | 11/11 PASS |
| Phase 6 nonbrowser tests | 27/27 PASS |
| Security | 194/230 PASS; 36 FAIL (same outstanding legacy failures; one new passing assertion) |
| Integration | 59/68 PASS; 9 FAIL |
| Real Playwright | 4 PASS, 3 owner viewport tests SKIPPED |
| Anonymous routes | All 17 inventory paths denied at 390/768/1440 px; no horizontal overflow on sign-in pages |
| Former synthetic owner | Sign-in works; admin routes redirect; posts and audience APIs deny with 403 |
| Owner Safari | Six repaired routes 200; real two-row media catalog, grid/list and restored image preview work; canonical 91-declaration inspector/light preview works; effective settings/home/nav and unavailable Bugs states verified; project/user/terminal error states verified; Private Access readiness/reload verified |
| Private Access read-only preflight | PASS: exact local identity, six migration hashes, safe roles/RLS/function state, one owner, three private drafts; no apply mode |
| Offline migration validator | PASS, six ordered migrations |
| Preservation | PASS: three original private drafts, same hashes/revisions/states/IDs; two media rows, one owner; audience functions still absent |
| `git diff --check` | PASS |

Logs: `.artifacts/phase8/{browser,security,integration,unit,typecheck,lint,phase6,migrations}-continuation.log`. Existing baseline/previous-session evidence remains there. No credential/session values are logged.

Security/integration failures still include timestamp/Supabase-era CMS assumptions, media DTO expectations, pagination and middleware contracts. They have not been suppressed or reclassified as successes. See `ADMIN_CMS_AUDIT.md`.

## Preserved state / safety

- Work remains on `feat/cinematic-redesign`; extensive prior uncommitted changes preserved. No commits/pushes/deployments/destructive Git commands.
- Verified target: `127.0.0.1:55441/drckgomz_phase5_test`, operator `phase5_local`, PostgreSQL 18. Runtime credentials/roles remain separate and pinned by the existing launcher.
- No original post/media/role writes. The overnight synthetic post test and cleanup are documented below. Authentication denial tests create local sessions through normal Better Auth login. No password resets, owner transfers, historical import/remapping, S3 modifications or remote database activity.
- Original post content hashes remain `40f9b30d119a7b09c22ea039cb2478d7`, `d41d8cd98f00b204e9800998ecf8427e`, `04bf8c3a51760bc3515f47aea87e71ee`; revisions remain 1, 1, 37; all remain draft/private.
- The first Phase 8 session created/edited/deleted one disposable synthetic draft and verified persistence and anonymous denial; cleanup was confirmed. Do not repeat mutation tests on originals.
- **Do not run `tests/phase6/owner-edit.browser.spec.ts`**: it edits a recovered post and assumes the former owner and two posts.
- No dependencies added. No Drizzle migration/journal/manifest changes. Local audience SQL is prepared only, not applied or runtime-certified.

## Owner automation blocker and exact next step

No recovered-owner credential artifact or Playwright storage-state path has been supplied. The saved Phase 6 synthetic account is correctly no longer owner. Safari has a usable owner session for manual review, but it has not been harvested or imported into Playwright. An asynchronous clarification requested only an approved fixture path; no reply yet.

To unblock, supply a private mode-0600 file via one of:

- `PHASE8_OWNER_CREDENTIALS`: approved JSON artifact containing the recovered owner's email/password.
- `PHASE8_OWNER_STORAGE_STATE`: approved local Playwright storage-state file containing a currently valid owner session.

Do not paste credential values into chat/commands/logs or search browser/database sessions for tokens. Do not create an auth bypass or modify owner roles to make tests pass.

Start `pnpm dev`, set only the approved artifact path in the test environment, then run:

```sh
./node_modules/.bin/playwright test --config=playwright.phase8.config.ts
```

The owner matrix reads original posts without saving them and exercises routes, overflow, breadcrumbs/mobile Escape/focus, theme/media controls and explicit backend errors. Resolve any failures and document exact viewport results before declaring Batch A verified. The candidate audience SQL should remain unapplied until the review and synthetic authorization/concurrency/audit testing plan in `PHASE8_PRIVATE_ACCESS_MIGRATION.md` can be executed safely.

## Earlier Batch B continuation plan (overnight work below supersedes completed items)

Preserve raw historical HTML separately from rendered/protected preview content before widening saves: current admin DTO prepares placeholders for preview, which must never be silently written back over originals. Then complete rich formatting/paste handling, validated slug/excerpt/SEO fields, media insertion through a safe local adapter, duplicate/taxonomy/revision/audit workflows, global search, dirty-navigation protection, and explicit publish/audience controls. Use uniquely named synthetic records only.

C–G remain: media editing/storage reconciliation; transactional projects; users/roles/full audience policy; persisted single-source theme/navigation/site settings; complete browser/security regression. No production or AWS changes are authorized.

## Continuation file inventory

New routes: `src/app/admin/{home,bugs,media,appearance,navigation,settings}/page.tsx`, `src/app/admin/projects/new/page.tsx`.

New supporting files: `src/lib/site/public-config.ts`, `src/lib/admin/{management,media-catalog}.ts`, `src/components/admin/management/{ManagementPage,MediaCatalog,ThemeInspector,ReloadStatus}.tsx`, `scripts/phase8/{local-private-audience.prepared.sql,preflight-private-audience.mjs}`, `tests/phase8/management.test.cjs`, `docs/PHASE8_PRIVATE_ACCESS_MIGRATION.md`.

Updated existing files: admin shell/overview/private-access page; projects/users/terminal list clients; private-audience API route; public root metadata, home navigation and hero renderers; security harness/authorization tests; Phase 8 access browser spec; audit/progress documents. Pre-existing edits elsewhere remain preserved.

Verification teardown: the Next.js process started by this continuation was stopped after the final Playwright run. PostgreSQL remains running. Restart the local website with `pnpm dev`.

## Overnight Stage 1 / Stage 2 checkpoint (2026-11-13)

The overnight instruction explicitly permits moving to independent batches while owner automation remains blocked. Stage 2 / Batch B is now PARTIAL, not complete. No owner fixture was searched for or extracted; the existing owner tests remain conditional.

Implemented: unrendered editor source separated from rendered preview DTOs; recovered (`legacy_status` set) content is read-only in the UI and content updates are rejected by the server's conditional repository write, while title-only saves preserve its bytes. New formatting toolbar supports paragraphs, headings, bold/italic, lists, quote/code blocks, links, undo/redo and validated YouTube embeds. Embeds remain inert while editing and serialize to canonical privacy-enhanced URLs. Added attached-image insertion, server-side post search across title/slug/excerpt, and dirty-anchor/cancel navigation protection. List DTOs no longer include/select full HTML bodies.

Isolated real-component Playwright: 5/5 passed (390/768/1440 formatting/embeds/overflow, source-vs-preview title-only save, dirty navigation cancellation and legacy read-only checks). These are explicitly synthetic component fixtures, not real owner/database persistence tests. Screenshots: `.artifacts/phase8/overnight/editor-{390,768,1440}.png`. No DB content writes or migrations applied.

Read-only privilege inspection confirms media INSERT/caption UPDATE, post thumbnail UPDATE, and project SELECT are absent for the local owner runtime. These paths must remain blocked until separately authorized migrations are applied. Continue with validated code paths, mock integration and prepared migration candidates rather than widening grants.

## Overnight Stages 3–6 checkpoint

Stage 3 / Media: added a strict revision-aware caption/alt/title service, bounded JSON reader, owner-only metadata API and gated editor. Live editing is BLOCKED because `phase8_media_metadata` and its columns/policies are not installed. `local-media-metadata.prepared.sql` is prepared only; no historical URL/key mapping changes. Mock integration covers persistence, refresh, stale revisions, denial/CSRF, forbidden storage-key/privilege changes and body limits.

Stages 4–6: added strict project/user/configuration schemas, owner resource service/gateway, revision-aware project/user/configuration forms, read-side readiness gates and prepared `local-cms-resources.prepared.sql`. Project contract covers content, publishing, technologies, gallery ordering/featured association of already-bound media, links and protected deletion. User contract supports only baseline/content_admin/whitelist_manager, blocks owner/self changes in SQL, and does not expose owner assignment. Configuration supports draft/publication, strict public destinations, SEO/profile/social/home content, contrast-validated theme palettes and canonical CSS fallbacks. Public readers revalidate published configuration before using it; metadata/home/nav/about/theme have code paths for the future published values. These mutation backends are CODE-ONLY/BLOCKED until migrations are explicitly authorized, applied, and verified. No real user roles, settings, projects or media have been mutated.

The generic backend SQL is a candidate, not runtime-certified. It must receive exact-hash/current-schema privilege review, synthetic RLS/concurrency/audit tests and schema synchronization before application. New ORM columns are intentionally not added to the live Drizzle models while the local database lacks them, avoiding column-not-found regressions. No migration was applied and none should be applied autonomously.

Overnight live persistence verification: existing Safari owner session created `phase8-overnight-20261113-a` (ID `97ebb78f-3e3a-41da-b700-d7e5c0e2b765`), added synthetic heading-formatted content, saved successfully (PATCH 200, revision 2), and refreshed with the `<h2>` content intact. The exact ID/slug/title were verified read-only before deleting via the owner UI. Cleanup query confirmed zero rows for this ID/slug and all three original private/draft fingerprints and revisions unchanged. No owner session was extracted or copied. This complements the component tests but does not replace owner Playwright automation.


## Overnight final verification and continuation point

| Check | Result / evidence in `.artifacts/phase8/overnight/` |
|---|---|
| TypeScript | PASS (`types.log`) |
| Focused lint of overnight-touched implementation/tests | PASS (`lint-touched.log`) |
| Broader directory lint | FAIL: existing `usePostEditor.ts` set-state-in-effect and two `AboutSection.tsx` explicit-any errors (`lint-final.log`); not suppressed |
| Phase 8 service/unit tests | 26/26 PASS (`unit.log`), including mock media metadata/project/configuration persistence, revision and authorization checks |
| Phase 6 nonbrowser | 27/27 PASS (`phase6.log`) |
| Security | 194/230 PASS, 36 FAIL (`security.log`); unresolved legacy contracts/harness assumptions remain |
| Integration | 59/68 PASS, 9 FAIL (`integration.log`); unresolved legacy contracts remain |
| Offline migration validation | PASS for unchanged six ordered migrations (`migrations.log`) |
| Real-app Playwright | 4 PASS, 3 owner tests SKIPPED (`app-browser-corrected.log`); anonymous matrix at 390/768/1440 and former-owner denial |
| Real-component Playwright | 9/9 PASS (`editor-browser.log`); formatting, embeds, raw-source save contract, legacy read-only protection, dirty navigation, mock project/configuration save/refresh and protected-owner controls |
| Live synthetic persistence | PASS via existing Safari owner UI; private draft H2 save/refresh and exact-ID cleanup, documented above |
| Owner Playwright | BLOCKED: no approved fixture supplied; no session extraction attempted |

The first overnight app-browser run accidentally included the component suite after it was added to the same test directory. The real-app config now explicitly selects `access.browser.spec.ts`; the corrected run is the relevant result. The failed configuration run remains in `app-browser.log` for transparency. The fixture has its own port/config and cannot authenticate to or mutate the application database.

Six screenshots captured: `editor-{390,768,1440}.png` and `configuration-{390,768,1440}.png`. These show synthetic real-component fixtures, not owner route certification. Mobile images were visually reviewed; an initially blank embedded-video frame was replaced by an accessible visible inert placeholder, then all nine tests were rerun successfully.

Additional overnight files: `src/lib/cms/{contracts,request,resource-service,media-metadata,editor-policy,editor-dom}.ts`; `src/lib/db/repositories/{cms-resources,media-metadata}.ts`; `src/lib/admin/resource-editor.tsx`; `src/lib/site/configuration.server.ts`; `src/components/admin/management/{ResourceEditor,ResourceList,MediaMetadataEditor}.tsx` and its loader; `src/components/home/PublicThemeBridge.tsx`; API routes `cms/[section]`, `media/[mediaId]/metadata`, `posts/[slug]/duplicate`; the two new prepared SQL candidates; `docs/PHASE8_CMS_MIGRATION_CANDIDATES.md`; Phase 8 resource/media tests, browser fixture/spec/server/config. Updated editor/form/list/repository/types, gated management pages, public metadata/nav/hero/about renderers, shared test harness and access tests. This inventory describes overnight work; the wider dirty tree predates it and remains preserved.

Exact next safe step: add focused repository tests for recovered-content write rejection, then complete post slug/excerpt/SEO/taxonomy/featured-image/revision/audit contracts. Synthetic live publication/archive/restore workflows are now verified below. Duplicate API boundary tests and the live synthetic duplicate test are complete. Complete post slug/excerpt/SEO/taxonomy/featured-image/revision/audit contracts without enabling unavailable grants. Keep all three SQL candidates unapplied. Owner automation may be run only when an approved fixture is supplied; proceed with other independent work rather than waiting for credentials. Bugs and Terminal management remain unavailable and have no newly implemented persistence backend.


Final additional checks: public-page stability browser suite **2/2 PASS** (`public-stability.log`), including home/blog observation windows and explicit-retry-only simulated failures. Duplicate API tests add four passes for owner denial, CSRF/revision/body bounds, no-store success and honest conflict/error handling; total Phase 8 tests now **26/26**. Duplicate test lint and final `git diff --check` passed.

Live duplicate test used source `cb66ea0d-4fee-449e-b797-2fc07565a3b1` (`phase8-overnight-20261113-duplicate-b`) and copy `f4bebdac-e496-4639-8f83-7dbc8f7ea6fb` (`phase8-overnight-20261113-duplicate-b-copy-f4bebdac`). Both were draft/private, source revision 2 and copy revision 1, with identical stored content hash `2f8e8641f516125f9e720c3c439cc0b0`. Copy opened in the editor. Each identifier/slug/title was verified before owner-UI cleanup. Final read-only query confirmed zero of these IDs remain, exactly the original three draft/private rows with unchanged hashes/revisions, two media rows and one owner. This test did not publish any content.


Live publication lifecycle also passed using only `5b10a409-1163-4927-bf34-07672c716b70` / `phase8-overnight-20261113-status-c` (title `Phase 8 disposable publication check C`). Owner UI: private draft → public publication (anonymous public API returned this synthetic slug, one item) → private publication (anonymous API returned zero items) → draft → archived → restored draft/private at revision 6. Exact ID/slug/title/state were read before owner-UI deletion. Final query confirmed this ID absent and the original three hashes/revisions/private-draft states, two media rows and single owner unchanged. No historical publication occurred. These manual live tests complement, but do not replace, the three skipped owner Playwright viewport tests.

Overnight verification teardown: stopped this session’s local Next.js launcher after regression tests; PostgreSQL remains running. Restart with `pnpm dev`. No database migration was applied.

## Limited-allowance completion sprint (2026-11-13)

- Blog: implemented bounded PATCH bodies, validated excerpt/display-date updates with optimistic revisions, privilege readiness gating, metadata dirty/save handling, revision display, and insertion controls for all supported existing attachments. Title/content paths remain active. Excerpt/date controls remain disabled until the new narrow grant is approved/applied. Recovered content still has the conditional repository write protection; no original draft was mutated. Slugs, post featured images, taxonomy, SEO overrides and persisted revision history remain unfinished.
- Users: added safe search/access filters over the current authorized page, visible email/role/block/disabled state, and retained multiple-role/owner protections. Backend remains migration-blocked; no real accounts changed.
- Projects: added ordering and featured-image selection for existing gallery associations, using the existing revision-aware contract. Backend remains migration-blocked. New media association/upload remains unavailable.
- Media/settings: existing implementation retained; persistence still needs the earlier candidates. No migration/database mutation/commit/push/deployment performed.

Verification this sprint: **63/63** Phase 6 + Phase 8 tests; **11/11** synthetic real-component browser tests (including metadata conflict/dirty preservation and project gallery save/refresh); TypeScript and focused ESLint PASS; six ordered migration artifacts validate offline; diff whitespace check PASS. Browser fixture initially could not bind under sandbox (EPERM); authorized rerun passed. No live-owner persistence claim; owner Playwright fixture remains unavailable. Legacy security/integration suites were not rerun or altered.

Changed implementation: `src/app/api/admin/posts/[slug]/route.ts`, `src/app/admin/posts/[slug]/page.tsx`, `src/lib/db/repositories/admin-posts.ts`, `src/components/admin/posts/EditPostForm.tsx`, `src/components/admin/management/{ResourceEditor,ResourceList,UserAccessList}.tsx`. Tests: `tests/phase8/{post-edit.test.cjs,post-repository.test.cjs,resources.test.cjs,editor.browser.spec.ts,fixtures/editor.tsx}`. SQL: `scripts/phase8/local-post-metadata.prepared.sql`. Documentation: this file and `PHASE8_CMS_MIGRATION_CANDIDATES.md`.

Exact blocker: unapplied database privileges/functions prevent persistent activation, and no approved owner automation fixture is available. Smallest safe next action: review the new two-column grant and approve disposable rehearsal/application scope. The single approval checkpoint for all four prepared candidates, with preservation/verification/rollback requirements, is in `PHASE8_CMS_MIGRATION_CANDIDATES.md`. None is runtime-certified by mocked tests.

## Phase 9 — approved local blog metadata activation (2026-11-13)

Applied only `scripts/phase8/local-post-metadata.prepared.sql` with `psql -X -v ON_ERROR_STOP=1`; its explicit transaction completed `BEGIN / SET / SET / DO / GRANT / COMMIT`. SHA-256: `ab58ffe081cc41335b791a368967a9a87597213d11add1dd6d397b66e07e37ec`.

Fresh server identity: `127.0.0.1:55441/drckgomz_phase5_test`, current/session role `phase5_local`, PostgreSQL **18.6 (Homebrew)**. Six ledger hashes matched the validated manifest. Verified forced RLS/table ownership, owner UPDATE policy/session helper, safe runtime role and memberships, singleton-owner index, and exactly one verified/enabled/unbanned owner. No table-level UPDATE grant was introduced.

Only new privileges: `UPDATE(excerpt,date)` on `app.posts` for `drckgomz_local_owner`. Catalog comparison confirms all other captured relation/column/schema/function privileges, policies, function definitions/ownership, runtime-role attributes/memberships and migration ledger unchanged. Full-row fingerprints of the original three private drafts (including metadata/content/revisions), owner identity/profile/assignment, and both complete historical media rows/associations match before application, after application and after cleanup. Draft revisions remain **1, 1, 37**; all remain draft/private.

Live functional verification used the existing Safari owner session without extracting credentials or tokens. Created only disposable `1760d39f-507e-4d02-a41b-db6ccbad7ff7` / `phase9-disposable-metadata-20261113`, title `Phase 9 disposable metadata activation check 20261113`. Excerpt save and display-date save returned **200**, reaching revision **3**; reload and PostgreSQL readback confirmed the exact summary and `2026-11-12`, still draft/private. Second-tab revision-1 save returned **409** without overwriting saved values. Unauthenticated PATCH returned **401**, with readback unchanged. Exact ID/slug/title/state were verified before owner-UI DELETE (**200**). Final comparison confirms only the original three posts remain, so the disposable ID is absent.

Focused tests **9/9 PASS**; TypeScript **PASS**; relevant ESLint **PASS**; diff whitespace check **PASS**. Verification harness corrections handled PostgreSQL name-array decoding, merged ACL entries and canonical date text; no security assertion was removed and no SQL application failed. No rollback was needed. Local evidence: `.artifacts/phase9/{before,after,synthetic,verification-summary}.json` plus read-only verifier scripts. Existing owner Playwright fixture remains unavailable; this is manual live-owner verification, not automated owner certification.

Remaining blockers: media/audience candidates need live security/concurrency rehearsal; CMS resources candidate needs database validation and actor/owner concurrency corrections before approval. Post taxonomy, featured-image editing, SEO overrides, slug edits and persisted revision history remain unfinished. No other migration, real account mutation, historical edit, owner transfer, import/remapping, ledger entry, commit/push/deployment or AWS operation was performed. Local Next.js launcher was stopped after verification; PostgreSQL remains running.

## Git checkpoint and Mark-2 handoff (2026-11-13)

Checkpoint preserves source, synthetic tests, schema-only Drizzle snapshots/migration manifests, prepared SQL, configuration and documentation. Local database files/backups, `.env*` secrets, `.artifacts/` (including all Phase 9 fingerprints/identities), browser state, build output and Python caches are excluded and remain on this computer.

Verified Phase 9 state: only `local-post-metadata.prepared.sql` applied to `127.0.0.1:55441/drckgomz_phase5_test`; only `UPDATE(excerpt,date)` added on `app.posts` for the local owner runtime. Synthetic owner saves/reload/readback passed, stale revision returned 409, unauthenticated PATCH returned 401, and exact-ID cleanup passed. Original drafts, owner identity/assignment and historical media associations were preserved. The other three Phase 8 candidates remain unapplied; CMS validation/concurrency and media/audience security rehearsal blockers remain as documented above.

See `docs/MARK2_HANDOFF.md` for clone/update commands, local prerequisites, database-state limitations and focused checks. A Git clone does not transfer the running local database, owner session, ignored authentication material or media files. Do not infer migration state on Mark-2 from this machine's successful application.

Checkpoint validation: `pnpm exec tsc --noEmit`, focused CMS/terminal ESLint, 63/63 Phase 6/8 nonbrowser tests, offline six-migration validation and `git diff --check` PASS. Additional terminal integration tests 2/2 PASS. Existing standalone `tests/integration/cinematic-media.test.ts` fails to load because Node/tsx cannot resolve the `server-only` import through `configuration.server.ts`; no source/test assertion was changed for this checkpoint. Historical broad security/integration failures remain separately documented and were not rerun. Security review covered all 449 candidate files, including terminal/styles/tests; pattern matches were synthetic test credentials/offline placeholders, not live secrets. Six generated Python cache files were newly ignored, without deletion.
