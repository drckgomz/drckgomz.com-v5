# Architecture audit

Audit completed 2026-11-11. Repository: `drckgomz/drckgomz.com-v5`; branch: `feat/cinematic-redesign`. Status: discovery and proposals only; no implementation approval implied.

## Scope and evidence limits

This is a static audit of the checkout: App Router files, route handlers, components, libraries, configuration, dependency manifests/locks, README, and public asset inventory. [ROUTE_MAP.md](ROUTE_MAP.md) inventories every implemented page and HTTP endpoint plus the component/library files. No production database, storage bucket, Clerk tenant, hosting account, DNS configuration, or running application was contacted. Public vendor documentation was consulted separately for architecture evaluation.

There are no checked-in SQL migrations, database schema definitions, RLS policies, triggers, seed data, provider exports, or database-generated types. The eight tables documented in [DATABASE_MIGRATION_PLAN.md](DATABASE_MIGRATION_PLAN.md) are **code-observed tables, not proof of the complete production schema**. Actual data counts, existing accounts, enabled login methods, constraints, bucket policies, and provider configuration remain unknown. No credentials or content were exported. `.env.local` is empty in this checkout; its values were not reproduced. Existing untracked `pnpm-workspace.yaml` was left unchanged.

## Current architecture

| Layer | Observed implementation |
| --- | --- |
| Runtime | Next.js **16.0.7**, React/React DOM **19.2.0**, TypeScript; App Router under `src/app`; no Pages Router |
| Styling | Tailwind 4 PostCSS, `globals.css`, local shadcn/Radix components, hardcoded dark surfaces and accent colors |
| Animation | Framer Motion already installed and used in portfolio sections; canvas dot background and custom terminal/media behavior |
| Identity | Root `ClerkProvider`, Clerk sign-in/sign-up widgets, server `auth()`/`currentUser()`, client hooks and bearer tokens |
| Authorization | Supabase `user_profiles` keyed by Clerk subject; several inconsistent page/API helpers; middleware authenticates `/blog*` and `/admin*` |
| Public data | Anonymous-key Supabase queries in portfolio server components/project APIs; browser query for resume |
| Privileged data | Service-role Supabase clients for blog APIs, profile lookups, admin CRUD, and public terminal registry; authorization largely enforced in application code |
| Files | AWS S3 upload code and public media URL resolution; no Supabase Storage calls observed |
| Hosting | README describes Vercel, GitHub, Route 53; account state and actual deployment are unverified |

Primary flows:

- Homepage → anonymous Supabase section reads; project grid → same-origin project APIs → anonymous Supabase queries. Resume modal queries Supabase directly from the browser.
- Blog → Clerk middleware and profile layout guard → client fetches list API with Clerk token → service-role query plus code visibility checks → HTML/media rendering.
- Admin → page checks where present → client API requests → `requireAdminApi()` → service-role CRUD. Blog edit page also reads content directly on the server.
- Project uploads → admin presign API → browser PUT to S3 → separate database metadata request. Blog upload → multipart route → S3 PUT → database metadata insert.
- Terminal → public registry endpoint (or configured legacy backend) → client command engine → navigation/media callbacks and client-side rate limits.

## Authentication and authorization dependencies

[AUTH_EVALUATION.md](AUTH_EVALUATION.md) contains the replacement assessment. The full Clerk-import file inventory is also in [ROUTE_MAP.md](ROUTE_MAP.md).

| Entry point/helper | Actual behavior |
| --- | --- |
| `src/middleware.ts` | Clerk middleware executes for broad paths; `auth.protect()` only for blog/admin page prefixes, **not** `/api/admin/*` |
| `src/lib/profile/getUserProfile.ts` | Looks up current Clerk ID with service role, requires `enabled=true`; returns role/owner/whitelist flags, **omits ban status**; errors become null |
| `src/lib/profile/requireUser.ts` | Requires session and profile, rejects banned unless explicitly allowed; **does not check enabled** |
| `src/lib/profile/requireAdmin.ts` | Requires enabled profile; role must equal admin; returns `isAdmin=false` rather than denying directly |
| `src/lib/admin/requireAdmin.ts` | Requires enabled profile; allows admin **or owner or whitelist admin**; no ban check |
| `src/lib/admin/requireAdminApi.ts` | Requires enabled profile and role exactly admin; no ban check; API callers must handle returned denial response |
| `/api/public/blogs*` | Independently reads role/owner/private/ban flags; no enabled check; private permission = explicit grant or admin/owner |
| Settings | Requires enabled profile but no ban check; editing form calls an unimplemented PUT method |
| UI | Navbar/avatar use differing role tests; footer reads a localStorage admin flag; terminal admin state is fixed false. UI flags are not server authorization |

Clerk account provisioning into `user_profiles` is not implemented in this checkout: no webhook receiver, sign-up synchronization, or profile-creation path was found. A successful Clerk sign-up may lack an application profile; whether external automation fills it is unknown. Supabase Auth login/session exchange is not implemented; anonymous clients do not receive a Clerk-to-Supabase JWT here.

## Prioritized debt and risks

| Priority | Finding and code evidence | Future acceptance condition |
| --- | --- | --- |
| P0 | Blog list accepts arbitrary `status` and only excludes `private` for unprivileged viewers; slug API rejects only private. Drafts/archived can be disclosed through APIs (`api/public/blogs/*`) | Deny by default; explicit published/private policy applied to list and detail; fixture tests for all statuses/viewers |
| P0 | Banned enabled admins can pass admin helpers; owner/whitelist page permissions differ from APIs; user PATCH permits owner/role changes for any accepted admin (`api/admin/users/[id]`) | One server capability policy, ban/disabled deny first, owner-only sensitive changes, last-owner protection; do not treat UI-disabled controls as enforcement |
| P0 | Both project detail pages omit explicit public-status denial; anonymous key/RLS may protect them, but policies are absent (`app/[slug]`, `app/projects/[slug]`) | Public predicate in query/service and known database grants; verify private/draft pages and media with synthetic fixtures |
| P0 | Package pins Next 16.0.7, below later security fixes in its release line | Review current official advisories and choose a supported patched Next/React pair before any future release; no upgrade made here |
| P1 | Project HTML is rendered directly in page/dialog components; API saves arbitrary content, despite a comment claiming prior sanitization | Shared server-side sanitization, permitted embed hosts/schemes, consistent safe preview/public rendering |
| P1 | Terminal registry exposes actions for `requires_auth=true` commands; auth/rate limits exist only in browser engine | Sensitive action data resolved through authenticated server requests; hidden/help flags never used as privacy |
| P1 | Blog detail fetches first 25 list rows and searches locally, ignoring existing slug API (`BlogView`) | Exact slug fetch; pagination; old posts remain reachable |
| P1 | Project replace deletes metadata before validating/inserting replacement; several delete/reindex flows lack transactions or ignore child errors | Atomic database changes and explicit failure handling; separate object cleanup workflow |
| P1 | S3/database writes are separate, uploads lack robust size/content validation; deletes remove rows, not S3 objects | Validated upload/finalization state, reconciliation, private delivery; see media audit |
| P2 | Profile save PUT missing; project create link has no dedicated page/POST; homepage admin and bug dashboard absent | Implement or remove promises only after approved feature scope |
| P2 | Split legacy API variables/paths, inactive proxy artifact, old comments and localStorage auth remnants | One typed same-origin API contract; retained legacy behavior identified explicitly |
| P2 | `any` pervasive; duplicate media URL resolvers/types and Supabase factories; JSON strings accepted alongside objects | Typed domain/schema contracts and normalized boundary parsing without lossy migration |
| P2 | No checked-in test suite/CI workflow observed; README overstates features and blog static generation | Offline permission/route/data tests plus later isolated integration/accessibility checks |
| P2 | Responsive work exists but reduced motion is inconsistent; terminal disables zoom | Accessible motion defaults, pause controls, restored zoom and keyboard/mobile testing |

Severity reflects source-level risk; no exploit requests or production exposure validation were performed. Changing database providers alone fixes none of these permission issues.

## Next.js 16 and tooling

- `app/[slug]/page.tsx` still uses synchronous `{params:{slug:string}}` and `params.slug`; Next 16 requires promised params. Most other dynamic handlers already await params. The offline TypeScript result does not establish Next-generated route type/build correctness.
- `middleware.ts` naming is deprecated in Next 16; migrate its Clerk behavior deliberately to `proxy.ts` later. `src/proxy.ts.off` is **inactive**, a generic legacy backend rewrite, and must not be activated as an auth replacement. It is oddly listed in `tsconfig.json` include patterns.
- `reactCompiler:true` is enabled. An ESLint hook error in About needs review; compiler performance and behavior have not been runtime-tested.
- Tailwind v4 is installed; legacy config and unused animation packages coexist. `prose` classes occur without an installed typography plugin. Verify rendered output before changing styling dependencies.
- Both npm and pnpm lockfiles are tracked, no `packageManager`/Node engine pin is declared, and the pre-existing untracked workspace file contains placeholder build approvals. Resolve reproducibility separately; minimum Next 16 runtime is Node 20.9 and TypeScript 5.1. [Next 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16).
- Next 16.0.7 is below the 16.0.10 fixes listed in the December 2025 RSC advisory. That historical minimum is **not a recommendation for the current latest secure version**. [Official security advisory](https://nextjs.org/blog/security-update-2025-12-11).

## Environment and services

Names only; presence in code does not prove deployment configuration. Public-prefixed values are client-visible.

| Variable | Use / boundary |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Required by root provider; public identity configuration |
| `CLERK_SECRET_KEY` | Clerk server SDK convention; not explicitly read in source, required to review for deployed SDK/server operations; value uninspected |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonymous server/browser reads; access depends on external grants/RLS |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Privileged server access; never client props or public variables |
| `NEXT_PUBLIC_S3_MEDIA_BASE` | Public CDN/bucket base; several inconsistent legacy fallbacks |
| `AWS_REGION`, `S3_BUCKET` | S3 configuration; blog region defaults to us-east-1, presign requires it |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Explicit presign credentials; blog uses SDK default chain. No credentials recorded |
| `S3_MEDIA_PREFIX` | Blog key prefix; defaults to blog-images |
| `NEXT_PUBLIC_API_BASE` | Legacy admin post/media helpers and disabled proxy; some localhost:3001 fallbacks |
| `NEXT_PUBLIC_API_BASE_URL` | Optional legacy terminal `/v1/public/terminal/commands`; required by footer bug-report submission |
| `NODE_ENV` | Development-only presign error stack exposure |

External integrations: Clerk; Supabase PostgREST; S3 and legacy S3 URLs; YouTube embeds/thumbnails; Instagram embed script; Microsoft Office online DOCX viewer; Gmail compose UI; social outbound links; placeholder image host; optional separate `/v1` backend not included here. README hosting claims are not verified. Contact opens Gmail; it is not a server email delivery service. No Neon, Drizzle, Better Auth, or Auth.js integration is present.

Proposed future configuration (names only, **not added**): server database runtime/migration URLs, Better Auth secret/base URL or Auth.js secret, GitHub/Google client credentials, transactional email transport, optional S3-compatible endpoint/path-style configuration and rate-limit storage. Separate local/test/preview/prod configuration; fail closed for missing server secrets.

## Safe verification performed

- `./node_modules/.bin/tsc --noEmit --incremental false`: exit 0 using existing dependencies/generated types.
- `./node_modules/.bin/eslint src --format json --output-file /tmp/drckgomz-architecture-eslint.json`: **200 errors, 12 warnings**. Errors: 198 explicit-any, one `react-hooks/set-state-in-effect` (About client), one `prefer-const` (inactivity watcher). Warnings include unused variables, img usage, hook dependency, and an unused disable directive.
- Route/source inventory and documentation links checked offline; no dependencies installed, no app server started, no provider CLI/API used.
- No build run: prerendering home server components could read configured remote data, and this phase is offline. No browser, production security probe, integration test, or live schema validation performed.

## Review decisions

Approve a future implementation scope separately: urgent permission/security corrections; Better Auth versus Auth.js; canonical role/private-content matrix; public versus members-only blog pages; identity recovery/linking policy; Neon region/runtime/driver; S3 retention/private delivery; editorial/design direction; downtime and rollback thresholds. [REDESIGN_ROADMAP.md](REDESIGN_ROADMAP.md) orders these gates. No provider actions are authorized by this audit.
