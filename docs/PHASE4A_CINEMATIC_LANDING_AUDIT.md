# Phase 4A — Cinematic Landing Page Audit and Implementation Plan

**Status:** Read-only frontend audit and planning. No application code, media, backend, external service, or existing work was changed in this phase. The only intended addition is this planning document. This is not approval to begin Phase 4B implementation.

## Executive summary

The current homepage is a dark, vertically scrolling portfolio assembled from a CMS-backed hero, About, Projects, Experience, Skills, and Contact sections. It uses a dot-field canvas, Framer Motion entrances, a fixed navigation bar, project pagination, and a CMS-configured portrait/image carousel. It is functional foundation for a personal portfolio, but it is not the requested cinematic/editorial experience: there is no bundled travel footage, no travel/photography route, and the navigation does not link to Journal/Blog or Travel.

The site already has reusable project and blog presentation components and a substantial CMS-managed content model. Phase 4B can therefore focus on a presentation-layer route and component redesign while retaining current content sources and URLs. Avoid a data migration in this phase. First inventory and curate the four location video clips and still-image fallbacks; none of those video assets are currently present in `public/`.

The existing `/terminal` experience should remain intact and discoverable through a deliberate low-key Easter egg. The working tree is on `feat/cinematic-redesign` and contains extensive uncommitted work across backend, CMS, auth, styles, and several frontend files. Treat all current changes as pre-existing and preserve them. In particular, do not overwrite the modified homepage sections, project components, global styles, blog components, auth/layout work, or any media references while implementing a future phase.

## Audit scope and repository state

- Branch observed: `feat/cinematic-redesign`.
- Working tree: heavily modified, with uncommitted tracked and untracked files, including existing frontend changes. This audit did not edit or clean the tree.
- No root `AGENTS.md` was found during the local inventory.
- Framework: Next.js App Router, React 19, Tailwind CSS 4, Framer Motion; source is under `src/app` and `src/components`.
- Theme CSS is split between `src/styles/themes.css`, `src/styles/blog.css`, and `src/app/globals.css`.
- `public/` contains the default Next.js SVGs and `resume.pdf`; no `.mp4`, `.webm`, `.mov`, or `.m4v` files were found. Existing travel/lifestyle imagery is not bundled in the repository and appears to be CMS/object-storage referenced.
- This was a static source inventory. Routes were not launched or visually exercised in this read-only planning phase.

## Current implementation assessment

| Area | Current state | Gap against target |
|---|---|---|
| Homepage | `src/app/page.tsx` renders NavBar, DotsCanvas, Hero, About, Projects, Experience, Skills, Contact in a long scroll layout. | No full-screen video sequence, editorial content pacing, or location storytelling. Existing section ordering should be reconsidered as design, not removed as data. |
| Hero | `HeroSection` reads `home_sections.key='hero'`; client renders title, description, circular avatar/image, crop settings, and entrance motion. | CMS image is a portrait-style focal image rather than a video/poster manifest. Image failure currently points to a remote placeholder, which should be replaced with a local/resilient fallback during implementation. |
| Navigation | `NavBar` has About, Projects, Contact, and a direct “TERMINAL” link; it hides on scroll and has a full-screen mobile menu. | Missing Journal and Travel; terminal is too prominent for the requested Easter egg. The current at-top-only visibility can leave long-page visitors without navigation. Mobile dialog lacks a complete focus/escape/focus-return contract in the inspected implementation. |
| Projects | Project section uses an API-backed paginated grid; cards open `/projects/{id}`. Project detail reads by slug or ID and renders media carousel, external link, sanitized project HTML. A second root catch-all route also resolves project content. | Editorial case-study hierarchy and image storytelling are not yet unified; duplicate-compatible project URL routes require regression protection. |
| About / photography | About reads CMS section and ordered `home_media`; client supports a carousel and lightbox with responsive image sources. | It is a single About carousel, not a location-based travel/photo archive. Existing images can seed a future collection only after content is curated and tagged. |
| Journal | `/blog` and `/blog/[slug]` are in `(protected)` and the layout calls `requireUserProfile`; APIs for public blog reads exist. Blog components include list, view, gallery, content renderer, footer, and navigation. | User intent calls for a public Journal/Blog nav destination. Route protection/publication expectations need an explicit product decision and parity checks before changing access or URLs. Do not make access changes implicitly as part of visual redesign. |
| Contact | CMS-backed contact email is passed to a client form that opens a Gmail compose URL. | Editorial layout may reuse this section, but contact submission/behavior should remain unchanged until separately scoped. |
| Terminal | `/terminal` has a dedicated layout and extensive terminal shell, command engine, media, audio, and video components; admin command management exists. | Keep route and functionality stable; remove it from primary nav and add a documented unobtrusive discovery mechanism after the new interface is approved. |
| Theme | Theme tokens already cover colors, reading measure, spacing primitives, radius, focus, and motion durations. Dark/light palettes and scopes exist; public root currently sets dark. | Public homepage still uses many inline Tailwind literals and fixed white/black treatments. New editorial components should use shared public tokens rather than expand one-off values. |
| Motion | Framer Motion is used for section entrance and About carousel/lightbox; reduced motion is explicitly considered in About and blog CSS, but not consistently in every homepage animation. | Video, page transitions, and any parallax must have a static/reduced-motion mode and should avoid scroll-jank. |

## Existing route sitemap and proposed experience map

### Existing routes

| Route | Purpose and notes |
|---|---|
| `/` | Current portfolio landing page and section anchors. |
| `/projects/[slug]` | Project detail route with shared home NavBar and media carousel. |
| `/[slug]` | Legacy/compatibility project lookup route; preserve existing links until a redirect/compatibility test proves replacement behavior. |
| `/blog` | Blog index under a protected route group in current implementation. |
| `/blog/[slug]` | Blog post view under the same protected layout. |
| `/terminal` | Terminal-style experience with its own layout. |
| `/sign-in`, `/sign-up`, `/settings`, `/banned` | Existing account routes; outside the cinematic visual scope except for shared design consistency. |
| `/admin/**` | CMS and administration routes; keep admin layout and workflows separate from public-site redesign. |
| `/service-unavailable` | Existing graceful backend availability page. |
| `/api/**` | Existing project, blog, auth, admin, terminal, private media, and CMS APIs. Phase 4A makes no API changes. |

### Proposed public sitemap (Phase 4B design target)

```text
/
├── /#projects             selected-work section or transition to /projects
├── /#journal              latest journal features, linking to existing /blog URLs
├── /#travel               travel/photography preview or transition to /travel
├── /#about                short editorial biography
├── /#contact              contact invitation and existing contact behavior
├── /projects/[slug]       existing project detail URL
├── /[slug]                compatibility route until proven safe to redirect
├── /blog                  existing blog route; access policy requires explicit decision
├── /blog/[slug]           existing post URL; retain current slug semantics
├── /travel                proposed travel/photography index (only if approved)
├── /travel/[slug]         proposed location/story detail (only if approved)
└── /terminal              existing hidden Easter egg, direct URL remains valid
```

The proposed travel routes are not present today. Phase 4B should decide whether Travel is a dedicated route or an in-page editorial section before building it. Either option should keep project and blog URL behavior stable. Do not add redirects until all current route forms and internal links have been inventoried and tested.

## Component inventory

| Component/group | Current role | Phase 4B reuse or change direction |
|---|---|---|
| `src/app/page.tsx` | Public homepage composition | Replace composition only after design approval; keep as server composition and pass serializable CMS data to focused sections. |
| `src/components/home/NavBar.tsx` | Responsive fixed nav and mobile menu | Rework visual placement, sticky/scroll behavior, focus handling, and route links; retain semantic nav and route destinations. |
| `DotsCanvas.tsx` | Fixed animated dot background | Likely remove from the public homepage or make a subtle optional layer; retain file until usage and any other references are checked. |
| `sections/hero/HeroSection.tsx` + client | Supabase CMS section query, text/image hero, crop | Split into video-stage presentation and a still fallback; retain CMS hero text/image as accessible fallback and source compatibility. |
| `sections/about/*` | CMS About text and media carousel/lightbox | Reuse for biography or adapt rendering to editorial photo blocks after testing captions, keyboard behavior, and image loading. |
| `sections/project/*` | CMS/API project list, tile, detail carousel, client pagination | Reuse data shapes and API contract; redesign card/case-study presentation without changing IDs or URLs. |
| `sections/experience/*`, `sections/skills/*` | CMS-backed text sections | Recompose as concise editorial blocks or fold into About; preserve current CMS content even when not all fields appear on the homepage. |
| `sections/contact/*` | CMS contact address and contact UI | Reuse as closing CTA; preserve form behavior in initial visual pass. |
| `components/blog/*` | Blog list, detail, content rendering, gallery, footer, account controls | Reuse existing blog renderer and CMS content; scope a public-facing editorial wrapper separately from auth-policy changes. |
| `components/terminal/*`, `/terminal` | Terminal shell, command engine, audio/video | Preserve intact and demote to Easter egg entry point. |
| UI primitives (`components/ui/*`) | Shared shadcn/Radix-style controls | Reuse where semantics fit; add editorial primitives only where needed, avoiding a parallel component system. |
| `src/styles/themes.css` | Shared theme tokens and scope colors | Extend with reviewed public editorial tokens (type, color, spacing, surfaces, motion) rather than hardcoded per-component palettes. |

## Proposed design system

Keep the identity dark, cinematic, and editorial, using the current token architecture as the foundation. The values below are design targets, not current measurements.

### Typography

- Pair one expressive display serif (or restrained high-contrast display face) with the existing neutral sans for interface and body copy; keep the existing mono face scoped to `/terminal`.
- Define tokens such as `--font-display`, `--font-body`, and `--font-code`; verify font licensing, subset, and self-hosting strategy before adding files.
- Use fluid display sizing with `clamp()`, short line lengths for editorial copy (roughly 55–70ch), and stable line-height. Reserve all-caps tracking for small labels.

### Color and surfaces

- Preserve near-black/charcoal as the default public canvas with warm off-white text and one restrained warm accent drawn from the footage palette (sand/amber or muted coral, selected after reviewing actual clips).
- Define semantic tokens for canvas, elevated surface, primary/secondary text, accent, border, overlay, and focus ring for both light and dark scopes.
- Use overlays/gradients for legible text over video; do not rely on a dark video frame as the sole contrast mechanism.

### Spacing, shape, and layout

- Use a consistent 4px base scale and shared layout tokens already present (`--space-unit`, `--layout-gutter`), extending with section spacing and content widths.
- Editorial max widths: narrow text column; wide project/photo canvas; full-bleed media stage. Maintain safe gutters on all breakpoints.
- Prefer square or gently rounded editorial imagery over card-heavy UI; reserve larger radii for dialogs and interactive media only.

### Motion and accessibility

- Motion hierarchy: subtle opacity/position transitions for content, restrained crossfades for media chapters, no compulsory scroll hijacking or long parallax.
- Honor `prefers-reduced-motion`: disable autoplay video, use a poster image, remove nonessential transforms, and make navigation transitions immediate.
- Keep visible keyboard focus, semantic landmarks/headings, descriptive media alternatives, captions/transcripts when audio matters, and contrast checked against actual frames.

### Responsive behavior

- Mobile-first with content-safe gutters; proposed breakpoints: compact `<640px`, tablet `640–1023px`, desktop `>=1024px`, wide `>=1440px` (align implementation with project Tailwind breakpoints where possible).
- Use `svh`/`dvh` with a robust fallback for the landing stage, account for safe areas, and avoid fixed-height layouts that clip on mobile browser chrome.
- On mobile, reduce/disable video bandwidth and use poster-first behavior; maintain stable nav and touch targets of at least 44px.

## Landing video architecture and proposed budgets

### Source model

Create a small, reviewed manifest for four location chapters (Hawaii, Portugal, Austin, lake house). Each entry should define a local or approved first-party video source, poster, alt/description, duration, aspect behavior, and optional CMS text. Do not derive object keys from user-provided paths or expose private media through the cinematic public surface. The repository currently has no bundled video assets; source selection, rights/consent review, and optimized derivatives are Phase 4B prerequisites.

### Playback behavior

1. Render the first chapter poster and headline immediately in server HTML; do not wait for video metadata to show usable content.
2. Load a muted, `playsInline`, `preload="none"` video only after page hydration and only when motion is allowed and data/network policy permits. Start playback only after an explicit user preference or browser-approved muted autoplay; handle rejected `play()` promises silently with the poster retained.
3. Use a single active video element/source at a time, not four simultaneously decoding videos. Preload at most the next chapter’s small poster; change sources at chapter boundaries with a short opacity crossfade, never crossfade simultaneous full-resolution decoders by default.
4. Provide visible pause/motion toggle and an understandable chapter indicator if video advances automatically. Prefer user-controlled chapter changes and a calm initial loop over fast, non-skippable cuts.
5. For reduced motion, save-data, low bandwidth, or playback failure, render the still poster with the same copy and navigation. Avoid autoplay sound. Any audio remains opt-in.
6. When the tab is hidden, pause playback. Respect browser visibility changes and release media resources when the stage unmounts.

### Proposed performance budgets (to validate on representative devices)

- Initial poster: responsive AVIF/WebP, target <=200 KB at mobile display size; provide correct dimensions/aspect ratio to prevent layout shift.
- Landing video: target <=2.5 MB per 10–15 second chapter at mobile rendition; provide a separate desktop rendition, with codecs/container selected after browser matrix testing. Total page transfer before interaction: <=1.0 MB excluding shared framework assets and with video not fetched.
- Initial poster LCP target <=2.5 s on a representative mobile profile; homepage CLS <=0.1; no more than one active video decoder; avoid loading hidden chapter media.
- Use poster-first loading and `preload="none"`; do not preload the entire travel reel. Record actual bundle/media sizes during Phase 4B rather than treating these targets as achieved.

## Navigation and transition behavior

- Keep a clear home wordmark and a restrained primary menu: Projects, Journal, Travel, About, Contact. “Off-center” can be achieved with a centered/offset editorial menu relative to the viewport while preserving an obvious home/brand affordance; avoid layout tricks that make focus order differ from visual order.
- Choose one navigation contract before implementation: persistent compact nav after the opening stage, or a reliable menu trigger that remains reachable throughout scrolling. Do not retain the current top-only hidden navigation behavior without an alternate persistent control.
- Internal section links should use native anchors and update the URL hash; route links preserve Next navigation. Scrolling should be smooth only when motion is not reduced.
- On route change, use a short opacity/clip transition (target 150–250ms), keep focus placement predictable, and do not delay navigation or trap the user in a transition.
- Mobile menu should use a semantic dialog/disclosure with Escape close, focus entry/return, focus containment if modal, body scroll lock, visible close control, and 44px targets. The open menu must not create inaccessible background content.
- Hide `/terminal` from primary nav. Add the Easter egg only after the core nav and content are stable (e.g., subtle wordmark interaction or footer keyboard-triggered hint) and retain a direct link from an accessible “More” or footer path so it is not inaccessible to keyboard or touch users.

## CMS content compatibility plan

Keep Supabase and existing CMS workflows as the source of current public content for this frontend phase. Do not migrate data or create new backend requirements.

| Presentation content | Current source | Proposed use |
|---|---|---|
| Intro/title/portrait crop | `home_sections` row with key `hero`, including `title`, `description`, `thumbnail_url`, and `body.heroCrop` | Initial video-stage headline plus poster fallback; CMS image remains fallback until a video manifest is approved. |
| About bio and photos | `home_sections` key `about`; ordered `home_media` rows | About editorial block and photo story seed. Preserve order, caption, and image derivatives. |
| Experience / skills | `home_sections` keys `experience`, `skills` | Short profile sections or dedicated blocks; avoid dropping content in CMS if sections are visually condensed. |
| Projects | `/api/home/projects` pagination and `home_projects` / related media; detail via existing public project repository/routes | Project cards and case studies; preserve project IDs, slugs, status filtering, media order, and both existing route forms until compatibility is proven. |
| Blog/journal | Existing blog read APIs and blog components | “Latest Journal” teaser can consume existing published records. Whether `/blog` should be public is an access/product-policy decision outside visual scope; preserve current protection until separately authorized. |
| Contact | `home_sections` key `contact` plus existing default email | Closing CTA; retain existing form behavior and endpoint semantics. |
| Travel location chapters | No identified dedicated CMS taxonomy/manifest | Initial Phase 4B should use a typed local presentation manifest or reuse reviewed public media records with explicit location metadata. CMS field/schema changes require separate approval and are not necessary for a first slice. |

Do not add a public media reference to private journal assets. Existing public S3 URLs and CMS media remain as-is; future travel content must be explicitly classified as public and rights-reviewed.

## Ordered roadmap and independent milestones

### Phase 4B.1 — Asset and content curation

- Inventory candidate personal clips and stills through user-provided, repository-local assets only; confirm usage rights and desired sequence.
- Agree on the opening message, chapter order, poster frames, captions/alt text, and which sections remain on the home route.
- Gate: approved asset list, no private media, validated file sizes/dimensions, mobile fallback images available.

### Phase 4B.2 — Design tokens and static editorial shell

- Add only approved public theme tokens and create a static responsive landing composition using poster imagery, without autoplay video.
- Implement primary navigation and accessibility contract; route to existing Projects, Blog, About, Contact, and proposed Travel destination behavior.
- Gate: responsive visual review and keyboard/mobile-menu checks; existing routes and CMS flows unchanged.

### Phase 4B.3 — CMS-backed sections and compatibility

- Reconnect project/blog/homepage content through existing Supabase reads and API DTOs; preserve project/blog identifiers and current publishing rules.
- Add route compatibility tests for `/projects/[slug]`, legacy `/{slug}`, and `/blog` paths before changing route structure.
- Gate: mocked/deterministic content tests pass and existing CMS create/edit/publish behavior is unaffected.

### Phase 4B.4 — Video delivery and progressive enhancement

- Implement one-active-source manifest player with poster-first and reduced-motion/data fallbacks.
- Verify source loading, failures, pause behavior, captions/labels, mobile bandwidth behavior, and performance budgets on real browsers.
- Gate: no video transfer before policy permits, fallback works with JavaScript disabled or playback failure, and performance budget evidence recorded.

### Phase 4B.5 — Travel/photography experience

- Decide whether this is an in-page chapter gallery or new `/travel` routes. Reuse public media only; maintain stable image derivatives and caption semantics.
- Gate: route/content source approved, image ordering and detail URLs stable, touch/keyboard gallery behavior checked.

### Phase 4B.6 — Easter egg and release readiness

- Demote direct Terminal nav and add the approved hidden discovery affordance while retaining `/terminal` and admin command content.
- Run full route, accessibility, responsive, visual, and performance QA; compare existing screenshots as historical references only.
- Gate: browser evidence on desktop/tablet/mobile, no known console/hydration/image failures, reduced-motion review, and rollback is a source-level revert of the new public presentation composition only.

## Unfinished work to preserve

This snapshot has many uncommitted changes from earlier phases. The following frontend paths were already modified before this audit and must not be treated as disposable or overwritten by Phase 4B:

- `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, and `src/app/projects/[slug]/page.tsx`.
- Existing homepage interaction/data paths: `src/components/home/DotsCanvas.tsx`, `src/components/home/sections/about/AboutSectionClient.tsx`, `src/components/home/sections/project/HomeGrid.tsx`, `InlineCarousel.tsx`, `ProjectDialogBody.tsx`, `lib/types.ts`, and `useProjectDetail.ts`.
- Blog UI/layout, auth provider UI, terminal shell/engine, and responsive/theme changes currently in the working tree.
- All existing database, auth, security, CMS, migration, and infrastructure-preparation work; Phase 4A does not modify any of it.

Before Phase 4B, re-check `git status` and inspect diffs of each targeted file. Make additive, narrow edits and avoid replacing entire files, because the current working tree predates this design phase and includes concurrent/in-progress work.

## Proposed Phase 4B scope for approval

1. Implement the public design-token layer and responsive static editorial shell while preserving existing CMS reads and URL behavior.
2. Curate/prepare four approved location chapters and poster assets; do not invent or fetch personal footage.
3. Add accessible navigation and new Journal/Travel entry points, preserving current blog access policy and terminal route.
4. Add the poster-first, reduced-motion-aware single-video enhancement only after the static experience is approved.
5. Adapt current project/blog/home content components visually without backend migration, API changes, or auth/security changes.
6. Add focused component/route tests and browser QA artifacts after the scope is approved.

Not included: Better Auth/Neon activation, CMS data migration, changing blog privacy/authentication behavior, S3/AWS configuration, live provider setup, cinematic media production, or unrelated admin redesign.

## Open decisions before implementation

1. Should Journal be public to anonymous visitors, or should its existing protected behavior remain? The design goal alone does not authorize changing access control.
2. Should Travel be an in-page section or new `/travel` and `/travel/[slug]` routes?
3. Which exact personal clips and stills are approved for public use, and are they already local or should the owner provide them later?
4. Should the opening stage be user-initiated playback, muted autoplay where permitted, or static-first with an explicit “play film” control? Recommended: static-first and user-controlled on mobile/reduced-motion; optional muted playback on supported desktop after consent/preference.
5. Which existing home sections (Experience, Skills, About) remain as separate sections versus being consolidated into an editorial biography?

## Phase 4A conclusion

The frontend has reusable content and interaction foundations, but the cinematic landing, travel/story route, intended navigation set, and video delivery are not implemented in the inspected repository state. A safe Phase 4B can proceed entirely at the presentation layer, using existing Supabase CMS data and preserving route contracts, once the open decisions and approved media are settled. This document is the deliverable; implementation remains paused pending approval.
