# Cinematic implementation plan

Documentation-only foundation, 2026-11-11. Homepage replacement, provider migration and deployment are not part of this work. Read [creative specification](CINEMATIC_DESIGN_SPEC.md), [token specification](DESIGN_SYSTEM_SPEC.md) and [Phase 2C limits](SECURITY_REMEDIATION.md) first.

## Route and component mapping

| Route / surface | Existing dependency to preserve | Proposed implementation |
| --- | --- | --- |
| / | Home sections and bounded public project API | CinematicHome, HeroVideo, VideoControls, SelectedWork, JournalInvitation, PersonalNote; keep server-readable text/poster |
| /projects/[slug] | Shared public project reader, sanitized HTML and visibility | ProjectStory/MediaFigure using safe DTOs |
| /[slug] | Legacy project alias | Preserve behavior or later reviewed redirect; test route conflicts with fixed routes |
| /projects (proposed) | Not assumed to exist today | WorkIndex using bounded pagination; filters only after defined server contracts |
| /blog and detail routes | Existing Clerk membership/layout, exact reader/ID fallback, private/editorial grants | Journal index/prose skin preserving guards; confirm audience before changing membership |
| /terminal | Authorized command registry and existing media/actions | Preserve alternate experience; add reduced-motion/pause/zoom/accessibility, no external auth bypass |
| /admin and editors | Server guards, owner safeguards and sanitized content | Keep stable initially; later typed homepage/media/navigation/theme editor behind same authorization |
| Sign-in/up, profile | Current Clerk flow | Visual alignment only after flow tests; no provider replacement in redesign |

New component names are proposals. Prefer server components for content/data boundaries and small client islands for video, menus and optional animation. Never send service-role credentials or unauthorized editorial data to client islands. Keep business policy out of visual components.

## Ordered delivery and gates

1. **Security foundation review.** Review remediation tests and operational blockers. Confirm supported Node/runtime and package manager; separately prioritize framework security patches. Destructive owner management/private media remain blocked on verified atomic/provider controls. A visual fixture prototype can proceed without these provider changes.
2. **Fixture gallery and shell.** Implement semantic tokens and typography under a public theme scope, navigation with Radix focus behavior, skip link and responsive content widths. Use synthetic/static content; preserve admin/terminal themes. Gate: lint/type/security checks plus keyboard, 320px and zoom screenshots.
3. **Video proof of concept.** Owner selects footage/posters and licensing. Implement state machine for poster, loading, playing, manually paused, preference blocked and failed. Test autoplay denial, motion/data preference changes, visibility, seeking and format fallback. Gate: measured media budgets, readable bright frames, accessible pause and no-JS poster/text.
4. **Homepage composition.** Integrate the approved hero and selected public work with existing API. Preserve legacy anchors and meaningful personal content; prevent layout shifts. No full-page intro transition. Gate: owner creative review, keyboard/mobile/reduced-motion testing and public/private regression suite.
5. **Work and journal.** Apply editorial project/story/prose compositions; maintain both project aliases, slugless blog ID links and case-insensitive literal slugs. Test unsafe legacy HTML fixtures and private/draft/deleted states. Work index is an explicit new route, not an accidental alias overwrite.
6. **Terminal accessibility.** Keep commands and creative identity; remove zoom restriction, unify pause/reduced-motion and menu/focus interactions. Gate: ordinary/private/banned/admin command tests and touch/keyboard use.
7. **Editorial configuration.** First agree typed public configuration and draft/preview/publish contracts; then separately authorize verified schema work for homepage/navigation/theme/media references. Reuse admin guards and sanitized server boundaries. This is not a reason to implement Neon/Better Auth early.
8. **Integration/release preparation.** Isolated Next/browser checks with synthetic credentials/data, performance, accessible media, content review and security patch verification. Deployment and provider changes require their own explicit authorization. No push/merge assumed.

## Risks and decisions

- Footage/poster selection, copy and featured work need owner editorial review. No generated corporate copy should fill missing identity.
- Current homepage data is mixed hardcoded and provider-backed. Build previews against fixtures; do not let prerender/build reach production to make a screenshot.
- Public S3 assets and private editorial candidates share URL patterns. Keep public hero assets explicitly public; do not serialize private candidate URLs for previews without a protected delivery design.
- Owner removal cannot be implemented safely through count-then-write. A visual admin redesign must retain the documented restriction.
- Existing lint debt and dual-lock drift require separate controlled cleanup. Do not bury broad refactors in the visual work.
- Animation/video can harm accessibility, battery and performance. Gate progress on preference handling and measured assets, not visual impression alone.
- Neon/Drizzle and Better Auth/Auth.js remain evaluation/migration decisions in earlier planning docs, not prerequisites for this visual phase. Preserve Clerk/Supabase boundaries until a separately authorized migration.

Recommended next phase: an isolated fixture-based design-system and video prototype for owner review, followed by incremental integration. No replacement homepage has been implemented in this overnight task.
