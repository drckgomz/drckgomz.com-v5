# Phase 3B independent review and remediation

Branch: feat/cinematic-redesign. Review includes the existing Phase 2C/3 working tree, not just committed HEAD. No commits, provider changes, production database access, migrations, deployments, tracking or cinematic homepage implementation.

## Reproduced baseline

157 security/CMS tests passed; TypeScript passed; full lint reproduced 159 errors and 12 warnings. Whitespace check passed. The reported 45 browser passes could **not** be reproduced: fixture web server failed with `listen EPERM: operation not permitted 127.0.0.1:4173`. No elevation or alternate transport was attempted. Existing 41 screenshots are historical Phase 3 artifacts, not verification of Phase 3B code.

## Severity-ordered review

No P0 was established by this local review. P0 absence is not a production assurance.

| Priority | Finding / evidence | Disposition |
| --- | --- | --- |
| P1 | MediaCarousel.tsx used arbitrary item.url as iframe fallback when YouTube parsing failed; separate renderer lacked the inline iframe restriction, and its effect loaded Instagram even without consent or Instagram media | Replaced alternate embed construction with BlogContent; normalizeGalleryMedia validates supported types, exact embed hosts and schemes; no arbitrary fallback. Added pure policy/renderer regression. Runtime carousel/consent browser tests are prepared but blocked. |
| P1 | PATCH posts/[slug] accepted missing revision tokens, while usePosts status changes and thumbnail selection omitted them. Stale editors could overwrite later changes; thumbnail selection separately changed revision while editor retained old state | PATCH now requires explicit revision (428 otherwise), compares nullable token, advances timestamp past previous value and returns 409 on stale write. List actions send the selected row revision. Thumbnail selection is local until explicit Save. Tests demonstrate stale republish after unpublish is denied and the reader no longer receives the draft. |
| P2 | usePosts could send a Clerk bearer token to NEXT_PUBLIC_API_BASE, unlike same-origin editor routes | Removed external backend/token plumbing; management uses same-origin cookies and server guards. No new client-side authority or authentication bypass. |
| P2 | Admin post/media routes decoded already-decoded Next params, corrupting literal percent slugs or throwing | Removed second decode throughout these handlers; exact literal slug regression added. |
| P2 | Invalid dates such as February 30 passed Date.parse normalization | Date-only values now require calendar roundtrip equality; invalid-day tests added. Timestamp semantics/timezone remain a schema decision. |
| P2 | Admin catalog fetched all posts and had stale-request/UI error risks; media reorder timers survived unmount | Bounded limit+1 queries with deterministic order, page controls, explicit page-local search, abortable reads, pending controls and announced errors; timers cleaned up. Query/DTO tests use 1,200 rows. |
| P2 | Carousel auto-advanced without a pause control; terminal viewport explicitly disabled user zoom | Gallery auto-advance removed; reduced-motion CSS added; terminal viewport restriction removed. Terminal fixed-layout reflow/real-device usability is still unverified. |
| P2 residual | Post deletion performs child deletion then parent deletion without a transaction | Child-delete errors now stop parent deletion, but partial failure and races remain. No guessed RPC/schema change; atomic deletion/reordering requires verified database work. |
| P2 residual | BlogContent renders its HTML island after hydration; client preview policy and server stored-content policy have distinct implementations | Browser APIs no longer execute during SSR, and server DTO sanitization remains; no-JS article readability/SEO and exact policy parity remain follow-up work. In-process Next response tests do not certify HTTP/RSC routing. |

## Boundaries reviewed and preserved

Inspected shared policy/viewer/admin guards, admin page entry guards, user PATCH/self/owner/CAS restrictions, both public project aliases/readers, rich HTML read/write/editor paths, blog list/detail states/deletion/ID compatibility, media normalization and inline/carousel rendering, profile and terminal access, cache/origin middleware, CMS update/list/delete flows and fixture limitations. Existing tests continue to cover anonymous, ordinary/private-reader, banned/disabled, admin/owner and malformed/null permissions.

Project HTML allowlist was not relaxed. Blog still accepts existing HTML/placeholders and nonexecutable native disclosure/media formats; arbitrary JavaScript is unsupported. Draft/archive/private/deleted read policy remains server-controlled; no existing row is published or modified by these local checks. Media and theme changes do not change identity providers.

## Remaining high-impact dependencies

Atomic owner restriction/last-owner protection and actor-check/write races; public S3 URLs/caches; actual RLS/grants; upload content/size validation; nontransactional media writes; framework security patch debt; live Clerk recovery and Next middleware/provider integration. These are not resolved by fixture tests. Authentication/database migrations remain separate decisions.

AWS profile exists but uses direct credential fields; provenance relative to the previously exposed key cannot be established. It was not used for STS or resource calls. Neon development status is unverified; no connection was attempted. Details: infrastructure/AWS_INVENTORY.md and NEON_READINESS.md.

See BLOG_QA_MATRIX.md, CMS_HARDENING.md, THEME_SYSTEM.md and NEXT_PHASE_PLAN.md for verification scope and next gates. Final results and a Phase 3B-only modified-file manifest are appended after validation.

## Final validation and execution limits

| Check | Final result |
| --- | --- |
| Security/CMS | **174 passed, 0 failed** (baseline 157 reproduced) |
| In-process Next/repository integration | **6 passed, 0 failed** |
| TypeScript | Passed, no emit/incremental cache |
| Full ESLint | **152 errors, 12 warnings**, baseline 159/12; zero new diagnostics by file/rule/message/severity |
| Playwright runtime | Blocked before test execution by loopback EPERM; 0 current browser passes claimed |
| Playwright discovery | **52 cases discovered**; discovery is not execution |
| UI fixture JS/CSS | Offline build-only check passed |
| Screenshot gallery | .artifacts/phase3b-gallery/index.html: **41 historical references, 0 new captures**, prominently labeled |
| Whitespace / secret patterns | git diff --check passed; 0 matches for targeted private-key/AWS-key/Clerk-key/password-clause/COPY patterns; not exhaustive secret-scanner certification |

Existing lint debt is retained rather than suppressed. No arbitrary new dependency or remote agent skill was installed. The fixture build never loads .env.local/provider SDKs. Tests use synthetic identities/content; the Next integration layer swaps provider boundaries only in the test harness, not application code. Required browser validation is an explicit environment blocker, not a passing check.

Diagnostic logs initially inherited temporary-directory paths from earlier phases; subsequent logs and review artifacts were confined to ignored repository directories. No unrelated project, backup, credential value or private record was copied into the repository. No commits/pushes were made.

## Phase 3B modified-file manifest

Relative to the pre-Phase-3B working tree, preserving prior uncommitted Phase 2C/3 work:

- `docs/BLOG_QA_MATRIX.md`
- `docs/CMS_HARDENING.md`
- `docs/NEON_READINESS.md`
- `docs/NEXT_PHASE_PLAN.md`
- `docs/PHASE3B_REVIEW.md`
- `docs/THEME_SYSTEM.md`
- `docs/infrastructure/AWS_AUDIT.md`
- `docs/infrastructure/AWS_INVENTORY.md`
- `package.json`
- `scripts/blog-review-server.cjs`
- `scripts/phase3b-review-gallery.cjs`
- `src/app/[slug]/page.tsx`
- `src/app/api/admin/posts/[slug]/media/link/route.ts`
- `src/app/api/admin/posts/[slug]/media/reorder/route.ts`
- `src/app/api/admin/posts/[slug]/media/route.ts`
- `src/app/api/admin/posts/[slug]/media/upload/route.ts`
- `src/app/api/admin/posts/[slug]/route.ts`
- `src/app/api/admin/posts/route.ts`
- `src/app/globals.css`
- `src/app/projects/[slug]/page.tsx`
- `src/app/terminal/layout.tsx`
- `src/components/admin/editor/media.ts`
- `src/components/admin/editor/useMediaOrder.ts`
- `src/components/admin/posts/EditPostForm.tsx`
- `src/components/admin/posts/ManagePostsPage.tsx`
- `src/components/admin/posts/PostRow.tsx`
- `src/components/admin/posts/StatusBadge.tsx`
- `src/components/admin/posts/usePosts.ts`
- `src/components/blog/MediaCarousel.tsx`
- `src/lib/blog/gallery.ts`
- `src/lib/blog/media.ts`
- `src/lib/cms/postInput.ts`
- `src/styles/blog.css`
- `src/styles/themes.css`
- `tests/browser/blog.spec.ts`
- `tests/browser/fixtures/blog.tsx`
- `tests/integration/next-contract.test.cjs`
- `tests/security/harness.cjs`
- `tests/security/phase3b.test.cjs`

## Source evidence index

- `src/components/blog/MediaCarousel.tsx:15`
- `src/lib/blog/gallery.ts:5`
- `src/app/api/admin/posts/[slug]/route.ts:80`
- `src/components/admin/posts/EditPostForm.tsx:236`
- `src/components/admin/posts/usePosts.ts:38`
- `src/app/api/admin/posts/route.ts:33`
- `src/lib/cms/postInput.ts:23`
- `src/styles/themes.css:4`
- `src/app/terminal/layout.tsx:8`
