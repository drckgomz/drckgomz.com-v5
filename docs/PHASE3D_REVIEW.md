# Phase 3D integration and production-readiness review

2026-11-11, `feat/cinematic-redesign`. **Local integration improved; production release remains blocked.** No cinematic homepage, branch switch, commit, push, deploy, database connection/migration, AWS operation, credential read, dependency installation or lockfile change was performed. AWS_AUDIT.md was read as architectural input and left unchanged by this session. No private source/data was sent to services; upstream advisory research used public documentation only.

## Initial repository and cross-phase baseline

The working tree already contained extensive Phase 3/3B/3C changes: 74 modified tracked files, 17 untracked entries (many directories), zero tracked deletions. The initial status/stat are preserved in `.artifacts/phase3d/initial-status.txt` and `initial-diff.txt`; a HEAD diff includes all preceding work and is not a Phase 3D-only patch. No repository AGENTS.md was found. Read the blog foundation, Phase 3B/3C review and test/browser matrices, AWS audit and Neon readiness checklist. No work was discarded/reset.

Overlaps reviewed: post routes/forms/revision rules; admin page/API/viewer guards; shared HTML/URL/media policies; blog/project rendering aliases; upload/caption/reorder/replacement paths; terminal command dispatch; theme/token and homepage composition. Phase 3 foundation's optional-revision/no-upload-limits descriptions are historical: Phase 3B made revisions mandatory and Phase 3C added upload limits. Current Phase 3D tests/reports supersede those historical statements, not existing data.

Reproduced before edits:

| Command | Exit | Baseline |
| --- | ---: | --- |
| `npm run test:security` | 0 | 218 passed |
| `npm run test:integration` | 0 | 8 passed |
| `tsc --noEmit --incremental false` | 0 | Passed |
| `eslint . -f json -o .artifacts/phase3d/lint-baseline.json` | 1 | 93 errors, 5 warnings |

## Confirmed integration defects and fixes

| Finding | Focused change | Verification |
| --- | --- | --- |
| Project media PATCH bypassed the Phase 3C batch validator: arbitrary types/URLs/indexes, malformed/null input and inconsistent error formats | One shared `projectMediaInput.ts` boundary now handles batch/PATCH fields, limits and exact supported embed hosts. PATCH validates type+URL together against existing fields, scopes parent association, compares type/URL snapshots on related edits and returns 409 if changed. Generic JSON errors replace raw diagnostics. Caption/order-only edits do not force repair of unrelated legacy URLs. | Malformed payload/scheme/embed cases, global admin denial, parent mismatch, valid caption and concurrent type-change regression with real Next requests. |
| Slow editor hydration could overwrite newly uploaded/reordered/captioned media, and failures were silent | A cancellable media snapshot helper tracks local-edit generation; late/stale/old-slug responses cannot replace edits. Malformed/non-OK reads preserve state and expose a user-visible error. Initialization normalization is lazy. | Deterministic delayed-response, slug-switch, cancellation and malformed/error tests; browser delayed-upload case prepared. |
| Existing-slug input helper aggressively lowercased/ASCII-normalized valid legacy IDs on blur | Existing editor slugs retain case, literal percent/underscore/regex punctuation and Unicode; finalization trims outer whitespace only. Invalid path/control fields are still rejected server-side. New-post title suggestions retain their separate existing behavior. | Four pure/server-policy compatibility cases plus browser blur regression prepared. |
| Terminal JSON actions reached router/window callbacks with unsafe executable schemes and arbitrary action shapes | Runtime parser supports existing array/string-JSON action formats, validates each action and safe URL/media targets; engine registration rejects an invalid command before any action runs. Typed hook parsing removes unsafe casts/alias coercion and obsolete global debug exposure. | Direct engine rejection of javascript/data/control-character URLs and malformed actions; valid print/navigation/media compatibility tests. This is not a shell execution feature. |
| Post-list duplicate mutation protection depended only on asynchronously rendered state | Ref guard now blocks duplicate in-flight list PATCH/DELETE calls, retaining pending UI state. | Type/compile checks; existing browser status/list flow remains prepared. No server idempotency promise. |
| Large/fractional offsets could yield unsafe numeric database range endpoints | Admin posts and public project offsets now require safe nonnegative integer endpoints including limit arithmetic; invalid values fall back to zero. Removed unnecessary list callback any annotations. | Four real-Next admin catalog boundary cases; existing public project pagination suite retained. |
| Project PATCH malformed JSON/state could fail unpredictably and leak raw errors | Reject malformed object/unsupported publication state, keep existing URL sanitization behavior, use typed patch and generic JSON errors. | Null/array/unknown/null-state rejection cases plus existing project sanitizer tests. |
| Decorative homepage canvas kept scheduling frames under reduced motion/hidden tabs | Stops continuous RAF while reduced motion is requested or page hidden; refresh/resume listeners clean up. No visual redesign. | Source/TypeScript/compile checks only; browser frame/CPU behavior unmeasured. |

Security checks were not disabled. No blanket any/suppression was added. One introduced ref-initialization hook diagnostic was caught and corrected to the supported explicit-null lazy initialization pattern before final validation.

## Transaction and storage evidence: unresolved production blockers

The local repository harness now permits deterministic before-query barriers/fault injection. Two new **known-gap tests intentionally reproduce** current defects:

- Replacement can delete existing media references and then fail insertion. The HTTP failure does not restore references.
- Two independent reorder requests can both return 200 and interleave into duplicate idx values. Local UI serialization is not cross-tab/database serialization.

A failed storage upload creates no media row; a successful upload followed by failed row insertion leaves a synthetic object without a record. No speculative S3 cleanup was added. Tests report the failure and orphan risk rather than calling it rollback. Existing public URLs remain accessible independently of parent status; post unpublish/deletion is not object revocation.

Five separate `transaction-contract.test.cjs` cases define proposed rollback/serialization requirements using a test-only cloned/serialized in-memory repository: replacement rollback, shared revision reorder, actor revocation at write, competing owner removals and post/media deletion rollback. **No application route uses that fake transaction engine.** It is not a transaction abstraction over separate Supabase HTTP calls and does not certify actual database behavior.

Production repositories must recheck fresh actor permissions and ownership inside a verified transaction, coordinate a monotonic post/media-set version, lock related rows in a consistent order and enforce owner invariants across all writers. Existing target CAS/owner restrictions remain locally tested; safe owner revocation, actor-revocation races and cross-service publication/outbox work remain unimplemented.

[Neon readiness](NEON_READINESS.md) now adds these exact acceptance gates. No DATABASE_URL values were inspected. Explicit operator confirmation of a dedicated disposable **development branch**, permitted role/data classification and test scope is required before recommending live integration commands. No executable migration or driver dependency was generated.

## Private media and AWS limitations

The read-only audit reports public reads across both website buckets, no publication boundary under `derickgomez-images/*`, an existing processor notification and potential Deep Archive disruption under `standard/`. Application-hidden drafts do not protect known public object URLs. Current direct keys/absolute URLs, public caching, signed PUT claims, orphans and shared references require a coordinated migration.

Created [PRIVATE_MEDIA_MIGRATION_PLAN.md](infrastructure/PRIVATE_MEDIA_MIGRATION_PLAN.md): dedicated private original/variant storage, quarantined upload/finalize, parent-authorized short preview capability or per-request proxy, explicit publication manifests/copies, revision/outbox activation, unpublish/revocation limits, legacy URL preservation, staged migration/rollback, least-privilege role boundaries and schema/testing requirements. It explicitly covers preactivation public-copy exposure and prohibits public fallback for private originals. No account inspection, object copy/deletion, policy/lifecycle/Lambda/CDN change or data inventory was executed.

## Browser diagnosis and exact status

A standalone Node net server failed with `EPERM` at listen for **127.0.0.1:4173**, **127.0.0.1:0** and **::1:0**. This shows the fixed port, fixture bundler and Playwright are not necessary causes. It supports an environment-level loopback/listen restriction; without prohibited escalation, the exact sandbox/OS policy layer cannot be proven. The documented Playwright runner was attempted once in an isolated Phase 3D configuration and failed before tests began. No elevated request, alternate transport bypass, OS setting change or repetitive retries followed.

**57 cases discovered, zero executed, zero fresh screenshots.** Offline real-component JS/CSS compilation passes. Added delayed hydration and legacy-slug blur browser regressions. [PHASE3D_BROWSER_QA.md](PHASE3D_BROWSER_QA.md) gives exact outside-sandbox commands with isolated outputs, expected checks and stop conditions. Historical Phase 3/3B/3C captures were not overwritten and are not current visual evidence.

Fixture scope remains standalone React with synthetic/intercepted third parties, not full Next routing/RSC/Clerk/database/media-provider integration. Mobile/desktop/theme/axe/focus/modal/hydration/console results remain unverified at runtime. Root overflow masks, legacy custom lightbox focus and blog no-JS readability remain follow-up work.

## Dependency review

[PHASE3D_DEPENDENCIES.md](PHASE3D_DEPENDENCIES.md) records installed versions, primary sources, candidate patched targets, applicability limits and compatibility tests. Highest priorities: Next 16.0.7 → supported patched 16.x (November advisory target 16.4.5); Clerk 6.35.6 → at least 6.39.3 with patched backend/shared closure; matched React/ReactDOM/framework RSC review; DOMPurify 3.3.1 → reviewed 3.4.17 candidate. sanitize-html 2.18.1 already contains the reviewed fallback-recursion fix. AWS/Supabase refreshes need a scoped closure review; no advisory-specific minimum was established for them here.

Clerk's matcher advisory is relevant because the code uses createRouteMatcher; fresh application guards remain defense in depth. Combined authorization and opt-in proxy advisories have different prerequisites, not established as enabled here. No claim is made that custom guards fix vulnerable SDK internals. **Explicit approval of a concrete dependency/lockfile change is required before applying it; no changes were applied or approval inferred.** No registry dependency-graph upload/audit or exhaustive transitive vulnerability clearance was performed.

## Code quality and architecture

Lint fell **93 → 78 errors**, warnings remain **5**, with **zero new diagnostic signatures** after final correction. Remaining errors are predominantly legacy explicit-any types. Existing warnings include image-element guidance and an exhaustive-deps warning in the unused duplicate `components/blog/MediaList.tsx`. That older component retains external-backend behavior and no incoming imports were found in source inventory; it was not deleted or broadly refactored. No major formatting changes, framework migration or rule suppression was used to improve counts. A static TypeScript runtime-import graph covered 204 TS/TSX files and found zero cycles; type-only, dynamic and require edges are outside that result.

Cross-phase intentional differences: new blog raster uploads support four types while project presigns support a broader media/file set; neither MIME claim is full scanning. Shared project batch/PATCH validation is now consistent. Admin post status writes require revisions; independent media APIs do not advance the post revision. Publish visibility and storage delivery remain separate architectures. Existing duplicate media DTO definitions and public project detail fetch/retry behavior still merit scoped cleanup, not an unreviewed rewrite.

## Final validation

Logs and machine-readable command exits are under `.artifacts/phase3d/`; no Phase 3C output was overwritten. Provider modules are substituted only in test harnesses, never in the application.

| Check | Exit | Actual result |
| --- | ---: | --- |
| `npm run test:security` | 0 | **218 passed**, zero failed/skipped |
| `npm run test:integration` | 0 | **60 passed**, zero failed/skipped; includes 5 proposed-model cases and known-gap reproduction tests |
| `tsc --noEmit --incremental false` | 0 | Passed |
| `eslint . -f json -o .artifacts/phase3d/lint-final.json` | 1 | **78 errors, 5 warnings**, baseline 93/5 |
| `BLOG_REVIEW_OUTPUT=.artifacts/phase3d/browser node scripts/blog-review-server.cjs --build-only` | 0 | Offline fixture JS/CSS passes |
| `playwright test -c playwright.phase3d.config.ts --list` | 0 | **57 discovered** only |
| `playwright test -c playwright.phase3d.config.ts` | 1 | Blocked at fixture server listen, no browser tests ran |
| `node scripts/phase3c-compile.cjs --phase3d` | 0 | Isolated Next webpack **compile mode only** |
| `git diff --check` | 0 | Passed |
| Targeted source/sensitive-path checks | 0 | No matching secret-pattern files or tracked sensitive paths; not exhaustive scanner certification |

The compile runner retains its preceding filename and now accepts `--phase3d` to select separate staging output. It passes a minimal environment without inherited credentials, disables telemetry, stages only named nonsecret configs/source symlinks and does not load .env files. Normal `npm run build`/prerender was not executed because it loads configured environment/provider paths. Compile-mode success does not certify a deployable final generation or live-provider routes. Advisory research did not inspect local secret values.

## Phase 3D files changed

This manifest is relative to the session start, not HEAD:

- Documentation: `docs/PHASE3D_REVIEW.md`, `PHASE3D_TEST_MATRIX.md`, `PHASE3D_BROWSER_QA.md`, `PHASE3D_DEPENDENCIES.md`, `PHASE4_CINEMATIC_READINESS.md`, `NEON_READINESS.md`; `docs/infrastructure/PRIVATE_MEDIA_MIGRATION_PLAN.md`.
- New policies/helpers: `src/lib/cms/{projectMediaInput,mediaHydration,slug}.ts`; `src/components/terminal/lib/actions.ts`.
- API: `src/app/api/admin/projects/[id]/media/{route.ts,[mediaId]/route.ts}`, `src/app/api/admin/projects/[id]/route.ts`, `src/app/api/admin/posts/route.ts`, `src/app/api/home/projects/route.ts`.
- UI: `src/components/admin/editor/{usePostEditor,useSlug}.ts`, `src/components/admin/posts/{EditPostForm.tsx,usePosts.ts}`, `src/components/terminal/{lib/engine.ts,hooks/useCommandEngine.ts}`, `src/components/home/DotsCanvas.tsx`, `src/components/home/sections/project/lib/types.ts`.
- Verification: `playwright.phase3d.config.ts`, `scripts/phase3c-compile.cjs`, `tests/security/harness.cjs`, `tests/integration/{phase3d,transaction-contract}.test.cjs`, `tests/browser/blog.spec.ts`.

## Phase 4 and production gates

[PHASE4_CINEMATIC_READINESS.md](PHASE4_CINEMATIC_READINESS.md) maps the existing server/client homepage, reusable primitives, editorial queries, theme tokens, breakpoints, accessibility and performance measurement needs. The current homepage remains intact apart from the narrow canvas motion/pause fix. Ready for local design planning, **not** production acceptance.

Before release: approve and validate dependency patches; execute the complete browser/full Next HTTP suite with fresh screenshots; verify private media architecture and legacy derivative availability; confirm a separate development database and implement real transactional repositories; test RLS/owner/publication invariants and storage failure recovery; address remaining accessibility/lint debt. Do not merge new visual work into an assumption of solved object privacy or transaction safety.
