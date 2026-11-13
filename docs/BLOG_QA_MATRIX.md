# Blog QA matrix: Phase 3B

## Execution status

| Layer | Evidence | Limitation |
| --- | --- | --- |
| Existing security/CMS baseline | 157 reproduced passing tests | Synthetic repositories, no real provider |
| Expanded security/CMS | See PHASE3B_REVIEW final results | Real handlers/policy/parser with mocked network/SDK boundaries |
| Next integration/repository contracts | Real NextRequest/NextResponse and handlers; anonymous/ordinary/banned/admin, unpublish/stale-republish/reader confidentiality, bounded list projection | In-process dispatch only; not a Next HTTP/RSC/server/compiler or RLS test |
| Browser execution | Blocked at web-server listen with EPERM; not retried with elevation | New DOM/layout/contrast/gallery behavior is unverified at runtime |
| Fixture build and test discovery | Offline esbuild/PostCSS compilation and Playwright --list | Syntax/bundle evidence only; not browser passes |
| Screenshots | Historical Phase 3 gallery: .artifacts/blog-review/index.html, 41 captures | No new Phase 3B captures; prior images must not be used to approve changed UI |

## Prepared browser coverage

Existing matrix: 375x812, 768x1024, 1440x900, 2560x1440, long/media-heavy/mixed/error articles in light/dark; 320px enlarged-text and reduced motion; editor create/preview/save/publish/conflict/media errors/paste; nested theme variants and native details.

Added: 320x700, Android-sized 412x915, tablet landscape 1024x768, laptop 1366x768, QHD 2560x1440 and UHD/4K 3840x2160 reading/gallery scenarios. Gallery uses the real carousel and renderer; supported YouTube only, no arbitrary iframe fallback, no automatic slide advancement and Instagram opt-in. New actual ManagePostsPage fixture covers publish confirmation, revision-aware unpublish, search, next/previous pages, failure/retry and mobile overflow. Third-party requests are blocked or synthetic stand-ins.

Assertions include page overflow without blanket clipping, image/frame bounds, long code/table local scrolling, native disclosure, form labels, runtime errors, guarded status transitions, focus/keyboard behavior and axe WCAG A/AA checks in specified states. The expanded cases are **prepared, not executed** in Phase 3B. Missing real touch gestures, actual browser zoom, Safari/Firefox, screen readers, codecs, network conditions and third-party embed DOM remain manual/integration work.

Viewport resizing is not physical-device testing. The 200% font-size case is enlarged text, not a substitute for real 200%/400% browser zoom. Desktop Chromium dimensions do not certify iOS browser bars, Android keyboards, touch targets, assistive technology or high-DPI rendering. Approved Node/Playwright versions and browser cache are required in a future execution environment; do not obtain privileges automatically.

## Reproduction when loopback execution is permitted

Run npm run test:security, npm run test:integration, TypeScript no-emit, npm run lint, npm run test:browser, then node scripts/blog-review-gallery.cjs. The fixture server never loads .env.local or provider SDKs. Keep screenshots/traces under ignored .artifacts. Treat passing fixture screenshots as component evidence only, not release readiness.

The offline check `node scripts/blog-review-server.cjs --build-only` builds the actual UI fixture without opening a socket. `playwright test --list` discovers tests without launching a browser. A status-aware Phase 3B gallery links historical images and explicitly records the runtime blocker.

Final local results: 174 security/CMS passes; 6 in-process Next/repository passes; TypeScript passes; 52 browser cases discovered and fixture bundle compiled, runtime blocked. Status-aware gallery: `.artifacts/phase3b-gallery/index.html` (41 historical references, no new captures).
