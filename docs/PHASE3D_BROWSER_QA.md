# Phase 3D browser execution runbook

Current result: zero executed tests, zero fresh screenshots. Both standalone Node and Playwright fixture startup are blocked by `listen EPERM`. Standalone tests covered fixed IPv4 port 4173, ephemeral IPv4 port 0 and ephemeral IPv6 `::1`; all failed at the same listen syscall. This excludes the chosen port, fixture bundler and Playwright as necessary causes. It strongly indicates an environment/sandbox listen policy; exact OS-versus-sandbox attribution is not available without prohibited escalation. No alternate transport or security-setting workaround was attempted.

Outside the listen-restricted environment, with dependencies and Chromium already installed, run from the repository root:

```sh
BLOG_REVIEW_OUTPUT=.artifacts/phase3d/browser node scripts/blog-review-server.cjs --build-only
./node_modules/.bin/playwright test -c playwright.phase3d.config.ts --list
./node_modules/.bin/playwright test -c playwright.phase3d.config.ts
```

Only the last command executes tests. If listen EPERM recurs, stop and save the log; do not request elevation or weaken security. If the browser binary is missing, record that blocker separately; no automatic install or dependency update is authorized by this runbook. Phase 3D outputs are isolated under `.artifacts/phase3d/`: browser JS/CSS/screenshots, playwright-results traces and playwright-report HTML. Earlier captures remain historical.

Run all 57 cases, covering desktop/tablet/mobile light/dark, extended widths, enlarged text/reduced motion, preview/save/conflict/publication, pagination, sanitizer/consent, gallery controls, rejected uploads, keyboard caption/reorder failures and delayed-media hydration. Verify real form input retention and that the late old media response cannot replace a newer upload. Inspect screenshot layout, browser/page errors, hydration, broken images, focus visibility/return, modal containment, keyboard order and axe results. Do not turn discovered cases or offline bundle compilation into passing browser counts.

This server is a standalone synthetic React fixture with intercepted third parties; it never loads application environment files or provider SDKs. It does not prove live Clerk/Next middleware/RSC routing, real SQL/RLS, S3 privacy, codecs or actual Instagram behavior. Full Next HTTP/device/Safari/Firefox/screen-reader tests are separate gates requiring approved synthetic staging. Do not use production data to satisfy them.
