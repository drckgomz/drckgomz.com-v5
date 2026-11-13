# Cinematic design system proposal

Planning only. Compatible with current Tailwind 4 `@theme inline`, shadcn variants and Radix accessibility primitives. Existing token names remain the integration API; no production CSS was changed.

## Semantic tokens

Proposed dark public theme, scoped so admin and terminal can retain intentional differences:

| Existing variable / new purpose | Proposed value | Use |
| --- | --- | --- |
| --background | #0b0b0b | Film-black page |
| --foreground | #f4f1eb | Warm principal text |
| --card / --popover | #151515 | Reading overlays, menus, actual surfaces |
| --card-foreground / --popover-foreground | #f4f1eb | Surface text |
| --muted / --secondary | #202020 | Quiet surface |
| --muted-foreground | #b3b0aa | Secondary copy |
| --primary / --accent | #7dd3cf | Restrained link/interactive accent |
| --primary-foreground / --accent-foreground | #0b0b0b | Text on accent fills |
| --secondary-foreground | #f4f1eb | Text on secondary |
| --border / --input | #5c5c5c | Meaningful controls/boundaries; decorative dividers may be subtler |
| --ring | #b4f5ec | Visible focus with contrasting offset |
| --destructive | #ff8b8b | Errors with text/icon, never color alone |
| --radius | .375rem | Controls; public editorial media can remain square |
| --prompt-color (existing terminal) | #7CFC9A | Terminal identity, not globally replaced |

Values are proposals. Test contrast for actual pairings, disabled states, images and light theme; alpha borders over video need a solid backing. Keep chart/sidebar tokens mapped for admin; do not apply a public palette by deleting their definitions. Expose a small validated preset palette later, not unrestricted CSS injected from settings. Preserve existing light-mode semantics until a complete light editorial palette is reviewed.

## Typography, space and composition

Use existing sans/mono token names with explicit system fallbacks. Geist is a candidate only after font loading/licensing/bundle behavior is confirmed; merely referencing an undefined CSS variable does not load it. Display: clamp(2.5rem, 6vw, 6rem), line-height 1.05, modest negative tracking; body 1rem–1.125rem, 1.6 line-height; small labels minimum .875rem, 1.4. Mono belongs to metadata/terminal and selected captions, not all prose. No text embedded in video.

4px spacing basis with 8/12/16/24/32/48/64/96 rhythm. Page gutter clamp(1rem, 4vw, 4rem), content max 80rem, prose max 68ch. Breakpoints reuse Tailwind sm/md/lg; respond to actual content and zoom rather than assuming device names. Prefer whitespace/dividers over repeated rounded cards. Public media uses deliberate 16:9, 4:3 or portrait ratios with owner-approved focal points; never crop essential information without an alternate view.

## Components and states

Reuse shadcn Button variants for actions and semantic anchors for navigation. Extend controlled variants rather than adding one-off style strings. Reuse Dialog/Sheet for menu/project overlays with trigger/focus restoration and keyboard support. ProjectStory, JournalProse, MediaFigure, QuietLink and PageHeading are proposed public compositions, not new primitive replacements. The terminal keeps its own visual language within shared safety/a11y contracts.

Every interactive component specifies default, hover, focus-visible, active, disabled, loading and error. Content lists have empty/error states; images/video have poster/fallback states. Public and administrative controls share accessible semantics but may have different density. Decorative borders must not carry essential state.

## Motion tokens

Fast 120–180ms, ordinary 220–320ms, opening reveal <=400ms. Ease-out candidate cubic-bezier(.2,.7,.2,1). Limit transforms to small distances (8–16px); avoid layout-property animation. Framer Motion wrappers should read a shared reduced-motion setting and never make essential SSR content initially invisible indefinitely. Reduced-motion uses immediate state changes or short nonspatial fades, disables loops/parallax and defaults video to poster. Respect manual pause and page visibility. Motion budgets require testing on low-powered mobile hardware.

## Implementation checks

Build a fixture gallery for typography, buttons, focus, forms, overlays, project tiles, prose and media failures before applying new tokens broadly. Inspect keyboard, forced-colors, high zoom, reduced-motion/data and bright-frame contrast. Keep semantic mappings in globals rather than duplicating raw hex throughout components. Test Tailwind static class extraction for variants. Theme settings and preview need typed validation, admin authorization and explicit publish semantics before any database-backed customization.
