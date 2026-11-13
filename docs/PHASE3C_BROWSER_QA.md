# Phase 3C browser QA runbook

Current result: **blocked at fixture server startup** (`listen EPERM: operation not permitted 127.0.0.1:4173`). Zero browser tests executed and zero fresh screenshots. Historical captures are not verification of Phase 3C. No elevated permissions, OS settings changes or transport bypasses are required or recommended by this runbook.

From the repository root, in an environment that already permits ordinary local loopback listening and has the project dependencies/Chromium installed:

```sh
BLOG_REVIEW_OUTPUT=.artifacts/phase3c/browser node scripts/blog-review-server.cjs --build-only
./node_modules/.bin/playwright test -c playwright.phase3c.config.ts --list
./node_modules/.bin/playwright test -c playwright.phase3c.config.ts
```

The first command compiles offline; the second only discovers **55** tests; only the third executes. If it fails on listen EPERM again, record the output and stop retrying. Do not escalate or change OS/security settings. If Chromium is unavailable, record that blocker; this runbook does not automatically download a browser or change dependencies.

Phase 3C configuration preserves the original runner and stores the synthetic bundle/CSS/screenshots under `.artifacts/phase3c/browser/`, execution traces under `.artifacts/phase3c/playwright-results/`, and HTML reports under `.artifacts/phase3c/playwright-report/`. It never starts the configured production application, loads .env files or imports provider SDKs. Third-party HTTP requests are blocked or fulfilled with synthetic responses by the suite. Do not point this harness at production or substitute private fixtures.

Review the full matrix: mobile 375×812, tablet 768×1024, desktop 1440×900, ultrawide 2560×1440, plus extended 320/412/1024/1366/2560/3840 widths; light/dark article layouts, long code/tables/media, enlarged text and reduced motion. Screenshots are review captures, not approved pixel baselines.

Verify these flows after the automated run:

1. Keyboard skip link, visible focus, native details and link navigation. Check overflow without relying on a root overflow mask. Inspect broken images, page/console/hydration errors and axe output.
2. Create validation, server failure and retained title; edit/unsaved preview without writes; save revision advancement; stale conflict; publish confirmation and cancellation; unpublish/list pagination/page-local search/error recovery.
3. Upload supported raster content and reject SVG/HTML/oversized/mismatched files; inspect pending controls and retained text on network failure. Fixture tests do not verify S3 or actual decoding.
4. Caption edit success/failure/Enter/Escape, keyboard media move up/down and drag, pending/saved/error reorder announcement; inspect request payloads and confirm caption/hydration changes do not generate reorder writes.
5. Instagram remains unloaded before consent. YouTube frames use canonical URLs and fixed sandbox/referrer policy. Invalid project YouTube URLs produce no frame. Provider stand-ins cannot certify real embed compatibility.
6. Review fresh screenshots visually for clipped controls, readable validation/status, content hierarchy and light/dark contrast. Mark any earlier Phase 3/3B capture as historical.

Separate verification remains necessary for real Next routing/middleware/RSC, Clerk, a verified development database, object privacy/CORS, real embeds/codecs, Safari/Firefox, touch keyboards, screen readers, zoom and hardware devices. None is certified by this standalone component harness.
