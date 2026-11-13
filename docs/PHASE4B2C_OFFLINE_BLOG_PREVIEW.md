# Offline Blog Preview

With `OFFLINE_DESIGN_MODE=1` in development, `/blog` uses the original blog page structure: the **“Welcome to the Blog!”** heading, existing navigation and footer, black/white presentation, status badges, and the existing post-card and article components. The offline data consists of two explicitly labeled public fixtures:

- `/blog/offline-public-sample-one` — “LOCAL SAMPLE — Public post”
- `/blog/offline-public-sample-two` — “LOCAL SAMPLE — Second public post”

Both cards use a neutral local fixture image because the original post records and images are not available in offline mode. The index also shows a generic locked private card with no original title, excerpt, date, thumbnail, media URL, or slug. In configured mode, that card links to the existing sign-up and sign-in routes and says “Sign up or sign in to request access.” Registration does not grant private access.

The fixtures exercise the existing `AllPostsGrid`, `BlogView`, `BlogContent`, and media gallery rendering. They include headings, paragraphs, code, a local image/caption, and inert embedded-media placeholders. No CMS, Clerk, Supabase, Neon, AWS, or external media request is made in offline mode.

Offline middleware allows only `/`, `/terminal`, `/blog`, and the two exact sample slugs. Unknown blog slugs, restricted article routes, authentication pages, admin pages, protected APIs, and all API routes return 404 with private no-store caching. The ordinary configured blog path remains governed by server-side `can_view_private`; only published `public` and `private` posts are considered by the normal reader. Drafts and archived posts stay out of public lists and direct reads.

Run `node scripts/clerk-dev-smoke.cjs` for local HTTP checks and optional browser review at 390×844, 768×1024, and 1440×900. Browser screenshots are written into a unique `.artifacts/clerk-dev-smoke/blog-viewports-*` directory. The browser check also rejects external requests.

The offline fixtures are visual/data substitutes, not recovered historical posts. To compare pixel-level details against the original reference screenshot, the screenshot itself must be available to the reviewer; this document captures the visual requirements supplied for the review.
