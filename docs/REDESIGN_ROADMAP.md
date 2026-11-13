# Redesign roadmap

Date: 2026-11-11. This is a phased proposal for review, not implementation or production authorization. Keep the existing Next App Router/React/TypeScript/Tailwind/shadcn/Framer Motion foundation. Prefer Neon + Drizzle and provisionally Better Auth, subject to the proof of concept in [AUTH_EVALUATION.md](AUTH_EVALUATION.md).

## Creative direction

Build a personal entrance into Derick's work: fullscreen film/video, restrained typography and simple text navigation to writing, projects, terminal and contact. Keep the homepage quiet enough that the media, name and voice carry it. Let music, film, code and hidden terminal discoveries coexist; preserve real project stories and the distinction between public work and personal writing. Avoid stock business copy, fabricated metrics and a wall of generic service cards.

Use a muted video with a strong still poster and a readable text layer. Text remains selectable and useful when media fails. Keep a compact mobile menu with explicit labels and a persistent route back home. The terminal remains an optional expressive interface; visitors can reach essential pages without knowing commands.

## Proposed structure

- `/`: fullscreen media entrance with editable introduction and minimal text navigation; approved content can lead into selected projects/about/contact without forcing a long scroll.
- `/projects/[slug]`: canonical durable project stories; retain legacy `/<slug>` aliases until approved redirects can preserve inbound links. A `/projects` listing is proposed, not implemented today.
- `/blog` and `/blog/[slug]`: personal writing with clear audience labels; anonymous public-page access remains undecided. Never index or cache private previews publicly.
- `/terminal`: preserve aliases/easter eggs and audio/video; route authentication to the standard sign-in UI; privileged command data stays server-side.
- `/admin`: working editorial control for homepage/media, blog, projects, terminal, permissions and approved theme settings. Bug management is optional pending a decision about the missing legacy backend.
- `/settings`, sign-in/up, recovery, passkey and banned experiences: explicit, accessible account lifecycle flows with durable identity mapping.

## Implementation order, dependencies and review gates

| Milestone | Scope of a future implementation | Depends on | Completion evidence / risk |
| --- | --- | --- | --- |
| 0. Approve baseline | Decide policy matrix, public blog behavior, auth direction, provider budget/region and recovery strategy | Review all six documents | Written decisions; no provider changes implied |
| 1. Stabilize existing app | Patch supported Next/React versions, unify server authorization, deny unpublished API access, enforce project status, secure HTML, repair async params and inactive-proxy confusion | Approved correction scope | Offline synthetic permission matrix, route tests, type/lint baseline; keep Clerk protections. Privacy regressions are highest risk |
| 2. Establish typed data boundary | Domain services/repositories, schema capture plan, response contracts, resume API/server data, package manager/version consistency | Policy and baseline | All eight observed tables/query callers accounted for; no client DB credentials; provider remains Supabase |
| 3. Rehearse Neon + Drizzle | Approved schema inventory, reviewed SQL, local synthetic fixtures and later separately approved isolated import | Schema/policy evidence and driver choice | Count/hash/FK/status/order parity and restore test; preserve raw data |
| 4. Change database independently | Explicit cutover approval, consistent copy/write freeze, reconciliation, single-writer switch and monitoring | Successful isolated rehearsal | Existing Clerk identities and permissions still work; rollback handles new writes |
| 5. Prove and replace auth | Better Auth proof of concept; email recovery, OAuth/passkeys, mapping/provisioning; later controlled enrollment/cutover | Owner-approved auth plan; stable data layer | No password portability assumption; owner access, bans, role changes and revocation verified; Clerk retained until rollback window ends |
| 6. Build editorial foundation | Homepage content/media editor, previews/revisions, media catalog/finalization, finish project create and profile save; safe content renderer | Stable policy/data services; storage privacy decision | Preview/publish/rollback and failure states tested; existing content untouched until deliberately edited |
| 7. Ship visual slices | Design tokens → fullscreen homepage/text nav → project stories → blog → terminal → admin refinements | Approved visual/content direction and editor model | Keyboard/mobile/reduced-motion/media-failure checks per slice; preserve routes and identity |
| 8. Observe and retire | Performance/accessibility review, recovery/restore drills, legacy-route verification, dependency cleanup | Parity and agreed observation window | Separate approval before provider retirement/account/object deletion; no deployment done in this phase |

Security/compatibility corrections should precede aesthetic work. Visual prototypes can later use synthetic fixtures without waiting for production migration, but keep them independent of auth/data cutover. Each milestone should be reviewable as a bounded change; avoid a single rewrite that changes design, identity, data and storage together.

## Design system and editorial model

Start with existing CSS variables and shadcn components. Define typography, spacing, foreground/surface/accent, radius and motion tokens; expose a curated set of presets and validated values in admin. Persist versioned theme settings with preview and rollback. Do not let admin enter arbitrary JavaScript/CSS or change semantic roles through theme controls. Choose actual fonts, color range and degree of visual customization during visual review; no new imagery is needed for this audit.

Model homepage content separately from presentation: title/intro, navigation labels and destinations, featured items, selected video/poster/variants, crop and display rules. Require alt text for meaningful images and captions/transcripts for meaningful audio/video. Preserve existing section content and resume variants; editor changes should not erase unused fields.

## Motion, accessibility and mobile acceptance

- Muted inline video may autoplay only with a usable poster and visible pause/play control; honor reduced motion and data-saving preferences and pause when offscreen/backgrounded. No sound starts without user action.
- Use transform/opacity transitions for brief orientation cues; global reduced-motion behavior must cover Framer Motion, CSS, canvas, terminal typing and background media. Current project thumbnail handling is only partial coverage.
- Maintain readable contrast over every selected video frame, semantic headings/links, visible focus, skip navigation, accessible dialog focus/escape and keyboard access. Restore terminal pinch zoom; avoid scroll/keyboard traps.
- Verify narrow 320–390px layouts, touch targets, safe areas, dynamic viewport/mobile keyboard behavior, large text/zoom, landscape and no-video/offline-media states. Essential navigation/content must not depend on hover, sound, motion or command memorization.
- Set explicit performance budgets during visual approval: poster/LCP, video transfer and variants, interaction latency and cumulative layout shift. Measure in isolated preview before accepting; do not promise unmeasured scores.

## Validation strategy

Use synthetic visitor/member/private-reader/admin/whitelist/owner/banned/disabled/missing-profile identities and public/private/draft/archived fixtures. Cover both page and direct API access, associated media, terminal action disclosure, role changes and session revocation. Verify exact old slugs and posts beyond the first 25. Add meaningful integration tests for atomic ordering/replacement and upload-finalization failures after an isolated database is authorized.

A future release needs Next-generated route type checks and a build configured against local fixtures, not accidental production prerender reads. Then perform responsive, keyboard, screen reader, reduced-motion and media-failure review. Current audit only ran offline TypeScript and ESLint; neither is evidence of a production-ready app.

## Decisions requiring owner approval

| Decision | Proposed default | Why it matters |
| --- | --- | --- |
| Identity library | Better Auth after proof of concept; Auth.js retained as alternative | Password lifecycle/passkeys/admin fit and ongoing operations |
| Login methods | Verified email/password plus selected GitHub/Google; passkeys after recovery test | Mail delivery, OAuth setup and enrollment burden |
| Legacy accounts | Preserve IDs/permissions via mapping; verified enrollment/reset | Passwords, sessions and factors cannot be presumed portable |
| Roles | Owner-sensitive changes; separate content admin and whitelist capabilities | Existing checks conflict; avoid accidental escalation |
| Blog audience | Preserve members-only page behavior until explicitly changed; fix API leaks | Public writing UX/SEO versus personal audience control |
| Private media | Authenticated signed delivery; retain public assets as public | Database privacy does not secure public object URLs |
| Database | Neon/Drizzle, runtime/region/driver selected after schema review | Transactions, latency, budget, extensions, backup/restore |
| Storage | Keep S3 initially; endpoint abstraction only if needed | Avoid moving media and databases simultaneously |
| Visual direction | Film-led personal homepage, minimal text navigation, subtle motion | Owner selects footage, typography and voice; no generic portfolio template |
| Admin customization | Curated design tokens + revisioned content, no arbitrary code | Prevent unsafe customization and accidental publication |
| Legacy gaps | Finish project creation/profile save; decide home/bug backend scope | Existing links/UI promise unsupported capabilities |
| Cutover | Short editorial freeze, one writer, explicit rollback criteria | Prevent split data and lost permission/content updates |
| Production actions | Separate approval for access/export/provisioning/cutover/deployment/retirement | None is authorized or performed by this planning phase |

## Principal risks

The largest risks are disclosure of personal drafts/media, owner lockout, incorrect identity merging, unknown provider-side schema/RLS, and data divergence during rollback. Mitigate with policy tests, stable mapping, verified recovery, authorized schema evidence and one-writer rehearsals. Other risks include orphan uploads, invalid historical URLs/JSON, third-party embed availability, video transfer costs, insufficient motion accessibility and editorial scope expanding into a general CMS. Preserve content first; add new editorial capabilities incrementally.

For supporting evidence and operations details see [ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md), [DATABASE_MIGRATION_PLAN.md](DATABASE_MIGRATION_PLAN.md), [CONTENT_AND_MEDIA_AUDIT.md](CONTENT_AND_MEDIA_AUDIT.md) and [ROUTE_MAP.md](ROUTE_MAP.md). Stop here for review; this phase does not start any milestone implementation.
