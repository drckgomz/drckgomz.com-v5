# Phase 3C test matrix

2026-11-11. Executed locally: **218 security/CMS + 8 integration tests**. Browser: **55 discovered, zero executed**, blocked by fixture server loopback EPERM. Integration uses real Next request/response classes and in-memory SDK boundaries; it is neither real HTTP nor database verification. All identities, files and content are synthetic.

| Feature / boundary | Test evidence | Status and missing coverage |
| --- | --- | --- |
| Anonymous/member/admin/owner access, banned/disabled/null flags | `security/authorization.test.cjs`, `remediation.test.cjs`; integration unauthorized PATCH cases | Executed. Live Clerk cookies/recovery, middleware transport and deployed profile policies unverified. |
| Owner self-protection, promotion/restoration, target snapshot changes | Authorization/remediation owner cases | Executed. Atomic last-owner/actor-revocation invariants need a verified database transaction. |
| Same-origin mutations and private/no-store | Authorization middleware cases; `phase3c.test.cjs` cross-site Fetch Metadata cases | Executed as direct middleware calls. Real proxy/origin/header behavior not certified. |
| New post defaults to draft; duplicate slug errors | `cms.test.cjs`; integration lifecycle | Executed. Uniqueness/collation mocked; no real concurrent creation or server idempotency guarantee. |
| Draft/private/archive privacy across status transitions | Authorization status matrix; integration lifecycle and stale unpublish case | Executed. CDN/object/RSC cache privacy not tested. |
| Update published content, unpublish, archive | `cms.test.cjs` status cases; `next-contract.test.cjs` lifecycle | Executed with revision advancement and anonymous visibility checks. |
| Missing/stale/null revision and concurrent editing | CMS + Phase 3B revision tests; integration stale republish | Executed, including simulated changed-row predicates. Multi-client HTTP/DB behavior still requires staging. |
| Missing post, no implicit recreate | CMS PATCH tests | Executed. Real deleted-row races remain a transaction concern. |
| Empty title/slug, unsupported fields/status, invalid dates, content/URL limits | CMS + Phase 3B input cases | Executed. JSON request stream itself is not capped globally; per-field limits are not infrastructure request quotas. |
| Literal Unicode/percent/regex slug, slugless legacy ID, ambiguous matches | Authorization/remediation + Phase 3B tests | Executed. Real PostgREST version, indexing/collation and deployed redirects unverified. |
| HTML XSS, unsafe styles/schemes, SVG/MathML/forms, iframe host/path, legacy placeholders | Remediation/CMS + Phase 3B sanitizer cases | Executed using real server sanitizer. Browser DOMPurify parity, malformed DOM and real legacy visual fidelity remain browser gates. |
| Unpublished preview without mutation | Existing browser editor preview cases | Prepared, unexecuted. Server draft access is executed in authorization suite. |
| Instagram consent and native disclosure | Browser consent/mixed/gallery tests | Prepared, unexecuted; providers are intercepted synthetic stand-ins. Real script failure/consent lifecycle needs manual review. |
| Blog upload authentication before body parsing | Phase 3C unauthorized upload case | Executed, rejects without parsing/writes. Live provider denial not exercised. |
| Blog upload stream/file limits and MIME/signature checks | Phase 3C declared/actual byte limit, duplicate multipart, malformed/truncated/empty/HTML/SVG/mismatch cases | Executed. No image decoder, full-file integrity, malware, dimension/decompression, rate-limit or slow-client certification. |
| Screened upload, canonical filename, record association | Phase 3C mocked upload success | Executed with explicit in-memory S3 command recorder; real S3 SDK is never loaded. No bucket write or object-policy test. |
| Upload/API failure messages | Phase 3C upload and presign error cases; real Next multipart error contract | Executed. Orphans after storage success/record failure and unknown retry outcomes remain open. |
| Presign object path/MIME validation | Phase 3C path traversal/HTML/SVG rejection cases | Executed before SDK construction. Byte/size enforcement, parent existence and signed-header CORS behavior need separate staging review. |
| Caption length/type/allowed fields, literal media IDs | Phase 3C caption/link cases | Executed; global admin scope retained. Caption CAS/history is not implemented. |
| Caption failure retains draft without resetting other media | New browser keyboard/caption case | Prepared, unexecuted. Functional state update compiles; real event ordering remains a browser gate. |
| Shared media normalization and hostile URLs | Phase 3B + Phase 3C normalization cases | Executed. Malformed rows drop, active URL schemes reject; private object delivery is separate. |
| Media reorder aliases, duplicates, bounds, foreign IDs | Phase 3C parser and route cases | Executed. 1,000-item limit; partial lists retain remaining rows in prior order. |
| Reorder successful writes and ownership race | Phase 3C scoped update/moved-row cases | Executed with mock query predicates; no upsert or insert. Atomicity and simultaneous tab edits remain open. |
| Keyboard reorder and saved/failed status | New browser keyboard/caption case | Prepared, unexecuted; local request serialization does not promise cross-client concurrency control. |
| Post delete stops on media failure | Phase 3B failed removal; integration lifecycle delete | Executed. Actual cascades/object deletion/transaction rollback are not covered. |
| Project media replacement validates before deletion; stops on child failure | Phase 3C replacement/parent delete cases | Executed. Insert failure after successful replacement delete still needs transaction support. |
| Admin catalog pagination/filter/error handling | Phase 3B 1,200-row and failure tests; integration bounded projection | Executed. Browser list navigation prepared. Search is current-page only; child media cardinality is not bounded by root page size. |
| Public project pagination and deleted/private rows | Remediation/authorization large shuffled fixtures | Executed. Real SQL plans and schema-dependent deletion filters unverified. |
| Public project iframe restriction | Shared exact-host parser tests + new project-carousel browser case | Parser executed; component DOM case prepared only. New fixed frame attributes are compile-verified, not browser-verified. |
| Terminal blog authentication path | New Phase 3C real engine case | Executed: guarded navigation, no credential prompt/token storage. Clerk redirect and terminal keyboard UX still need browser testing. |
| Theme scopes, nested light/dark, focus, reduced motion, 320–3840px overflow | Existing browser theme/responsive/axe cases | Prepared, unexecuted. CSS compiles offline; no current contrast, axe or visual pass claimed. |
| Forms, retained save input, duplicate buttons and media failures | Existing create/save/conflict + new rejected-image browser cases | Prepared, unexecuted. Duplicate local request guards are not server idempotency. |
| About eager media loading and reduced motion | Source review, TypeScript, compile-mode build | No runtime performance measurement. Custom lightbox accessibility is explicitly outstanding. |
| Build/type/lint/import cycles/sensitive paths | Phase 3C final logs, `source-audit.json`, lint JSON snapshots | Type/compile pass; lint 93 errors/5 warnings. Static import graph has zero cycles; targeted source scan has zero matches, not exhaustive audit certification. |

Test paths are relative to `tests/`. See [review](PHASE3C_REVIEW.md) for exact commands/exits, findings and scope, and [browser runbook](PHASE3C_BROWSER_QA.md) for the remaining runtime gate. A prepared test or successful discovery is never counted as a passing test.
