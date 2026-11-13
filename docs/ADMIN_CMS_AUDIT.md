# Phase 8 administration CMS audit

Audit started 2026-11-12; continuation verified 2026-11-13. **Batch A remains partial pending owner viewport automation. The six previously missing destinations now resolve; editing backends remain incomplete.** Branch: `feat/cinematic-redesign`.

## Evidence and limits

This is an implementation audit, not certification that the CMS is complete. WORKING means the named narrow behavior was observed; PARTIAL means only part exists; MISSING means no implementation; BROKEN means an implemented behavior is incorrect; BLOCKED means required backend or verification access is unavailable. A rendered form is never evidence of persistence.

Read `AGENTS.md`, installed Next 16.4.5 layout/error guides, `LOCAL_BUILD_HANDOFF.md`, `CMS_HARDENING.md`, `NEXT_PHASE_PLAN.md`, `THEME_SYSTEM.md`, and media/privacy documentation. Older documents describe superseded Clerk/Supabase behavior; current source and local responses take precedence. Legacy UI/API source is retained in this checkout and was compared directly; no external legacy repository was imported.

Local PostgreSQL identity was read and confirmed: `127.0.0.1:55441`, database `drckgomz_phase5_test`, operator `phase5_local`. Runtime roles remain separate. Exactly three existing posts are private drafts. Content hashes, revisions and IDs were captured before work. No original-content, role, migration, historical mapping or AWS writes have been performed by this phase. One explicitly disposable synthetic draft was created, edited, previewed, refreshed, anonymously denied, and deleted through the owner UI. Better Auth login tests necessarily create local sessions.

The old `.artifacts/phase6/local-owner.json` account successfully signs in but has no owner role after recovery. `/admin` redirects it to `/blog`; owner post APIs return 403. One owner remains in `app.user_roles`. An existing Safari owner session successfully loads the dashboard and three-post list, including restored image thumbnails. Recovered-owner Playwright automation is BLOCKED until its credential artifact path is provided. No owner transfer, password reset or session impersonation was used.

## All page routes

There are now **17 page-file route patterns**, including the six repaired destinations and the explicit project-create route. The earlier “11” count included the project-create navigation destination even though it had no dedicated page file. Layout and each existing page have server guards. Owner-specific post repositories additionally establish a transaction-local verified session proof consumed by PostgreSQL RLS. HTTP below distinguishes observed results from source predictions: an authentication redirect is not a page 200 verification.

| Route | Exists | HTTP / owner evidence | Data and functional result | Status |
|---|---|---|---|---|
| `/admin` | Yes | Safari owner renders; nonowner redirects | Real Drizzle post counts/recent-post overview; Home and Bugs now lead to implemented review/status pages | PARTIAL |
| `/admin/posts` | Yes | Safari owner renders; anonymous denied | Real Drizzle list of 3 private drafts, restored thumbnail visible. Server-side title/slug/excerpt search, status filters, pagination, edit/status/delete controls exist. Mutations not rerun on historical rows | PARTIAL |
| `/admin/posts/new` | Yes | Safari owner form renders; automated owner verification pending | Real draft INSERT route with slug validation, same-origin checks, private/draft defaults. Synthetic creation and title/content persistence verified manually in Safari; original rows untouched | PARTIAL |
| `/admin/posts/[slug]` | Yes | Safari owner editor renders; missing owner slug calls notFound | Real Drizzle editor. Only title/content save; slug, excerpt, status and featured-image fields disabled in editor | PARTIAL |
| `/admin/projects` | Yes | Safari owner renders | API rejects with 503; misleading empty state on API failure was corrected. Legacy search/buttons cannot manage real records | BLOCKED |
| `/admin/projects/[id]` | Yes | Owner-guarded server readiness page | New revision-aware form/repository code is gated by missing SQL functions; legacy APIs remain unavailable | BLOCKED |
| `/admin/projects/new` | Yes | Safari owner 200 | Explicit create route, honest unavailable state; no fake form or accidental existing-project ID | BLOCKED |
| `/admin/users` | Yes | Safari owner renders, API unavailable | Legacy Supabase-shaped list/role/ban controls; local API returns 503, not real user management | BLOCKED |
| `/admin/private-access` | Yes | Safari owner page now renders after viewer repair | Required `list_private_audience_users` and `set_private_journal_access` functions are absent locally (catalog query: zero rows). List unavailable; no grants changed | BLOCKED |
| `/admin/terminal/commands` | Yes | Safari owner renders | Legacy registry GET/POST gated off; public terminal intentionally uses compiled safe allowlist, not database registry | BLOCKED |
| `/admin/terminal/commands/[id]` | Yes | Guarded client editor; no server record check | Legacy edit/delete gated off; cannot change public compiled command interpreter | BLOCKED |
| `/admin/home` | Yes | Owner Safari and server 200; anonymous denied | Effective shared hero/navigation configuration, public preview link, live stored-appearance read attempt and working refresh; writes unavailable | PARTIAL |
| `/admin/bugs` | Yes | Owner Safari and server 200; anonymous denied | Owner-session catalog check confirms no `app.bug_reports` table; explicitly unavailable, not an empty inbox; working refresh | BLOCKED |
| `/admin/media` | Yes | Owner Safari and server 200; anonymous denied | Real owner/RLS post attachments, server search/type filters, bounded pagination, grid/list and protected image previews; editing/upload/assignment pending | PARTIAL |
| `/admin/appearance` | Yes | Owner Safari and server 200; anonymous denied | Reads canonical CSS declarations; real light/dark sample and token search; stored settings access denied and persistence explicitly unavailable | PARTIAL |
| `/admin/navigation` | Yes | Owner Safari and server 200; anonymous denied | Effective label/order/destination review shares the public renderer source; usable destination links; persistence/editing unavailable | PARTIAL |
| `/admin/settings` | Yes | Owner Safari and server 200; anonymous denied | Effective shared site metadata and authenticated own display name; link to working account profile settings; global writes unavailable | PARTIAL |

All six formerly missing destinations are implemented and included in the sidebar. No route is declared a working editing workflow merely because it returns 200. Review/catalog/status tools are functional; unavailable storage/write backends are explicit. Owner Playwright layout/console/overflow verification is still blocked, so Batch A is not declared complete.

## API inventory and authorization

All 22 current route patterns were inventoried; the three overnight additions are listed below. `requireAdminApi()` without an explicit supported local operation returns 503 before legacy provider queries while CMS mutations are disabled. This prevents remote Supabase/AWS fallback but does not constitute working management. Only post read/update local gates currently pass owner authentication. The private-audience API uses its own authenticated function-backed boundary.

| API under `/api/admin` | Methods | Current boundary / result |
|---|---|---|
| `/posts` | GET, POST | Local owner + RLS; integer pagination/status validation; create private draft; same-origin mutation |
| `/posts/[slug]` | GET, PATCH, DELETE | Local owner + RLS; integer revision, same-origin writes; only title/content or separate status update; linked-media deletion rejected |
| `/posts/[slug]/media` | GET | Local owner read, protected attachment DTO |
| `/posts/[slug]/media/link` | POST | 503 legacy gate |
| `/posts/[slug]/media/reorder` | PATCH | 503 legacy gate |
| `/posts/[slug]/media/upload` | POST | 503 legacy gate; unreachable S3/Supabase implementation must not be enabled blindly |
| `/media/[mediaId]` | PATCH, DELETE | 503 legacy gate |
| `/private-audience` | GET, PATCH | Early authenticated owner check now denies before missing-function access; SQL proof remains required for owner operations; functions still absent |
| `/profile` | GET | Legacy gate; not site settings |
| `/projects` | GET | 503 legacy gate; no create method |
| `/projects/[id]` | GET, PATCH, DELETE | 503 legacy gate |
| `/projects/[id]/media` | GET, POST | 503 legacy gate |
| `/projects/[id]/media/[mediaId]` | PATCH, DELETE | 503 legacy gate |
| `/terminal/commands` | GET, POST | 503 legacy gate |
| `/terminal/commands/[id]` | GET, PATCH, DELETE | 503 legacy gate |
| `/uploads/presign` | POST | 503 legacy gate; no AWS changes authorized |
| `/users` | GET | 503 legacy gate |
| `/users/me` | GET | 503 legacy gate |
| `/users/[id]` | PATCH | 503 legacy gate; legacy role validation cannot replace new role-safe repository |

## Feature matrix and legacy comparison

| Feature | Status | Finding / required completion |
|---|---|---|
| Owner account and single-owner invariant | WORKING | Existing Safari owner session works; exactly one owner role. Old synthetic test identity is correctly denied |
| Local email/password authentication | WORKING | Fixed OAuth-empty-variable validation mismatch; actual local sign-in and session/profile calls succeed |
| Responsive admin shell | PARTIAL | Added shared sidebar, mobile disclosure, breadcrumb, active indicator, skip link, loading/error boundaries; actual owner 3-width automation pending |
| Dashboard overview | PARTIAL | Real bounded post overview added; all six destinations resolve; owner viewport matrix pending |
| Post listing/filter/search | PARTIAL | Real list with server-side title/slug/excerpt search, status filtering and pagination; full owner automated matrix pending |
| Create/title/content draft saves | PARTIAL | Existing private draft/revision-safe endpoints; synthetic create/edit/refresh verified in Safari |
| Publish/unpublish/archive/restore/delete | PARTIAL | Existing revision-protected status endpoints and confirmations. Synthetic publish/public anonymous visibility, private removal from anonymous listing, draft/archive/restore and exact-ID cleanup verified; linked records block deletion |
| Rich text editor | PARTIAL | Sanitized contentEditable toolbar, selection restoration, headings/bold/italic/lists/links/quotes/code, inert validated video placeholders; raw source separated from protected preview. Recovered content read-only with server rejection. Nine component browser tests pass; live synthetic H2 persistence verified |
| Secure preview | PARTIAL | Sanitized unsaved local preview verified on synthetic post; protected historical-image proxy. No expiring shareable preview workflow |
| Slug editing | PARTIAL | Creation validates slug; edit disabled, PATCH rejects unsupported fields |
| Categories/tags | MISSING | Schema tables exist, no admin CRUD/assignment UI or write repository |
| Duplicate posts | PARTIAL | Owner/revision-protected text-only duplicate UI/API/repository implemented. Copies are private drafts without media associations. Live synthetic source/copy hashes, unchanged source revision and exact-ID cleanup verified |
| SEO metadata | MISSING | No post SEO form or persistence contract |
| Revision history | MISSING | Integer optimistic revision exists; no revision snapshot table/history UI |
| Unsaved change protection | PARTIAL | beforeunload plus dirty anchor/cancel confirmation implemented and component-tested; full router/history coverage remains pending |
| Featured image | PARTIAL | Restored list thumbnail selection works; editor featured-image changes disabled and DTO thumbnail null |
| Inline media/video | PARTIAL | Existing attached-image insertion and validated responsive YouTube embed source supported; embeds inert while editing. New media linking/uploads remain gated; no S3 writes |
| Global media library | PARTIAL | Post-attachment catalog/search/filter/pagination/grid/list/preview implemented; metadata writes, global site/project media coverage, assignment and reconciliation pending |
| Historical JPEG mapping | WORKING | Existing owner list shows restored thumbnails; source/mapping preserved. This is not a privacy certification |
| S3 privacy | BLOCKED | Public origin URL remains publicly readable independently of app auth; no bucket/object writes authorized |
| Projects CRUD/gallery/organization | BLOCKED | Create/edit/preview/publication/delete code paths and mock tests exist; readiness-gated resource gateway requires unapplied SQL candidate. Gallery upload/linking remains unsupported |
| Users/roles/ban management | BLOCKED | Strict multi-role/banned/enabled contract, protected owner UI and gated SQL candidate prepared; no live role changes. Backend remains unavailable |
| Private journal capability management | BLOCKED | Owner page guard repaired; local management functions are absent; no grant mutations attempted |
| PUBLIC/PRIVATE visibility | PARTIAL | Existing publication/read policy and status workflows; full owner regression pending |
| MEMBERS/CLOSE_FRIENDS/SELECTED_PEOPLE | BLOCKED | Schema enums/groups/grants exist; do not enable UI until server read policy and assignment tests are complete |
| Theme token source | WORKING | `src/styles/themes.css` is documented canonical token source; many admin components still hardcode colors |
| Theme color/type editing/live preview/defaults | PARTIAL | Canonical token inspector and light/dark preview work; persistent editing/publication/default restoration unavailable |
| Public navigation editing | PARTIAL | Effective configuration review shares one public-renderer source; no editing/persistence workflow |
| Site title/profile/social/branding/SEO/home settings | PARTIAL | Effective metadata/home configuration review and own-profile link work; global settings persistence remains missing |
| Sensitive operation audit coverage | PARTIAL | Existing access/owner functions audit; post CRUD/status repository does not append audit records |

## Test harness investigation

Before Phase 8: security 177/229 passed, integration 53/68 passed. Many cases failed while importing the new owner repository through `next/headers`; no assertion was reached. Added a closed owner-session boundary to the legacy in-memory harness which throws if a test attempts actual owner database access. This prevents request-context/provider/pool initialization; it neither fabricates owner rows nor disables authorization assertions.

After this fix: security 193/229 passed (36 fail), integration 59/68 passed (9 fail). No `Unmocked import: next/headers` remains in either output. Remaining cases include Supabase-era timestamp revision assumptions, disabled/local CMS gate mismatches, media DTO expectations, pagination projection assumptions and middleware same-origin expectations. They need architecture-aware contracts plus real PostgreSQL verification, not expected-status broadening or bypassing the local target guard.

Do not run the old Phase 6 owner-edit browser suite: it deliberately edits a recovered post and assumes two posts and the former synthetic owner. New tests must use disposable synthetic posts and preserve all three original rows.

Evidence logs are ignored under `.artifacts/phase8/`. See `ADMIN_CMS_PROGRESS.md` for current validation and continuation steps.

## Phase 8 browser and preservation results

- Playwright against real Next.js: 4 passed, 3 skipped. Anonymous navigation across all eleven existing route patterns was denied at 390/768/1440 px; rendered sign-in pages had no horizontal overflow. Same-origin anonymous post CRUD denied with 401. Former synthetic owner denied with redirect/403. Three recovered-owner viewport tests are explicitly skipped until `PHASE8_OWNER_CREDENTIALS` is supplied; skips are not successful verification.
- Safari existing owner session: dashboard, real three-post list, create form, draft editor, projects/users/terminal error states, mobile navigation, and private-access page were inspected. Synthetic `phase8-disposable-audit-20261113` was created, title/content saved, refreshed, previewed, and deleted with confirmation. Anonymous article and public detail API both returned 404 while the draft existed. Cleanup query confirmed zero synthetic rows.
- Home and Bugs both showed 404 in the owner session. Direct HTTP probes confirmed 404 for Home, Bugs, Media, Appearance, Navigation and Settings. No missing page was replaced with a fake management UI.
- Final original rows retain their starting content hashes, revisions (1, 1, 37), draft/private states and IDs. Exactly three posts, two media relationships and one owner remain. Historical media URLs/mapping were not changed.
- New auth-config regression tests: 2 passed. Existing Phase 6 nonbrowser tests: 27 passed. TypeScript passed. Six ordered offline migrations validated. Focused ESLint passed for new shell/dashboard/auth/test changes; expanding lint to all touched legacy UI files exposes 7 existing terminal-client errors (six `any` annotations and one set-state-in-effect). Full lint/build and complete owner console/overflow checks are not claimed.

## Continuation verification — 2026-11-13

This section supersedes the initial Phase 8 results above where counts/status differ.

- All six restored routes returned 200 in the existing Safari owner session and server logs. Media catalog showed the two real post-media rows; grid/list controls and the restored image preview worked. Appearance showed 91 canonical declarations and a working light preview. Home/navigation/settings showed effective shared public values; Bugs reported the absent application table. No credentials/session tokens were extracted from Safari.
- Projects, Users and Terminal were inspected in the owner session: backend failures remain visible; no empty-result claims accompany them. Terminal result counts now say unavailable. The explicit project-create route reports unavailable rather than editing ID `new`.
- Playwright: **4 passed, 3 skipped**, now covering all 17 concrete admin inventory paths for anonymous navigation at 390/768/1440 px and former-owner denial. Anonymous/ordinary Private Access API calls deny before trying missing SQL functions. No approved owner artifact/storage-state path was supplied; owner rendering at these three exact widths remains unverified.
- Owner workflow accepts either `PHASE8_OWNER_CREDENTIALS` or `PHASE8_OWNER_STORAGE_STATE` pointing to a securely supplied mode-0600 file. No fixture discovery, password search, token harvesting, auth bypass or role changes were performed. Owner tests include real post-detail reads, theme/media controls and blocked-list error assertions when enabled.
- TypeScript PASS; focused lint PASS including the previously failing terminal client; Phase 8 unit tests **11/11 PASS**; Phase 6 nonbrowser **27/27 PASS**; six offline migration artifacts PASS.
- Security **194/230 PASS, 36 FAIL**; integration **59/68 PASS, 9 FAIL**. The extra security test asserts the authorized-but-unconfigured audience route still fails closed. Anonymous/nonowner audience assertions now require exact 401/403 plus zero business queries/writes, reflecting the new early guard. The harness allows only the fixed canonical CSS source read and now supplies App Router `searchParams`; assertions were not bypassed. Remaining legacy failures persist.
- Prepared additive local SQL and a read-only preflight for Private Access. Preflight verified the exact local identity, six ledger hashes, role/RLS/function prerequisites and original draft counts. **No SQL applied.** See `PHASE8_PRIVATE_ACCESS_MIGRATION.md`; candidate runtime/concurrency/audit tests are still required.
- No post/media/role writes in this continuation. Final original content hashes, revisions (1,1,37), private/draft states and IDs match. Three posts, two media rows, one owner, zero installed audience functions remain. AWS and historical mapping untouched.

Batch B has not started because Batch A's owner viewport verification has not passed. Missing capabilities are listed within real routes rather than hidden behind absent navigation.

Private Access continuation refinement: the owner page now checks both function signatures and EXECUTE privileges on the server before mounting the list client. Missing functions produce an explicit unavailable state with a verified working reload action, not a failing client fetch or an empty-account claim. The SQL candidate remains unapplied.


## Overnight implementation delta — 2026-11-13

The page inventory remains 17 patterns; all six formerly missing routes retain working owner/readiness views. Three APIs were added: `POST /api/admin/posts/[slug]/duplicate` (existing local owner/RLS text-only draft copy, synthetic live test passed), `GET/PATCH /api/admin/media/[mediaId]/metadata`, and `GET/PUT /api/admin/cms/[section]`. The latter two return honest unavailable states while their functions are absent; server owner checks precede data access. They are not replacement claims for the gated legacy endpoints.

Media title/caption/alt editing, project CRUD/publishing, supported multi-role access management, theme palettes/typography, navigation ordering, homepage and SEO/profile/social settings now have validated code paths and mock persistence tests. Public consumers revalidate only published configuration with canonical fallback. Live editing remains BLOCKED until explicitly authorized migrations are reviewed, applied and tested. Canonical CSS remains the authoritative theme defaults. Settings never expose environment credentials. Prepared SQL is **not runtime-certified**; see `PHASE8_CMS_MIGRATION_CANDIDATES.md` for required privilege, validation, locking, audit and rehearsal review.

Post source content is no longer taken from protected rendered preview for saves. List queries omit full HTML bodies. Recovered content writes are rejected instead of silently transformed. Synthetic owner UI creation, heading-format save, refresh and exact-ID deletion passed; the original three private drafts retained their fingerprints/revisions. Text-only duplication also passed a live synthetic test: copy/source content hashes matched, both remained private drafts and the source revision was unchanged; both exact IDs were then deleted and absence confirmed. Post SEO, taxonomy, editable slug, featured assignment and revision history remain incomplete. Post sensitive-operation audit coverage remains incomplete.

Current regression: TypeScript and focused touched-file lint PASS; Phase 8 units 26/26; Phase 6 nonbrowser 27/27; security 194/230 (36 failures); integration 59/68 (9 failures); real-app Playwright 4 PASS/3 owner SKIP; isolated component Playwright 9/9 PASS at 390/768/1440. A broader lint pass also records three existing errors in legacy `usePostEditor.ts`/`AboutSection.tsx`. No assertions were weakened to change counts. Six synthetic-component screenshots are under `.artifacts/phase8/overnight/`; they do not establish owner-route viewport verification. Owner automation remains blocked by the absent approved fixture, so Batch A is still PARTIAL. No migration, AWS, original-content, mapping, owner-role or remote database writes occurred.


Additional live synthetic lifecycle verification passed: publish/public API visibility, make-private/public listing exclusion, move-to-draft, archive and restore-to-private-draft. The exact synthetic ID was removed afterward; final original fingerprints/revisions remained unchanged. Public-page stability suite also passed 2/2. These are live local/manual and anonymous HTTP observations, not owner Playwright fixture certification.
