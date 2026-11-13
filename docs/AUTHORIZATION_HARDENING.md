# Phase 2B authorization hardening

> Historical Phase 2B report. See [Phase 2C remediation](SECURITY_REMEDIATION.md) for superseding HTML safety, owner restoration, nullable flags, slug/ID compatibility, bounded pagination and updated validation. The catalog scan and HTML limitation described below are historical.

Branch: `feat/cinematic-redesign`. Implementation is limited to the existing Clerk/Supabase application, shared server policy, synthetic regression tests and this report. No database/schema/provider changes, backup restoration/inspection, authentication migration, deployment or commit occurred. No production credentials or content were used. Earlier discovery documents remain historical snapshots; this report describes the new application behavior.

## Findings and fixes

| Finding | Application change / evidence |
| --- | --- |
| Blog list accepted arbitrary status filters; detail only denied private, exposing draft/archive/unknown states | [Shared blog reads](../src/lib/blog/read.ts) intersect requested states with explicit server permissions, check optional deletion markers, and serialize only allowed fields. [List](../src/app/api/public/blogs/route.ts) and [detail](../src/app/api/public/blogs/[slug]/route.ts) use this boundary; invisible details return 404 with no media/thumbnail/body |
| Disabled profiles were inconsistently checked; admin helpers omitted bans | [Viewer lookup](../src/lib/auth/viewer.ts) reads mutable DB permissions per request; [policy](../src/lib/auth/policy.ts) requires explicit enabled=true and is_banned=false. Missing/malformed flags and failed lookups never grant privileges |
| Page guards accepted whitelist-only users while APIs demanded admin; several admin pages relied only on sign-in/layout | [API guard](../src/lib/admin/requireAdminApi.ts), [page guard](../src/lib/admin/requireAdmin.ts), [dashboard compatibility wrapper](../src/lib/profile/requireAdmin.ts), all admin pages and [layout](../src/app/admin/layout.tsx) share active admin-or-owner rules. Client list pages moved unchanged into page.client files to permit server entry guards |
| Admin profile stub had no guard | [Stub handler](../src/app/api/admin/profile/route.ts) now requires administrator access; it still returns null rather than inventing provisioning behavior |
| User PATCH trusted UI restrictions and permitted owner/role changes by ordinary admins | [User PATCH](../src/app/api/admin/users/[id]/route.ts) denies all self access changes, permits role/owner grants only by owners, protects existing owner accounts, refuses owner revocation, validates types/fields and conditionally guards target writes against concurrent promotion. [UsersTable](../src/app/admin/users/UsersTable.tsx) reflects self/owner/role controls; server checks remain authoritative |
| Two project pages omitted status checks and relied on unknown RLS; soft-deleted public rows could still appear | Both [legacy page](../src/app/[slug]/page.tsx) and [canonical page](../src/app/projects/[slug]/page.tsx) use the same [public lookup](../src/lib/projects/public.ts), check parent visibility before media reads, and render dynamically. Legacy params now use Next 16's promised API |
| Public project metadata/thumbnail paths needed the same deletion rules | [List](../src/app/api/home/projects/route.ts), [detail](../src/app/api/home/projects/[id]/route.ts) and [media](../src/app/api/home/projects/[id]/media/route.ts) require public/nondeleted parents; list counts/pagination apply after visibility filtering. Arbitrary media meta is withheld from public payloads; existing display uses no meta fields |
| Terminal registry published requires_auth media/action URLs to anonymous users | [Registry](../src/app/api/terminal/commands/route.ts) returns auth-required user commands only for active members; banned/disabled/missing-profile sessions receive none. Admin-role commands remain excluded. [Client loader](../src/components/terminal/hooks/useCommandEngine.ts) uses the same-origin endpoint so a legacy API-base variable cannot bypass the new boundary |
| Viewer-specific results could be cached or retain stale publication state | [Response helper](../src/lib/auth/response.ts) sets private/no-store and Cookie/Authorization Vary for personalized read endpoints and auth denials. [Middleware](../src/middleware.ts) prevents shared caching on API/admin/blog responses and rejects browser cross-origin admin mutations while retaining Clerk protection |
| Blog detail searched only the first 25 list results | [BlogView](../src/components/blog/BlogView.tsx) now requests the authorized exact-slug API; older posts remain addressable without loading unrelated bodies |

These are source-level findings verified with synthetic fixtures, not claims of a successful production exploit. All current admin route exports are exercised in the denial suite, including media metadata, uploads/signing and user management. User PATCH uses the same viewer/policy directly because it also needs the actor/target context.

## Effective policy

| Subject | Blog list/detail | Admin pages / APIs | User-management writes |
| --- | --- | --- | --- |
| Anonymous | public only; blog pages still require sign-in/profile | Denied | Denied |
| Active ordinary member | public only | Denied | Denied |
| Active private reader | public/private only | Denied unless also admin/owner | Denied |
| Active whitelist-only profile | No automatic private/editorial privilege | Denied unless also admin/owner | Denied |
| Active role=admin | public/private/draft/archived previews | Allowed | Private grants/bans on other ordinary users only; no role/owner changes, no self edits |
| Active is_owner=true | Same editorial previews | Allowed | May assign role/ownership to other nonowners; no self edits, no edits to existing owners, no owner revocation |
| Banned / disabled / malformed / missing signed-in profile | No blog results/details; protected page denied | Denied | Denied |

Deleted or unknown-status posts are not returned by consumer read APIs even to admins. Existing guarded editorial admin handlers remain able to manage their content. Deletion is recognized by excluded status or nonnull deleted_at/deletion_date, or a nonfalse is_deleted marker. A scheduled deletion marker is conservatively hidden until its semantics are confirmed. Private reading never implies permission to read drafts/archives. Arbitrary status parameters do not expand authority.

Public projects are intentionally public for everyone, including visitors who could sign out of a banned account; private/draft/archived/deleted/unknown projects are absent from both page aliases and public APIs. No private project preview route was added. Public homepage/section data remains intentionally public. Hidden terminal help flags are presentation, not access control.

## Decisions with unconfirmed intent

- Owner-as-administrator matches existing blog/avatar intent; whitelist-only page entry previously conflicted with API denial and is now denied consistently. A distinct whitelist-management capability needs a separately reviewed feature; this phase does not grant it broad administration.
- Ordinary administrators retain private-grant/ban management for other ordinary accounts. Owners alone manage roles or other administrators. Existing owners are immutable through this PATCH, preventing last-owner removal without a transactional schema/workflow change. Owner revocation and own-access edits are intentionally unsupported; no owner bootstrap is provided.
- If no enabled, non-banned owner exists in current data, role administration remains blocked. Likewise null enabled/ban flags deny protected access. Provider data was not inspected or changed to work around this.
- Public blog API access is preserved for public posts; blog pages remain members-only. Admin editorial previews through the consumer detail/list API remain available; private readers receive only published public/private statuses.
- Optional deletion markers are read with parent `*` selections so absent columns do not require a schema migration. Public DTOs explicitly whitelist fields and never serialize whole parent rows. Production column availability/meaning and PostgREST relationships are not confirmed. Blog lists retain the 25-candidate limit; soft-deleted candidates can reduce visible list length. Exact details are independent of that limit.
- Project list candidates are read in batches of 100, filtered before response pagination/counting, to avoid leaking soft-deleted metadata/counts or silently stopping at a default server page. This increases work for a very large catalog; server-side deletion predicates should follow verified schema evidence in a later phase. No schema assumptions were introduced to make tests pass.
- Arbitrary project-media meta is no longer public. Display fields/URLs for authorized public media remain; no current public renderer consumes meta.
- The terminal no longer loads commands from the optional legacy external backend. External backend authorization cannot be secured in this repository. Existing same-origin registry and creative command actions remain, subject to server membership gating.

## Verification and reproduction

All tests use invented identities, content and .invalid URLs. The Node test harness transpiles **real** TypeScript modules using the existing TypeScript dependency, supplies in-memory Clerk/Supabase boundaries, and treats client components as render leaves. Unexpected imports, provider SDK use/signing and network calls fail. This is handler/service/page-guard coverage, not browser, Next server, provider integration or real RLS verification. No test mutates a real database. No test dependency was installed.

Run locally:

```sh
npm run test:security
./node_modules/.bin/tsc --noEmit --incremental false
npm run lint
```

| Check | Result |
| --- | --- |
| [Security regression suite](../tests/security/authorization.test.cjs) | **73 tests passed, 0 failed** |
| TypeScript | Passed, exit 0; no emit or incremental cache writes |
| Baseline lint before code edits | 200 errors, 12 warnings in src |
| Lint after edits, including security tests | 184 errors, 11 warnings; exit 1 from existing debt |
| Full repository `npm run lint` | 184 errors, 12 warnings; the additional warning is unchanged unused autoprefixer in postcss.config.mjs |
| New lint diagnostics | **0** when comparing rule/message/severity/file, accounting for unchanged client-page moves |
| Whitespace check | git diff --check passed |

Coverage includes anonymous/ordinary/private-reader/whitelist/admin/owner/banned/disabled/missing-profile and malformed-flag scenarios; every consumer status; optional soft deletion; list and exact detail with media/thumbnail non-disclosure; old slugs beyond 25 posts; both project page aliases and ID fallback; project batch pagination; all 29 exported methods across 18 admin handlers denied before business data/signing; every admin page/layout; protected blog layout; self/owner/peer role-change rules and concurrent target promotions; DB/auth lookup errors; terminal media actions; cache and origin handling. Tests are in [authorization.test.cjs](../tests/security/authorization.test.cjs) with the closed-boundary [harness](../tests/security/harness.cjs).

Existing lint debt remains predominantly explicit any, plus the previously identified About hook issue, inactivity-watcher prefer-const issue and unrelated warnings. Modified legacy BlogView and terminal client hook still contain pre-existing any diagnostics; new security modules/tests and moved client pages are lint-clean. No failing existing check was suppressed to make the phase pass.

No build/dev server/browser run was performed: Next prerendering or runtime startup can access configured providers. TypeScript + mocks do not prove build/Clerk middleware integration or production schema compatibility. Existing Next/React security-patch debt remains a separate dependency change, not fixed or deployed here.

## Remaining security risks and limits

1. **Previously public object URLs remain public.** The fixes prevent unauthorized API discovery of post/project media and thumbnails; they cannot revoke S3/CDN URLs already known, cached, embedded elsewhere or shared between public/private content. No bucket policies or existing object visibility were verified. A true private-media guarantee requires a later approved object inventory, private bucket/CDN configuration, authenticated signed GET/proxy delivery, and cache/access review. No misleading application-only “private URL” proxy was introduced.
2. **Direct Supabase access is outside these handler guarantees.** Browser anonymous clients still exist for public homepage/resume data; actual production grants/RLS must independently protect all private tables. The historical backup is not evidence of current provider settings. This phase did not inspect or change provider policies, JWT configuration or secrets.
3. **Existing rendered HTML/embeds remain a separate risk.** Project HTML rendering lacks a central server sanitization boundary; blog sanitization/Instagram scripts and embedded third-party media need a distinct content-safety/privacy review. Authorization does not sanitize stored content or make external embeds private.
4. **No transactional cross-service revocation guarantee.** Permission checks use current DB rows on each request; already delivered content/URLs and requests already authorized cannot be recalled. Conditional target predicates protect owner/admin promotion races on this PATCH, but external provider-side writers or future handlers can bypass application conventions. No database constraint/transaction or audit-log schema was added.
5. **Upload validation and legacy login UX remain limited.** Admin guards now enforce bans/roles on upload paths, but type/size/content verification and orphan reconciliation are unchanged. The legacy terminal password prompt/unimplemented login endpoint is not repaired in this phase; it must not be treated as a supported auth path.
6. **Runtime/cache verification is pending.** No provider/browser test, signed-file download, deployed cache probe or live RLS test was permitted. Private/no-store prevents new shared HTTP caching through these routes; existing caches and previously copied URLs are not invalidated here. Session invalidation at Clerk was not configured or exercised.

Phase complete for review. Authentication/database migration and deployment remain out of scope. Any production/provider investigation or private-object rollout requires a separately authorized phase.
