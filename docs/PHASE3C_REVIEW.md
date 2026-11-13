# Phase 3C stabilization review

## Baseline (reproduced before source edits)

2026-11-11, branch `feat/cinematic-redesign`. Extensive pre-existing tracked modifications and untracked docs, scripts, tests and libraries were present. They are preserved; the branch HEAD diff is not a Phase 3C-only diff. No AGENTS.md was found. Read Phase 3B review, blog foundation, CMS hardening, security remediation and theme system documentation. Route/library/component/test inventory and initial tracked diff summary are in `.artifacts/phase3c/inventory.txt` and `initial-diff-stat.txt`. AWS audit artifacts are excluded from this work.

| Command | Exit | Reproduced result |
| --- | --- | --- |
| `npm run test:security` | 0 | 174 passed |
| `npm run test:integration` | 0 | 6 passed; provider mocks, in-process Next Response, no HTTP server/database |
| `./node_modules/.bin/tsc --noEmit --incremental false` | 0 | Passed |
| `./node_modules/.bin/eslint . -f json -o .artifacts/phase3c/lint-baseline.json` | 1 | 152 errors, 12 warnings |

Package scripts: dev/build/start, lint, test:security, test:integration, test:browser and review:blog. No package installations, external database access or provider configuration is authorized. All new artifacts belong under `.artifacts/phase3c/`. Validation and findings below are completed as work proceeds.

## Executive summary

Local hardening is complete with **218 security/CMS tests**, **8 in-process integration tests**, passing TypeScript, offline UI compilation and a credential-free Next compile-mode build. ESLint fell from **152 errors/12 warnings to 93 errors/5 warnings**, without disabling rules or adding broad type suppressions. This is not a production readiness certification: browser execution remains blocked, dependency security patching is outstanding, and provider/database invariants remain unverified.

No branch switch, commit, push, migration, deployment, provider mutation, production connection, credential inspection, dependency installation or AWS audit artifact change was performed. The cinematic homepage was not implemented. Only public upstream documentation was consulted online; application files/data were not uploaded.

## Security findings and fixes

| Priority | Confirmed local finding | Change and evidence |
| --- | --- | --- |
| P1 | Blog upload accepted arbitrary `image/*` claims, including active SVG, with no byte ceiling | `cms/upload.ts` caps actual multipart stream bytes at 10 MiB + 64 KiB overhead, independently of Content-Length. Enforces one file, nonempty/max 10 MiB, PNG/JPEG/GIF/WebP signatures matching MIME, generated UUID/canonical extension. SVG/HTML, mismatches, truncation, duplicate files and oversized streams have adversarial tests. No decoder, malware scan or decompression-bomb guarantee is claimed. |
| P1 | Project carousel independently used arbitrary URLs in a YouTube iframe | Recognizes exact supported hosts through the shared parser; constructs a canonical HTTPS embed URL with sandbox, no-referrer and lazy loading. Invalid embeds render no frame. Browser regression prepared; actual DOM behavior remains unexecuted. Shared URL policy is exercised in security tests. |
| P2 | Reorder accepted malformed items by silently dropping them and used ID-only upsert after a parent lookup | Bounded strict parser retains supported aliases, rejects duplicates/unknown/malformed IDs, and caps collection reads at 1,001 candidates. Updates compare both post ID and media ID, never insert, and return conflict if a row moved/disappeared. Synthetic race test verifies no modification of a moved row. Maximum editable list is 1,000 items. Partial application and simultaneous writers remain possible without transactions. |
| P2 | Project media replacement deleted prior media before validating input and ignored deletion failure | Validates the whole batch before deletion; rejects invalid URLs/embed hosts, type/caption/index/meta bounds. Failed child deletion stops replacement inserts and project parent deletion. Explicit empty replace still clears references where supported. An insertion failure after successful deletion cannot be rolled back locally. |
| P2 | Admin media read had a second permissive URL normalizer accepting data URLs | Reuses shared scheme-safe normalizer; malformed records and nontext captions do not propagate through normalization. Admin/public normalization and YouTube ID utilities now share implementation. |
| P2 | Caption endpoints coerced arbitrary JSON into text; media IDs were decoded twice | Caption-only object boundary, 2,000-character limit, no implicit object coercion; already-decoded IDs preserved. Link URLs capped at 2,048 characters. Tests verify no writes for invalid input. |
| P2 | Media/upload/presign errors exposed provider/database messages, and presign could place active HTML/SVG content under arbitrary project paths | Changed affected responses to generic messages; validated project identifier, filename length and a MIME allowlist before SDK construction. Nonimage/nonvideo presigns specify attachment disposition. Presign still cannot verify bytes, actual object size or parent existence. |
| P2 | Live terminal engine retained an obsolete credential prompt and localStorage token path against a missing login endpoint | `blog` now navigates to the existing Clerk-protected `/blog` route. Removed credential accumulation and token persistence. Real engine test verifies navigation and continued registry execution; no authentication guard was removed. |
| Defense in depth | Origin-only middleware did not reject cross-site Fetch Metadata when Origin was absent | Cross-site `Sec-Fetch-Site` now rejects admin mutations, retaining existing explicit Origin checks and private/no-store failures. Originless nonbrowser clients still reach handler authentication; this is not a CSRF-token implementation. |

Existing role/owner/self/nullable permission protections, SQL-bound public status checks, slug/legacy ID compatibility, draft sanitization, expected revision enforcement and stale-publish conflicts remain covered by the full passing suite. Administrator scope is global in the current model; this phase does not introduce author ownership or tenant ACLs. Media caption/delete APIs retain their existing global admin policy. Real grants/RLS, owner serialization and actor-revocation races were not tested against a database.

## CMS workflow improvements

Create/save and parent media actions now guard duplicate in-flight submissions with refs as well as disabled UI. This prevents repeated clicks in one mounted UI, not server idempotency or retries after an unknown network outcome. Input is retained on rejected saves; post saves keep conditional revisions. Integration tests now walk create → private draft → publish → published update → private → draft → archive → delete, checking anonymous visibility after each step.

Caption saves update local data only after success, retain the editable draft on failure and announce the error instead of rolling back an entire stale media array. Canonical captions merge through a functional state update. Caption fields have accessible labels and maximum lengths. Parent upload/attach/remove operations expose busy controls; newly allowed upload types/size are explained on validation failure.

Removed the duplicate reorder pipeline: hydration/caption updates no longer persist ordering. Drag completion or explicit keyboard move buttons queue the order. A single debounce/serialized local request chain reports pending/saved/failed status in the existing live region; queued work invalidates on unmount/slug change. Already-issued writes cannot be rolled back by navigating away. Independent browser tabs still require a database revision/transaction design.

Search remains explicitly page-local; previous/next and bounded catalog semantics are preserved. No autosave, global search, revision history, scheduling, soft-delete migration or object deletion was introduced. A failed object-record insertion can still orphan an uploaded object; no speculative S3 cleanup/delete was added.

## Accessibility, performance and themes

Keyboard move controls complement drag ordering. Caption inputs have names and limits; save and reorder states are announced. Publishing separators, media hover controls, error surfaces and placeholder chips consume semantic theme values. Prose focus CSS now consumes `--focus-width`/`--focus-offset` instead of repeating constants. Shared typography/colors/spacing/radius/shadow/motion remain in `src/styles/themes.css`; no palette or identity redesign was performed.

Removed the About section effect that preloaded all original/800/1600 image variants (up to three eager loads per item). Visible responsive images keep browser-native loading; full-size images load when opened. Derived carousel indices avoid a synchronous correction render and out-of-bounds access after list shrink. About motion honors reduced-motion preference for entrance/image transitions. No network-byte, Core Web Vitals, contrast or visual fidelity measurement is claimed without a browser.

Residual accessibility work: custom About lightbox focus containment/return, clickable image activation, real keyboard/screen-reader navigation, forced colors, modal nesting, terminal reflow and real-device zoom. Several public/legacy surfaces still hardcode colors and dimensions. Existing root overflow hiding remains a limitation, not proof of responsive fit. Blog prose remains a client hydration island, so no-JS reading/SEO needs follow-up. Third-party Instagram DOM and real media codecs are unverified.

## Code quality and architecture

Removed duplicate admin/public media normalization and permissive YouTube regexes; replaced editor/media casts with typed normalization, typed admin initialization and functional state setters. Removed unused localStorage-derived admin UI state, unused auth destructuring/imports and a redundant About state effect. Remaining lint is predominantly explicit-any debt in legacy terminal/project/admin views; unused legacy `components/blog/MediaList.tsx` still carries an exhaustive-deps warning and external-backend path. It has no imports found in the static source inventory and was retained rather than deleting unrelated code.

A local TypeScript AST import graph checked 200 TS/TSX files and found **zero static runtime import cycles**. Dynamic imports, require graphs and type-only edges are outside that result. The repository has both pnpm-lock.yaml and historical package-lock.json; no dependency manifest/lockfile was changed in Phase 3C. Framework build warns about middleware→proxy convention, stale browser compatibility data and cache string serialization; no speculative framework migration was made.

### Dependency security and upgrade recommendation

Installed versions were confirmed locally as Next **16.0.7** and React/ReactDOM **19.2.0**. This is release-blocking patch debt. The official [November 3, 2026 Next security release](https://nextjs.org/blog/november-2026-security-release) identifies **16.4.5** as the then-current patched 16.x release. The [October upstream security release](https://nextjs.org/blog/nextjs-security-update-october-14-2026) also documents RCE/DoS fixes; individual exploit prerequisites differ. The [React RSC advisory](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3) lists patched 19.2.9/19.3.1 RSC packages. Plain React's version alone does not establish which framework-bundled RSC code is used.

Recommendation: perform a dedicated Next 16.x security update to at least the current supported patched release, align eslint-config-next and supported React/ReactDOM, and regenerate the authoritative pnpm lock. Recheck current advisories at upgrade time. Validate Clerk peer compatibility, middleware/proxy routing, async params, React Compiler, RSC hydration, cache/draft privacy and deployment runtime. This phase documents rather than installs an unvalidated dependency set, because browser/provider verification is blocked. No claim is made that custom sanitization fixes framework vulnerabilities. No registry audit was run: it would submit the dependency graph externally, and no exhaustive transitive vulnerability clearance is claimed.

## ESLint and TypeScript

| Batch | Errors | Warnings |
| --- | ---: | ---: |
| Reproduced baseline | 152 | 12 |
| Upload/media/parser/type batch | 117 | 12 |
| CMS, shared types, hook/performance cleanup | 99 | 7 |
| Final | **93** | **5** |

Final TypeScript passes. One intermediate project-media typing mismatch (`created_at` nullable server DTO versus client type) was caught and corrected to admit null; it was not waived. Lint still exits 1. No rule was disabled or blanket any/suppression added. Machine-readable diagnostic snapshots remain under `.artifacts/phase3c/`.

## Final validation

Exact commands/exits: `.artifacts/phase3c/results.json`; individual `*-final.log` files contain output.

| Check / command | Exit | Result / scope |
| --- | ---: | --- |
| `npm run test:security` | 0 | **218 passed**, zero failed/skipped; 44 more than baseline |
| `npm run test:integration` | 0 | **8 passed**, zero failed/skipped; real NextRequest/NextResponse, mocked providers/repository |
| `tsc --noEmit --incremental false` | 0 | Passed |
| `eslint . -f json -o .artifacts/phase3c/lint-final.json` | 1 | **93 errors, 5 warnings**; cleanup incomplete |
| `BLOG_REVIEW_OUTPUT=.artifacts/phase3c/browser node scripts/blog-review-server.cjs --build-only` | 0 | Real component JS/CSS compiled offline |
| `playwright test -c playwright.phase3c.config.ts --list` | 0 | **55 discovered**; not runtime verification |
| `playwright test -c playwright.phase3c.config.ts` | 1 | Fixture server `listen EPERM 127.0.0.1:4173`, before test execution |
| `node scripts/phase3c-compile.cjs` | 0 | Next production webpack **compile mode only**; no prerender/final generate phase |
| `git diff --check` | 0 | Passed |
| Local targeted source/sensitive-path scan | 0 | Zero matching files, zero tracked sensitive paths; not exhaustive secret-scanner certification |

The compile script stages only named nonsecret config files and source/public/dependency symlinks beneath `.artifacts/phase3c/compile`, passes a minimal environment and disables telemetry. It does not copy/read .env files or inherit provider credentials. The full normal `npm run build` was not run because it loads local environment files and may prerender with configured providers. Compile-mode success does not certify a deployable build. No live Clerk, Supabase/Neon, S3, HTTP middleware/RSC transport or production cache behavior was exercised.

## Browser QA status

**Zero current browser passes and zero new screenshots.** The default documented runner was attempted once with isolated Phase 3C outputs; server startup fails before browser launch. This is permission denial rather than a demonstrated port collision. No elevation, OS/security change, alternate transport bypass or repeated retry was attempted. Fixture compilation and discovery passed. Three new runtime tests cover keyboard reorder/caption failure, rejected image input and project iframe policy, and remain unexecuted.

Use [PHASE3C_BROWSER_QA.md](PHASE3C_BROWSER_QA.md) for commands and review criteria. Existing Phase 3/3B screenshot references are historical and do not validate this code. Their artifacts were not overwritten. New logs, staged builds and future captures use `.artifacts/phase3c/`.

## Phase 3C file manifest

This list describes this session's edits rather than the combined diff against HEAD:

- `docs/PHASE3C_REVIEW.md`, `docs/PHASE3C_TEST_MATRIX.md`, `docs/PHASE3C_BROWSER_QA.md`
- `playwright.phase3c.config.ts`, `scripts/blog-review-server.cjs`, `scripts/phase3c-compile.cjs`, `postcss.config.mjs`
- `src/lib/cms/upload.ts`, `src/lib/cms/mediaOrder.ts`, `src/lib/blog/media.ts`, `src/lib/blog/render.ts`, `src/lib/admin/getAdminPost.ts`, `src/lib/admin/types.ts`, `src/lib/utils/inactivityWatcher.ts`
- `src/app/api/admin/posts/[slug]/media/{route.ts,link/route.ts,reorder/route.ts,upload/route.ts}`, `src/app/api/admin/posts/[slug]/route.ts`, `src/app/api/admin/media/[mediaId]/route.ts`
- `src/app/api/admin/projects/[id]/media/route.ts`, `src/app/api/admin/projects/[id]/route.ts`, `src/app/api/admin/uploads/presign/route.ts`, `src/middleware.ts`
- `src/components/admin/editor/{media.ts,useMediaOrder.ts,usePostEditor.ts,MediaList.tsx}`, `src/components/admin/posts/{CreatePostForm.tsx,EditPostForm.tsx,ManagePostsPage.tsx}`
- `src/components/blog/BlogFooter.tsx`, `src/components/home/sections/about/AboutSectionClient.tsx`, `src/components/home/sections/project/{InlineCarousel.tsx,ProjectDialogBody.tsx,useProjectDetail.ts}`
- `src/components/terminal/components/TerminalShell.tsx`, `src/components/terminal/lib/engine.ts`, `src/styles/blog.css`
- `tests/security/harness.cjs`, `tests/security/phase3c.test.cjs`, `tests/integration/next-contract.test.cjs`, `tests/browser/blog.spec.ts`, `tests/browser/fixtures/blog.tsx`

## Remaining risks and Phase 3D priorities

1. **Patch framework/RSC dependency security debt before any release**, then complete full HTTP/browser/provider staging verification. No production exploitability audit was performed here.
2. Complete the 55 browser cases and review fresh desktop/tablet/mobile light/dark captures, console/hydration errors, focus, overflow and broken images. Add full Next route/RSC/middleware tests separately from component fixtures.
3. Verify a dedicated development database and design transactions for owner invariants, actor authorization at write, post/media deletion, replacement and reorder. Mocked races do not prove deployed isolation/RLS/uniqueness.
4. Design quarantined uploads with byte/decoded-dimension checks, quotas/rate limits/timeouts, private object delivery, server-side presign size/parent checks, idempotency and orphan reconciliation. Existing S3 public-cache policy and objects were not changed or certified confidential.
5. Finish legacy lint/runtime validation, remove obsolete UI paths only after usage review, consolidate package managers, implement server-readable sanitized blog content and plan structured editor/unsaved-navigation recovery. Existing media hydration may still race with in-flight local editing; no autosave/revision-history promise is made.
6. Address custom lightbox keyboard/focus behavior, terminal reflow, global contrast/forced colors and remaining hardcoded styles. Preserve the current design while extending token adoption.

Before committing, review the upload compatibility restriction (new SVG/other unsupported image uploads rejected), caption/reorder limits, generic error contracts, explicit project replace behavior and the terminal `blog` navigation. Review this session's file list together with the much larger pre-existing working tree; no commit was created.
