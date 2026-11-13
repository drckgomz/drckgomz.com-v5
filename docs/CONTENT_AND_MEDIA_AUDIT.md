# Content and media audit

Date: 2026-11-11. Static source audit only. **No content rows, object listings, remote media URLs, storage policies or upload endpoints were requested.** This document inventories implemented capabilities and code references, not the actual production content library.

## Homepage and personal identity

The current `/` is a section-based portfolio with `DotsCanvas`, hero portrait/name/intro, About gallery, project tiles/dialogs, experience, skills, resume modal and contact form. Framer Motion is already used. Fullscreen background video exists on `/terminal`, not as the current homepage design.

| Content | Observed source / structure | Editing status |
| --- | --- | --- |
| Hero | `home_sections` key hero: title, description or body.description, thumbnail_url; body.heroCrop x/y/zoom | Read implemented; homepage editor absent |
| About | Section title/description/body with stringified JSON tolerance; `home_media` section_key about with idx/caption/url | Gallery/lightbox and derivative URL guesses; no editor |
| Experience / skills | Section title plus body.description or description, rendered as presentation text | Read implemented; no structured job/skill management evidenced |
| Contact | Section body.email or description, fallback address in source | Form opens Gmail compose with name/message; no server send or stored submissions |
| Resume | Browser reads section body, accepting object or JSON string; pdf/docx URL or text | Modal with print/open; DOCX goes through Office online viewer; no upload/edit workflow |
| Projects | `home_projects` plus ordered `home_project_media` | Existing edit/status/delete/media dashboard; project creation incomplete |
| Homepage video/theme | Not modeled as a validated homepage publishing configuration | New capability to design, version and approve |

The README's aspirations to manage all home sections and bugs exceed the routes in this checkout. Personal identity worth carrying forward: Derick's own language, music/film work, unexpected terminal discoveries, monochrome/cyan accents, personal writing with explicit audience control. Do not substitute corporate slogans or invented projects/testimonials.

## Blog behavior and audience

Posts contain slug/title/excerpt/HTML/status/date/thumbnail and ordered media. Admin supports creating drafts, editing HTML/slug/date/status/thumbnail, changing status, deleting, image upload, linked YouTube/Instagram/image media, caption updates, removal and reorder. The custom contentEditable editor inserts `[MEDIA TYPE: label (id)]` tokens. Rendering replaces tokens with embeds, sanitizes HTML client-side with DOMPurify, then processes Instagram embeds. Retain media IDs and placeholder syntax during migration; avoid an editor-format rewrite in the same step.

`AllPostsGrid` requests `status=all` and displays at most 25 results. `BlogView` also requests the list and searches those rows by case-insensitive slug or ID; older posts can appear missing. A separate slug API exists but is unused by this view. Content lists include full HTML and media, increasing payload size and exposure consequences.

### Actual visibility, including defects

| Viewer | `/blog` pages | Blog list API | Blog slug API |
| --- | --- | --- | --- |
| Anonymous | Clerk middleware/layout redirect | Default public; all falls back to public; explicit draft/archived allowed by current filter | Any found non-private status returned |
| Signed in without profile | Layout redirects to sign-in | Treated as no private permission; can request draft/archived | Non-private rows returned |
| Active regular member | Pages allowed | Public by default; explicit draft/archived allowed; private excluded | Private denied; draft/archived not denied |
| Private grant, admin or owner | Pages allowed if profile not banned (layout does not check enabled) | `all` applies no status filter, exposing draft/archived too | All statuses returned |
| Banned profile | Layout redirects to banned | Empty items 200 | Not found 404 |
| Disabled profile | Blog layout does not check enabled | API does not check enabled | API does not check enabled |
| Whitelist admin alone | No special private privilege in blog API | Ordinary-member behavior absent another grant | Ordinary-member behavior absent another grant |

API availability is independent of protected page routes. Service-role blog reads make these application filters the effective boundary. Source-level exposure is established; live content/exposure is untested. Proposed policy: public only for ordinary viewers, public+private for explicit private readers, draft/archived only for authorized editorial previews; ban/disabled/missing-profile checks fail closed for protected content. Whether public blog pages should be anonymous remains an approval decision.

## Project visibility and content rendering

Public project APIs explicitly enforce status public; the list also filters it. Both project page variants (`/[slug]`, `/projects/[slug]`) query anonymously without an explicit status check, leaving privacy dependent on unknown RLS. Direct HTML rendering in those pages and `ProjectDialogBody` lacks the blog's DOMPurify step; project PATCH does not sanitize on the server. Do not trust the comment claiming saved HTML is sanitized. Validate/sanitize centrally and restrict URL schemes/embed hosts before broadening editors.

## Upload paths

| Workflow | Existing behavior | Risks / gaps |
| --- | --- | --- |
| Blog image | Admin guard; multipart file; MIME starts with image/; whole buffer in server memory; S3 PUT to `blog-images/<postId>/<timestamp>-<name>` or configured prefix; immutable public cache header; insert media key | No explicit size/pixel/content-signature limit; SVG/MIME trust; server body limits; object orphan on DB failure; max-idx race |
| Project file | Admin presign POST with scope projects/projectId/name/contentType; 5-minute signed PUT for `projects/<projectId>/<uuid>-<name>`; browser uploads; separate media metadata POST | Project existence/ownership not validated at signing; arbitrary declared MIME, no size bound/final object verification; metadata can reference unrelated/external URLs |
| Link media | Admin URL/type/caption insert; type inferred or supplied | Minimal URL/host/type validation; generic link type can be normalized/rendered as image downstream |
| Caption/order | Admin media PATCH and blog reorder; project media edits | Ordering/concurrency and transaction semantics need definition; keep IDs stable |
| Deletion | Delete rows, optionally reindex or delete child rows | No S3 DeleteObject code; objects remain; no reference counting, grace period or reconciliation |

S3 is already the implemented object store. Supabase clients store **metadata in PostgreSQL**; no `.storage` upload/download/getPublicUrl calls are present. Any historical Supabase buckets require a later owner-authorized inventory; do not assume they are empty or migrate them speculatively. S3 clients currently use AWS configuration, not a configurable S3-compatible endpoint/path-style abstraction.

## Media URL conventions and external services

- Stored media may be object keys, absolute external URLs, legacy S3 path-style/virtual-host URLs, or data URLs. `lib/blog/media.ts` and several duplicated component/API normalizers apply different fallbacks. Do not rewrite URLs blindly.
- About derives presumed `standard/about/<tail>.w800.webp` and `.w1600.webp` variants from originals. No derivative generation pipeline exists in source; actual objects are unverified.
- Terminal backgrounds reference dock/patio WebM with guessed MP4 alternatives and a terminal JPEG poster. `useMedia` has a broken.mp4 default reference. Existing background logic prefers still imagery for small/touch/mobile/reduced-data contexts but lacks a consistent reduced-motion/pause policy.
- YouTube embeds/thumbnails and Instagram embeds/scripts depend on external providers. BlogContent injects Instagram script even when no Instagram embed is needed. Plan explicit host restrictions, meaningful iframe titles and optional lazy/consent loading.
- Resume DOCX viewing shares its configured URL with Microsoft Office online. Gmail compose and social links are outbound integrations. They are not authentication or file-hosting services owned by this app.
- `public/` tracked artifacts: resume.pdf, favicon (under app), and Next/Vercel/window/globe/file SVG assets. `.gitignore` excludes several former local background/social/audio assets, so a Git checkout alone cannot reconstruct every referenced media object. No asset URLs were fetched to verify existence.

## Media privacy

Current normalizers generally produce public media URLs, not authenticated download routes or signed GETs. A private post's access check cannot make an already-public object private. `controlsList=nodownload` is presentation only. Actual S3 bucket/CDN policies are unknown.

Propose classifying assets as public, private-reader, editorial-only or external. Private assets should require server authorization against the parent content and short-lived signed delivery or a controlled proxy; hide original public aliases only in a separately approved provider phase. Define CDN/cache behavior and revoke access after ban/unpublish. Shared objects require a conservative most-restrictive policy or separately scoped copies. Third-party URLs cannot be made private by a DB flag.

## Proposed content/media architecture

Retain S3 first while data/auth move independently. Later introduce a media catalog with provider/bucket/object key, MIME/size/checksum, dimensions/duration, alt text, crop/poster/variants, accessibility tracks, visibility and upload state. Use typed attachments for posts/projects/home/commands and reference-aware, delayed cleanup. Keep external URLs distinct from owned object keys.

Use a signing/finalization flow with allowlisted types, server size limits, object verification and optional scanning/transcoding. Treat database/object writes as a workflow with retry/reconciliation, never a cross-service atomic transaction. Do not delete historical files as part of migration.

Homepage video publishing should select approved original + poster/optimized variants, include mobile crop and still fallback, store title/navigation text separately, support preview/revision/rollback, and avoid storing executable styling or HTML in theme settings. No transcoding job system or media catalog is implemented in this phase.

## Future inventory and acceptance

After separate export approval, obtain per-table/status counts and an asset manifest containing original references, resolved keys, every referring entity/placeholder, visibility, checksum and derivative availability. Report missing objects, orphan metadata, duplicate keys and broken embeds without deleting them. Compare source/target content hashes and media ordering and visually sample every content format in isolation. Current production volume, object ownership, license/consent and private-media exposure remain unresolved.
