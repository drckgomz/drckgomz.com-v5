# Phase 3 blog and CMS foundation

Local implementation on feat/cinematic-redesign. No cinematic homepage implementation, Neon connection, database writes/migrations, real-content imports, authentication replacement, provider changes, deploy, push or merge. [Neon readiness](NEON_READINESS.md) is explicitly blocked pending branch verification.

## Capability inventory and preservation

| Existing capability | Source / Phase 3 behavior |
| --- | --- |
| Stored HTML and contentEditable | Editor.tsx, usePostEditor.ts, EditPostForm.tsx; preserves HTML, paragraphs, formatting, links, lists, quotes, code, tables and media placeholders. No content-format/schema conversion. |
| Legacy placeholders | lib/blog/render.ts keeps case-insensitive ID-specific matching, encoded brackets, nested placeholder spans and zero-width normalization. Attribute interpolation is escaped; executable schemes and lookalike embed hosts rejected. |
| Images, YouTube, Instagram | Placeholder-driven media still supported; YouTube watch/short/embed URLs recognized on exact hosts. Instagram links remain available immediately; explicit opt-in loads third-party script. No automatic script on every article. Network failure leaves the link. |
| Publication | Existing draft/private/public/archived states retained. New posts default draft. Server validates allowed fields/types/lengths, status, date and URL schemes. No unknown state is silently published. |
| Editing and preview | Inline unsaved preview uses actual renderer; does not save/publish. Publishing from a nonpublic initial state asks confirmation. Errors are announced and input retained. Saved notice, unsaved indicator and beforeunload warning added. |
| Concurrency | Editor sends expected_updated_at; PATCH applies conditional update and returns 409 on conflict. Missing post returns 404 rather than implicit recreation. Old clients may omit the revision for compatibility; this is not universal lost-update prevention. |
| Media management | Existing upload, attach link, thumbnail, caption, insert/remove and reorder flow retained. Link endpoint validates schemes/supported embed hosts. S3 access and object privacy are unchanged; see PRIVATE_MEDIA_DELIVERY.md. |
| Authorization | Existing page/API guards and public/private/deletion policy retained. Private/editorial DTOs remain server-filtered. Previous 127 security tests remain in the expanded suite. |

## Rendering boundary

New lib/blog/content.server.ts sanitizes stored blog HTML and expanded placeholders on public API reads, sanitizes admin reads/writes, and extends the unchanged project policy only for native details/summary and nonexecutable Instagram metadata. Project restrictions are not relaxed. No arbitrary HTML scripts or user-supplied JavaScript is supported as “interactive content.” Supported interaction is native disclosure, safe links and constrained embeds/media controls.

BlogContent keeps DOMPurify as a client/preview defense and validates iframe host/path before DOM insertion. SSR/hydration does not invoke browser-only sanitizer APIs on the server. Rendered API HTML is already server-sanitized; the client rendering island hydrates before inserting content. Search/no-JS article rendering remains a future improvement, not a claimed SSR feature.

Canonical responsive content CSS contains oversized images/video, gives YouTube frames a responsive ratio, wraps long text, allows local pre/table scrolling, themes captions and keeps native interactions keyboard accessible. Page-wide overflow hiding is not used as a substitute for sizing. Embedded Instagram-generated DOM still needs real third-party/device verification; tests never contact that provider.

## CMS limits

No new scheduling, autosave, revisions table, audit trail, collaborative merge, soft-delete migration or media-privacy system is claimed. Save timestamps are a compatibility token, not a monotonic revision number; future verified schema should use an integer version. API clients omitting tokens can still overwrite. Media edits are separate writes and do not participate in the post revision transaction or unsaved indicator. Beforeunload cannot reliably intercept all client-side navigation/mobile process termination.

Stored editor initialization and pasted rich HTML are sanitized before DOM insertion; dropping HTML into the editor is disabled (media panel uploads remain supported). A broader structured editor/toolbar still needs review; native contentEditable has browser-specific behavior. Publishing forms and the media panel now use semantic colors and have light/dark browser coverage. Other legacy admin components are not certified light-ready. No speculative rewrite of all editor/media functionality was performed.

Server field limits are explicit: title/slug 240 chars, excerpt 2,000, HTML 2,000,000, thumbnail URL 2,048. These are new input limits, not a rewrite of existing stored rows. Slug separators/control characters are rejected for new edits; existing literal case-insensitive lookup and slugless ID compatibility are preserved. Real database uniqueness constraints/collation and atomic status/version guarantees are unverified.

## Local review and tests

Use npm run test:security, TypeScript no-emit, relevant ESLint, and npm run test:browser. The browser runner uses an independent esbuild/PostCSS loopback server: **not Next, no .env loader, no provider SDK**. It imports real BlogContent, EditPostForm, CreatePostForm, Editor and UI primitives, with fixture-only Next router replacement and mocked API responses. Browser requests to external hosts are blocked/replaced with synthetic stand-ins. Next/Clerk middleware, real RLS and production navigation are not certified by this harness.

Viewport matrix: 375x812 mobile, 768x1024 tablet, 1440x900 desktop, 2560x1440 ultrawide; long article/media-heavy/mixed/error fixtures in light/dark. Additional 320px enlarged-text/reduced-motion and editor/save/conflict/publish/create cases. Assertions cover overflow, media bounds, script/runtime errors, fixture navigation, native interaction, embed opt-in, accessible labels and axe WCAG A/AA rules. Screenshots are review artifacts, not pixel-baseline comparisons. Real iOS/Android, Safari/Firefox, touch keyboards, hardware codecs, screen readers, network and actual browser zoom remain manual/integration tasks.

Generated artifacts are ignored under .artifacts/: blog-review/index.html gallery and screenshots, playwright-report/index.html report and failure traces. Generate gallery with node scripts/blog-review-gallery.cjs after a successful browser run. See the final validation section for actual results; do not infer passing checks from this test plan.

## Tooling and dependencies

Development-only tools are pinned: @playwright/test 1.65.0, @axe-core/playwright 4.14.0 and esbuild 0.28.2. Playwright provides reproducible local [web-server startup](https://playwright.dev/docs/test-webserver) and [screenshots](https://playwright.dev/docs/screenshots); axe checks supplement manual accessibility review. Esbuild bundles the fixture entry without starting Next or reading application environment files. The fixture is not an application route or an authentication bypass.

The package installation added the tools but reported blocked build scripts from the pre-existing workspace approval placeholders. No blanket build-script approval was added; actual esbuild, browser and checks ran successfully using installed binaries. Chromium was downloaded to the local Playwright cache. Frozen pnpm lock validation with scripts ignored passed. The new dev dependency on Playwright also changes Next's optional peer snapshot in pnpm; unrelated package versions were not intentionally upgraded. The stale package-lock.json remains a separate package-manager consolidation task; npm ci is not certified.

## Remaining security and integration dependencies

- Atomic last-owner enforcement and safe destructive co-owner management remain blocked on reviewed database transactions.
- Private object delivery remains blocked on verified S3/CDN origin policies and cache behavior. API status checks cannot revoke known public URLs.
- Direct Supabase RLS/grants, deployed PostgREST behavior, Clerk provisioning/recovery, real Next navigation and cross-provider transactions are unverified locally.
- Existing Next 16.0.7/React patch debt needs a separate controlled security update before a release. This phase is not release approval.
- Auth linking/recovery and actual Neon development branch identification need explicit review before any connection/migration. No passwords, tokens or sessions were imported.
- Iframe scripts and arbitrary executable content are intentionally unsupported. Instagram opt-in authorizes loading its third-party script for that document; removing the visual embed cannot undo a loaded script or prior network access. YouTube/remote images may still contact third parties when rendered; no universal embed-consent system is claimed.
- Upload byte limits/content sniffing, orphan handling, atomic reorder and media/post transactional revisions are not implemented. Legacy media operations retain their existing storage architecture.
- Automated accessibility results cover synthetic fixtures and tested states, not every real post or the entire site. Editorial alt text and real-device/screen-reader verification remain required.

## Phase 3 file map

Earlier Phase 2B/2C working-tree changes are preserved; a diff against branch HEAD also includes that prior work.

- Publishing: src/lib/cms/postInput.ts; src/app/api/admin/posts/route.ts; src/app/api/admin/posts/[slug]/route.ts; src/app/api/admin/posts/[slug]/media/link/route.ts; src/components/admin/posts/CreatePostForm.tsx; EditPostForm.tsx; src/components/admin/editor/Editor.tsx; MediaList.tsx.
- Rendering: src/lib/blog/render.ts; content.server.ts; preview.ts; read.ts; src/lib/admin/getAdminPost.ts; src/lib/content/projectHtml.ts (options extraction, project policy unchanged); src/components/blog/BlogContent.tsx.
- Themes: src/styles/themes.css; blog.css; src/app/globals.css; root/blog/admin/terminal layouts (scope/default metadata only).
- Verification: tests/security/cms.test.cjs; harness.cjs (opt-in synthetic insert support); playwright.config.ts; tests/browser/blog.spec.ts and fixtures; scripts/blog-review-server.cjs; blog-review-gallery.cjs.
- Tooling/docs: package.json; pnpm-lock.yaml; eslint.config.mjs (artifact ignore and standalone-fixture-only Next-Link rule exception); .gitignore; this report; NEON_READINESS.md; THEME_FOUNDATION.md; ANALYTICS_DESIGN.md.

No commit was created. No production tracking was enabled. The cinematic homepage composition remains unchanged.

## Final validation results

- Security/CMS suite: **157 passed, 0 failed**, including all 127 preceding tests and 30 CMS/content cases.
- Playwright Chromium: **45 passed, 0 failed** on the final run (52.9s). Automated axe checks found no tested WCAG-rule violations in the asserted fixture states; this is not site-wide accessibility certification.
- TypeScript: passed, no emit and no incremental cache.
- Full ESLint: **159 errors, 12 warnings**, compared with Phase 2C's 184/12. No new diagnostics by file/rule/message/severity; the old unused postcss import warning remains. The fixture-only Next-Link exception does not suppress application checks; these standalone pages intentionally have no Next router.
- Frozen pnpm lock validation: passed with scripts ignored. git diff --check passed.
- **41 screenshots** generated: 32 article/error combinations, four dark publishing views, four light publishing views and one 320px enlarged-text view. Gallery: ../.artifacts/blog-review/index.html; test report: ../.artifacts/playwright-report/index.html. Artifacts remain local/ignored.
- Reviewed representative mobile publishing and article images visually in addition to automated bounds assertions. No real-device test, full Next build or live-provider integration was run. Browser startup/download sandbox restrictions were resolved through approved local tooling execution; initial fixture-shim/overflow/contrast failures were fixed and rerun rather than waived.

Recommended next milestone: owner review of the gallery and CMS behavior, then provider-free Next integration/structured-editor and repository contract tests. Separately confirm a dedicated Neon development branch and approve exact schema/auth-linking/owner-transaction plans before any real migration or data transfer. See NEON_READINESS.md for that approval gate.
