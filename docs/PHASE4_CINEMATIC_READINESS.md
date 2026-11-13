# Phase 4 cinematic homepage readiness

2026-11-11. **Preparation only: no cinematic homepage implemented and no deployment authorized.** Local integration work is stronger, but production and browser gates remain open. This is the map for a controlled design phase, not a promise that current media is private or the site is release-ready.

## Current composition and data boundaries

`src/app/page.tsx` is a server component composing a client `NavBar`, a fixed decorative `DotsCanvas`, and server-loaded sections in this order: Hero → About → Projects → Experience → Skills → Contact. The main layout uses `gap-32`; the page/root use overflow clipping/hiding, which must not be treated as responsive verification. Retain `/#about`, `/#projects`, `/#contact`, `/terminal`, public project slug aliases and protected blog/admin routes.

| Area | Reusable source | Phase 4 considerations |
| --- | --- | --- |
| Navigation | `components/home/NavBar.tsx` | Desktop/mobile links and focus styling; verify menu focus, Escape, resize and hash offsets. Current styling is largely literal dark colors. |
| Hero | `home/sections/hero/{HeroSection,HeroSectionClient}.tsx` | Server fetches `home_sections` key `hero`; client owns Framer entrance/avatar crop. Preserve editorial title/description/crop semantics; guard malformed crop numbers and avoid remote fallback requests in future work. |
| About | `home/sections/about/{AboutSection,AboutSectionClient}.tsx` | Section/media reads and legacy original/800/1600 derivative mapping. Do not assume `standard/` variants are available: audit flags archival risk. Custom lightbox still needs proper focus/keyboard review. |
| Projects | `ProjectSection`, `HomeGrid`, `ProjectTile`, `TileThumb`, `useProjectDetail`, `ProjectDialogBody`, `InlineCarousel` | Existing bounded pagination, server public/deleted filtering, sanitized HTML, Radix dialogs and constrained YouTube framing. Preserve both project detail URL aliases and media identity. Detail hook stale reads/retries and custom image focus still warrant dedicated tests. |
| Experience / skills | Corresponding server and client sections | Reuse DTO/editorial content boundaries, separate animation from data retrieval and preserve readable DOM order. |
| Contact / résumé | `ContactSectionClient`, `resume/ResumeModal.tsx` | Contact currently builds an external communication link, not a new form backend. Preserve labels; do not add trackers. Résumé modal/iframe/document loading needs narrow accessibility and media-origin testing. |
| Design primitives | `components/ui/{button,card,dialog,input,label,...}` | Semantic variants and Radix behavior are reusable; test modal nesting, contrast and focus after visual changes. |
| Background | `DotsCanvas.tsx` | Existing decorative canvas is aria-hidden. Phase 3D stops its continuous RAF under reduced motion/hidden tabs; real frame/CPU measurements remain undone. Prefer a static equivalent over adding another rendering loop. |

Homepage repositories currently use Supabase public server clients, while editorial APIs use service-role clients with explicit application guards and Clerk. There is no installed Neon/Drizzle production adapter. A redesign must not move credentials, permission checks or raw private DTOs into client props. Confirm actual public RLS/schema before production acceptance.

## Theme contract

Canonical semantic tokens are in `src/styles/themes.css`, mapped by `src/app/globals.css`; content rules live in `src/styles/blog.css`. Existing scopes: public, blog, admin, projects and terminal, with explicit `data-theme` plus `.dark` compatibility. Current root defaults to dark. A scope label does not mean all legacy hardcoded colors support light mode.

Reuse `--background`, `--foreground`, paired card/popover/primary/secondary/muted/accent colors, `--border`, `--input`, `--ring`, `--destructive`; typography `--font-body`, `--font-code`, `--text-reading`, `--leading-reading`, `--measure-reading`; layout `--space-unit`, `--space-content`, `--layout-gutter`; `--radius`, `--shadow-raised`, `--border-width`, `--focus-width`, `--focus-offset`, `--motion-fast`, `--motion-standard`. Keep terminal prompt identity independent. Add a small documented token only where an actual design requirement exists; do not scatter copied palettes or user-provided CSS across components.

## Responsive and accessibility requirements

The existing Tailwind usage relies primarily on default `sm` (40rem/640px), `md` (48rem/768px), `lg` (64rem/1024px) and `xl` (80rem/1280px) conventions, assuming a 16px root and unchanged Tailwind defaults. Project grid is one column → two at sm → three at md. Hero aligns at sm and scales avatar/type; modal content uses viewport width/height caps. These are source contracts, not measured breakpoint correctness.

Acceptance matrix: 320, 375, 412, 768, 1024, 1366/1440, 2560 and 3840 CSS-pixel widths; portrait/landscape; both applicable themes; 200% text and real browser zoom; reduced motion; keyboard and screen reader navigation; forced colors. Preserve a single clear h1, semantic section headings, readable no-motion content, skip navigation and a visible focus indicator. Do not let scroll effects hijack keyboard reading or make content depend on animation completion. Native scrolling, focus return and dialog containment must survive each design change.

## Performance plan

Establish actual LCP/CLS/INP, JS/CSS sizes, image bytes and frame/CPU measurements before setting a redesign budget; none is certified by the offline fixture. Keep server data work on the server; avoid converting the whole homepage into one client component. Audit the six section queries and project detail waterfall, use bounded projections and independent fetches where appropriate, and avoid duplicate client hydration reads.

Reserve media dimensions/aspect ratios. Prioritize only the true hero asset; lazy-load below-fold media and posters with bounded responsive sizes. Avoid preloading every derivative or autoplaying multiple full-size videos. Respect reduced motion/data constraints and pause hidden/offscreen animation. Retain accessible static fallbacks for WebGL/canvas/video failure. Do not add analytics or external fonts/scripts merely to obtain measurements.

The AWS audit reports public buckets, processor wiring and archival risk. New draft assets must await the approved private-media model; neither new folders nor expiring links on public objects make them private. Keep legacy public URL compatibility and processor/lifecycle decisions separate from visual work.

## Gates before implementation acceptance

- Complete browser execution outside the current listen-restricted sandbox, with fresh screenshots and manual focus/overflow review; 57 discovered fixture cases are not browser passes.
- Obtain approval for and apply reviewed Next/Clerk/React/DOMPurify patch proposals, with lockfile review and rerun full routing/auth/editor tests. No dependency changes were applied in Phase 3D.
- Confirm dedicated Neon development branch before live-test recommendations; implement verified transactional repositories for publication/media/owner invariants separately.
- Accept private media migration and legacy derivative availability strategy before uploading confidential design assets.
- Approve visual direction and measurable budgets, then implement one section at a time with the existing public URLs and content contracts preserved.

Readiness verdict: **ready for local design planning and controlled component prototypes; not ready for production release or unverified private-media uploads.**
