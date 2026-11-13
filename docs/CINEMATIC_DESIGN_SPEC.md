# Cinematic redesign specification

Proposal for review, 2026-11-11. Documentation only: the existing homepage has not been replaced. Companion documents: [design system](DESIGN_SYSTEM_SPEC.md), [implementation sequence](CINEMATIC_IMPLEMENTATION_PLAN.md), [security foundation](SECURITY_REMEDIATION.md).

## Creative direction

A personal film opening that leads into a working notebook: Derick's footage, code, experiments, music and writing supply the identity. Quiet typography and generous negative space let the work carry the experience. Keep the DRCKGOMZ wordmark, direct first-person voice and terminal as a playful alternate entrance. Avoid invented achievements, generic service pitches, dashboard cards across the portfolio or stock corporate imagery. Footage, final copy and featured work require the owner's editorial selection.

The opening is fullscreen footage with a compact name/one-line statement and understated text navigation. Use a restrained scrim behind text; the image can be expressive without sacrificing legibility. A short selected-work section, journal invitation and personal/contact note follow in normal document flow. Experience/skills remain available as substantive personal material, rather than crowding the opening. No scroll capture, forced intro, autoplay audio or cursor replacement.

## Existing inventory (observed code, not browser certification)

| Area | Existing source | Reuse / planned change |
| --- | --- | --- |
| Homepage composition | `src/app/page.tsx` | Hero, About, Projects, Experience, Skills, Contact plus fixed DotsCanvas; preserve content while proposing a new composition |
| Identity/navigation | `src/components/home/NavBar.tsx` | DRCKGOMZ, anchor links and TERMINAL; scroll-hide header and custom mobile overlay need accessible focus/state redesign |
| Portrait opening | `src/components/home/sections/hero/HeroSectionClient.tsx` | Avatar, first-person introduction and Framer Motion reveal; preserve voice and portrait as About/fallback material |
| Background motion | `src/components/home/DotsCanvas.tsx` | Continuous canvas loop; no shared reduced-motion/visibility budget; optional future element, never mandatory background |
| Work | `src/components/home/sections/project/` | HomeGrid, ProjectTile, TileThumb, ProjectDialogBody; preserve bounded data API, public visibility and project aliases |
| Journal | `src/components/blog/`, `src/app/blog/` | BlogView and media rendering; preserve membership/private/editorial rules while making content typography coherent |
| Alternate world | `src/components/terminal/components/VideoBackground.tsx` and terminal components | Existing background switching and creative commands; preserve identity and server command authorization; unify pause/reduced-motion behavior |
| Tokens/primitives | `src/app/globals.css`, `src/components/ui/` | Tailwind 4 semantic variables, shadcn/Radix controls, light/dark OKLCH, .625rem base radius, prompt green; adapt semantic theme rather than fork primitives |
| Fonts/motion | Root layout, globals, section client components | Geist variable references exist without next/font initialization in root; many hardcoded white/black/cyan/violet values and per-section animation choices need consolidation |

Current terminal video code includes device/reduced-data fallbacks, but that is not complete reduced-motion support. Existing mobile navigation opacity visibility is not equivalent to a tested modal/focus contract. These are future implementation requirements, not changes made in Phase 2C.

## Homepage video contract

- Render useful server HTML, navigation and an optimized poster first. Text is independent of video readiness. Use one decorative video with muted, playsInline and loop; accessible name belongs to actual page content, decorative video is hidden from assistive technology. If footage conveys information, provide an equivalent text description/captions and review that classification.
- Autoplay is progressive enhancement only when reduced-motion is off, reduced-data/save-data is off, page is visible and viewport policy permits. Failed play promises, missing codecs, slow networks and playback errors retain the poster. Do not load large video for a poster-only preference. No user-agent assumption can replace runtime capability checks.
- Provide a persistent keyboard-operable Pause/Play control with accurate state and accessible name. A manual pause wins over viewport/visibility transitions; returning to a visible page must not unexpectedly resume it. Persist preference locally without placing identifying data in storage.
- Pause when offscreen/backgrounded; stop decorative animation with reduced-motion. A change to preference takes effect during the session. Reduced-motion defaults to poster; deliberate user playback remains available. Reduced-data defaults to poster with explicit optional play.
- Supply approved desktop/mobile crops and poster focal points; protect faces and navigation within safe areas. Use 100svh with progressive dvh behavior, account for browser bars/notches and avoid clipped text in landscape. Below 320 CSS pixels or at enlarged text, permit content to exceed viewport naturally.
- Proposed initial budgets: poster <=200KB, mobile video <=3MB, desktop <=6MB, 8–15s loop, 720p/1080p variants subject to actual footage testing. These are targets, not measured assets. Video must not block LCP; avoid preloading every format or rendering multiple playing copies.

## Navigation and responsive layouts

Desktop: wordmark left, Work / Journal / Terminal and About or Contact as compact text links; active location and visible focus must not rely on color alone. Keep membership/sign-in discoverable for Journal without changing current authorization or advertising private content. Route-based Work index is proposed, not currently guaranteed to exist. Maintain old homepage anchors until link migration is complete.

Mobile: wordmark and labeled Menu button; Radix Dialog/Sheet with focus trap, Escape, correct expanded state, inert background, scroll containment and focus restoration. Links close the dialog on selection. No opacity-only focusable hidden menu. Target touch controls >=44px with enough spacing; text navigation stays minimal visually. Do not hide the sole navigation while keyboard focus is inside it.

Content uses one-column reading on mobile and selected asymmetric editorial grids on larger screens. Project media respects aspect ratio and captions; journal text targets 60–72 characters per line. Contact links have clear labels. Both canonical project pages and legacy aliases remain functional.

## Accessibility and motion acceptance criteria

Maintain heading hierarchy, landmarks, skip link, visible focus, meaningful link names and alt text for meaningful media. Allow pinch zoom and 200%/400% text/viewport zoom; terminal's current zoom restriction is a planned fix. Test keyboard-only and screen-reader operation, 320px width, landscape, slow media and offline failure. Proposed WCAG AA targets: normal text >=4.5:1, large text/UI boundaries >=3:1; verify overlays against the brightest approved frames, not only token swatches.

Framer Motion may animate opacity and small transforms only, without withholding content if JS fails. Reduced-motion removes spatial movement, parallax, canvas loops and automatic video. No page-transition curtain that delays navigation; no flashing; no infinite decorative animation without pause. See design-system durations. Accessible behavior is an acceptance plan, not a compliance claim.

## Editorial settings and open decisions

Admin-editable homepage should eventually expose typed headline/subline, featured public project IDs, public hero media/poster/focal point, navigation entries and bounded theme choices. Preview and publication must respect existing admin guards; no arbitrary HTML/CSS/JS or client authority. Validate external links and media references on the server. Store public fields separately from editorial drafts; do not serialize private asset URLs into public props. The current homepage has mixed hardcoded/data-backed sections, not a completed configuration CMS.

Owner review: footage/licensing and crop, voice/copy, featured work, Journal membership expectations, navigation labels, theme accent, and whether sound/informational video is ever needed. Database/auth migration is a separate project; visual prototypes can use synthetic content without it.
