# Phase 3D integration matrix

Current executed results: **218 security/CMS and 60 integration/model tests**, no failures/skips. Browser: **57 discovered; zero executed**. All provider identities/content/storage are synthetic. `next-contract.test.cjs` and `phase3d.test.cjs` use real NextRequest/NextResponse and real application modules with in-memory SDK repositories; no HTTP server or database. The five transaction contract cases are design-model tests only.

| Boundary / workflow | Evidence | Limits |
| --- | --- | --- |
| Admin/owner/member/banned/disabled/self/nullable permissions | Existing authorization/remediation security matrix; Phase 3D project media PATCH permission cases | Fresh app guards executed; live Clerk matcher, tokens/RLS and atomic last-owner protection not certified. |
| Draft → publish → published update → unpublish/private/archive/delete | Existing `next-contract` lifecycle and stale-editor tests | Application states/DTO privacy verified against mocks; object URLs/caches do not become private. |
| Simultaneous publish/unpublish from one revision | Phase 3D two-request barrier test | Exactly one successful write, one 409 under mock predicates; real SQL isolation not proven. |
| Private preview data | Phase 3D anonymous/member/disabled-admin/admin GET cases | Current admin DTO authorization tested. Proposed signed private-media preview endpoint is not implemented. |
| Stale/missing/null revisions and slug/legacy URL compatibility | Existing CMS/Phase 3B tests; four Phase 3D slug-preservation cases plus browser blur case | Timestamp CAS remains; media transactions and external writers are separate. |
| Project media batch and PATCH validation | Phase 3D malformed fields, schemes, effective existing embed type, parent scope and field-race tests | Same shared validator used by both write paths; caption-only legacy edits allowed; no new schema. |
| Media association changes | Existing Phase 3C scoped reorder test + Phase 3D PATCH changed-field conflict | Mock target predicates verified; actor revocation and real transaction locking still open. |
| Editor media hydration after upload/order/slug change/unmount | Phase 3D deterministic asynchronous helper tests; new browser delayed-upload case | Helper executed with actual Request/Response-shaped fetch contracts; React/browser event ordering still blocked. |
| Storage failure before record creation | Phase 3D synthetic S3 failure | 500/generic error, no row written. Real SDK never loads. |
| Record failure after storage upload | Phase 3D injected insert failure | Test intentionally confirms one stored synthetic object and no DB row: orphan reconciliation remains necessary. |
| Project replacement deletion failure | Existing Phase 3C guard tests | Stops insert/parent deletion after failed child removal. |
| Project replacement insertion failure | Phase 3D known-gap test | Test intentionally reproduces prior reference deletion: no rollback guarantee in current route. |
| Independent concurrent reorders | Phase 3D controlled interleaving | Test intentionally reproduces duplicate idx values; local UI serialization is not cross-client locking. |
| Proposed rollback/serialization/owner contracts | Five `transaction-contract.test.cjs` cases | Test-only clone/serialized repository demonstrates requirements. No production adapter uses it; not proof current routes are atomic. |
| Malicious/invalid embeds and stored action navigation | Existing HTML/iframe parser security tests; Phase 3D direct terminal engine unsafe URL/action cases | Unsafe command registration rejects; valid JSON/text actions retained. Real browser provider embeds remain intercepted/unexecuted. |
| Pagination bounds | Existing large catalog fixtures + Phase 3D unsafe/fractional offset cases | Safe integer query endpoints; actual DB plans and offset page drift unverified. |
| Upload MIME/bytes/multipart/caption/order | Existing Phase 3C 44 added tests retained | Signature screening is not full decoding/scanning; presigned project uploads cannot verify actual bytes. |
| Theme/mobile/focus/keyboard/consent/modal | Existing 55 browser cases plus delayed hydration and legacy-slug cases | 57 discovered/compiled only. Zero current axe/visual/browser passes or fresh screenshots. |
| Canvas reduced-motion/hidden-tab behavior | Source review, TypeScript and Next compile | No runtime frame/CPU measurement; manual motion/visibility testing remains required. |
| Build/type/lint/secret check | `.artifacts/phase3d/` logs and review table | Compile mode does not finalize/prerender; lint debt remains and no full provider integration was attempted. |

New files: `tests/integration/phase3d.test.cjs` (47 cases), `tests/integration/transaction-contract.test.cjs` (5 cases); existing eight Next integration tests retained. Referenced security files live under `tests/security/`; the browser suite is `tests/browser/blog.spec.ts`.

Passing known-gap/model tests are explicitly not security sign-off for those gaps. Before live integration, obtain confirmation of a dedicated disposable Neon development branch and separately approved synthetic test scope. See [review](PHASE3D_REVIEW.md), [browser runbook](PHASE3D_BROWSER_QA.md), [Neon checklist](NEON_READINESS.md) and [migration proposal](infrastructure/PRIVATE_MEDIA_MIGRATION_PLAN.md).
