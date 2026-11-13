# Phase 4B.3 — Public Blog and Layered Privacy Audit

## Scope and current behavior

The current blog lives in the `(protected)/blog` route group. Its existing UI is `Navbar`/`NavbarClientShell`, `AllPostsGrid`, `BlogView`, `MediaCarousel`, and `BlogContent`, with the existing `blog` theme scope and shared global styles. The cards and article view use responsive Tailwind classes; article HTML is sanitized on the server and again in the browser. The edit experience is under `/admin/posts` and uses the existing Supabase CMS APIs.

Before this change, Clerk middleware called `auth.protect()` for `/blog`, and `BlogLayout` called `requireUserProfile()`. That prevented anonymous visitors from reaching otherwise-public posts. The read policy already allowed anonymous callers only `status=public`; approved profiles with `can_view_private` could read `private`; active administrators/owners could also read those statuses. Public reader queries already filtered rows server-side and serialized explicit post fields. Private/draft media is served through a no-store authorization proxy. Existing legacy S3 objects may still be directly public under the AWS audit findings; hiding their URLs does not revoke the object URLs.

## Implemented locally

- `/blog` no longer requires a signed-in profile in normal configured operation. Clerk middleware still runs, but no longer protects the public blog path. `/admin` and its descendants remain protected.
- The blog group layout preserves its existing styling and components. It retains `force-dynamic`; middleware applies `private, no-store` on `/blog` pages because results may differ by viewer.
- Anonymous viewers, and authenticated users without a synced profile, can receive only public posts. The latter are treated as public-only, not as members.
- Normal reader endpoints now filter to `public` and the current approved `private` status. Draft and archived posts are excluded from `/api/public/blogs` and `/api/public/blogs/[slug]`, including requests for `status=all` by an administrator. CMS preview continues to use its separate `/api/admin/posts` routes.
- Individual `/blog/[slug]` pages perform the same server-side readable-post lookup before rendering the existing `BlogView`; restricted/unknown posts become `notFound()` instead of rendering a generic client shell.
- Protected media authorization continues to check the post on each request and returns no-store headers. Draft media through this proxy now requires the explicit owner flag.
- Offline sample mode remains intact and is limited to the known local sample slugs. It never queries normal blog APIs.

## Legacy privacy and migration semantics

The current Supabase content model has one `posts.status` field (`public`, `private`, `draft`, `archived`, plus possible historical values) and a global `user_profiles.can_view_private` bit. It has no post-level visibility enum, membership table, close-friends group, or per-post grants. The future model must separate publication from audience:

| Publication | Audience | Normal access |
|---|---|---|
| Published | PUBLIC | Everyone, anonymous included |
| Published | MEMBERS | Explicit active member assignment; owner override |
| Published | CLOSE_FRIENDS | Explicit active close-friends assignment; owner override |
| Published | PRIVATE | Owner only |
| Draft | Any | No reader endpoint; owner-only CMS preview |
| Archived | Any | No reader endpoint; owner-only CMS/history view |

An optional per-post grant can authorize a specifically named account for a published MEMBERS or CLOSE_FRIENDS post. It cannot override PRIVATE or DRAFT. Group membership and per-post grants are independently revoked and checked on every request. Admin status alone does not imply audience access; owner remains distinct.

Recommended migration mapping, with no bulk-public promotion:

| Existing status | New state | Migration handling |
|---|---|---|
| `public` | published + PUBLIC | Preserve current public eligibility, subject to deletion and media checks |
| `private` | published + MEMBERS | Snapshot the effective existing access set into explicit member/group or per-post grants before cutover; preserve current `can_view_private` users and currently entitled owner/admin users as per-post grants if needed |
| `draft` | DRAFT | Never appear in public readers; owner-only preview |
| `archived` | archived | Never appear in normal readers |
| unknown, null, `active`, malformed, conflicting | DRAFT/restricted quarantine | Require owner review; do not infer PUBLIC |

For every migrated row, preserve source ID, slug, timestamps, original status, content, media relations, and provenance. Keep the legacy status in a source/status column until reconciliation is complete. The snapshot of currently entitled private readers is necessary to preserve effective access at cutover; future group membership changes should not silently broaden those legacy posts.

## Proposed schema migration (not generated or executed)

The current Drizzle schema represents the future Neon model, not the active Supabase table. Its `posts.publication_state` and `posts.visibility` currently allow only `draft|published|archived` and `public|private`. It needs a reviewed migration before this full policy can be implemented:

1. Extend visibility with `members` and `close_friends`; reserve `private` for owner-only. Keep publication state separate. Add checks requiring `published_at` for published records and a positive revision.
2. Add `app.audience_memberships(user_id, audience, state, granted_by, granted_at, revoked_at, revision)` with constrained audience values (`member`, `close_friend`), active/revoked state, and unique active membership per user/audience.
3. Add `app.post_user_grants(post_id, user_id, state, granted_by, granted_at, revoked_at)` with a unique post/user key, FKs, and audit references.
4. Add audit events for membership, visibility, publication, and post-grant changes. Do not store credentials or session tokens in the audit log.
5. Preserve original Supabase identifiers in source/provenance columns and retain original legacy status/date values through validation.
6. Backfill visibility as above using a deterministic, reviewed mapping. Unknown rows become restricted DRAFT. Compare record counts, slugs, dates, body hashes, and media relations before cutover.
7. Add RLS or an equivalent constrained repository boundary to all audience, post, grant, and media reads. Verify policy expressions and effective table/function privileges, not merely policy names.

No schema, provider, or database operation was performed in this task.

## Authorization and disclosure review

- **Reader list/detail:** `getReadablePosts` and `getReadablePost`, plus the Drizzle equivalents, are server-side gates. Public reader endpoints now select only current `public`/authorized `private` statuses and return `private, no-store` JSON. Browser state never establishes authority.
- **Direct article URL:** server page lookup returns not-found for content the current profile cannot read. It does not put unauthorized titles, excerpts, thumbnails, or bodies into the page props.
- **CMS preview:** existing `/api/admin/posts` routes are separately protected by `requireAdminApi`; this is currently administrator-authorized, not owner-only for all draft listing and mutation paths. Drafts are excluded from public reader routes, and draft media proxy delivery is owner-only, but complete owner-only CMS draft control remains an explicit follow-up before claiming the target policy is complete.
- **Media:** the private S3 proxy checks post readability and rechecks on each request, with `private, no-store`, CDN no-store, `Vary: Cookie, Authorization`, content sniffing defenses, and owner-only DRAFT media. A public post can intentionally use its private-bucket proxy URL. Legacy public S3 URLs attached to restricted posts remain directly accessible at the object-storage layer until a separate media migration; this app change cannot revoke them.
- **Other surfaces:** no feed, RSS, category, tag, public search, or post-specific metadata/social-preview implementation was found. The root metadata is generic. If those surfaces are added, they must call the same centralized authorization query before returning identifiers or metadata. No restricted content should be added to sitemaps or public search indexes.
- **Caching:** the blog route group is force-dynamic, blog page responses receive private no-store via middleware, public APIs use `privateJson`, and private media has CDN no-store. This is intentionally conservative for mixed audiences.

## CMS design still required

The existing Supabase CMS remains in place. Before layered audiences are usable, the owner-facing editor needs separate publication and visibility controls, audience/member management, close-friends membership management, per-post grants, and a preview selector that invokes server authorization as a hypothetical viewer without changing grants. The list should label publication and audience separately. Grant and membership changes must be transactional, audited, protected from self-service, and take effect on the next read. The current status badge and post editor only understand legacy status; do not present them as implementing the new audiences.

The draft preview API currently uses the existing broader admin guard. A follow-up must inventory and gate *all* draft read/write/media paths (list, exact GET, preview, media list, upload/link/reorder, mutation responses and deletion) with owner authorization before the target owner-only draft guarantee is claimed. Ordinary administrator capabilities must stay distinct from ownership.

## Validation

Offline tests cover anonymous public reads; private status denial for ordinary/unapproved users; approved private readers; owner access; blocked/disabled denial; public endpoint exclusion of DRAFT/archived for administrators; direct URL not-found behavior; no-store API behavior; and protected-media status/revocation checks. Provider/database integration and the new visibility migration remain unverified because no live services or migrations were used.

## Previewing the existing design

- Without credentials: `OFFLINE_DESIGN_MODE=1 pnpm dev`, then open `/blog`. This shows the existing blog layout with the two labeled local sample articles.
- With the existing Clerk and Supabase development configuration: run `pnpm dev` normally and open `/blog`. Anonymous readers can view published public posts; private posts remain governed by the existing `can_view_private` server policy.

The main homepage and cinematic design were not changed for this phase.
