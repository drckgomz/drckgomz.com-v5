# Phase 4B.1 — Cinematic Landing Foundation

**Status:** Implemented locally. No external services, backend, CMS schema, authentication, private journal policy, media storage, or deployment was changed.

## What changed

- The homepage now opens with a full-viewport editorial hero shell. The existing `home_sections.hero` loader remains in place and still supplies title, description, and its public CMS thumbnail.
- A reusable `CinematicMedia` component supports root-relative local video paths, poster display, loading/playback failure status, a keyboard-accessible pause/play control, and a CSS-only fallback. Video elements are not inserted until the browser motion preference is resolved and indicates motion is allowed.
- The existing hero image is retained as a poster. If it is missing or fails, layered CSS gradients provide a complete background. Video sources are intentionally empty because no approved travel footage was found in the repository.
- The navigation is now editorial and off-center on desktop, remains visible while scrolling, and exposes Projects, Journal, About, and Contact. The mobile menu supports Escape, focus entry, tab containment, focus restoration on dismissal, body-scroll locking, and safe-area spacing.
- The old DotsCanvas source was not deleted, but it is no longer mounted on the public homepage so its moving dots do not compete with the cinematic stage.
- Existing About, Projects, Experience, Skills, and Contact CMS sections remain rendered below the hero. Existing project/blog routes and blog authorization were not changed. `/terminal` implementation and route were not changed.
- Shared theme tokens now include display typography, cinematic text/surface colors, overlay, spacing, and transition values. New responsive rules live in `src/styles/cinematic.css`.
- Added focused unit coverage for the local video-source path guard.

## Files changed

- `src/app/page.tsx`
- `src/app/globals.css`
- `src/components/home/NavBar.tsx`
- `src/components/home/sections/hero/HeroSectionClient.tsx`
- `src/components/home/sections/hero/CinematicMedia.tsx`
- `src/components/home/sections/hero/localMedia.ts`
- `src/styles/themes.css`
- `src/styles/cinematic.css`
- `tests/integration/cinematic-media.test.ts`
- `docs/PHASE4B1_CINEMATIC_FOUNDATION.md`

## Current limitations and next milestone

- No local Hawaii, Portugal, Austin, or lake-house video or poster assets are present. The page uses the current CMS hero thumbnail where available and an abstract CSS fallback otherwise. No footage was downloaded or published.
- Travel is not linked in the primary navigation yet because `/travel` does not exist. Add the Travel entry with the dedicated route in the next approved milestone; this avoids a dead link.
- Journal links to the existing `/blog` route. Its current protected behavior is unchanged.
- The terminal remains directly available at `/terminal`; the hidden Easter-egg discovery mechanism is deferred.
- Video playback and its failure UI are implemented but not exercised against actual footage. Real-device codec, loading, bandwidth, and visual-composition checks require approved local assets.
- Desktop/tablet/mobile CSS breakpoints and small-screen safe-area rules are present. Browser visual verification requires launching the actual Next application; the repository Playwright web server currently targets the separate blog review fixture, so its screenshots would not validate this page.

### Recommended Phase 4B.2 work

1. Owner supplies or identifies approved local travel clips and poster frames, with public-use confirmation.
2. Implement `/travel` and expose it in the main navigation; decide whether the route is location chapters, a photo archive, or both.
3. Run the app in an authorized local browser and review at desktop, tablet, and mobile sizes, including keyboard-only and reduced-motion modes.
4. Once approved assets are available, validate actual transfer size, codec support, poster LCP, autoplay policy, pause control, and playback failure behavior.
5. Review the cinematic typography and fallback composition against the owner’s actual content before considering a broader redesign of existing sections.

No data migration or change to publication/access behavior is part of this phase.
