# Phase 5 — Legacy data mapping

This mapping is for review and reconciliation. The prior Phase 3I import wrote only to restricted `legacy` staging and provenance according to the owner's report. No normalized application import is performed here.

| Legacy source | Recovered shape | Target handling | Public/identity rule |
|---|---|---|---|
| `public.posts` (2) | UUID, title, HTML, views, timestamps, deletion fields, status | Preserve source row and ID in `legacy.posts`; later map reviewed records to `app.posts` while retaining source ID and raw source fields in provenance | `active` is ambiguous: map to unpublished draft/private only after explicit review; never auto-publish. Missing slug requires reviewed URL mapping. |
| `public.post_media` (2) | Integer bridge ID, post UUID, media UUID, order | Preserve in `legacy.post_media`; later resolve to `app.media` and ordered post-media relation with original bridge ID recorded | No media URL is exposed until authorization and object placement are verified. |
| `public.media` (10) | UUID, URL/key, caption/type/context/title/order/timestamp | Preserve metadata in `legacy.media`; later create `app.media` only after identity, ownership, MIME and storage resolution | Historical public URLs remain public at the storage origin; they cannot be treated as private by hiding a page. |
| `public.content` (6) | Integer ID, type/title/URL/description/order/timestamp/thumbnail/media ID | Preserve in `legacy.content`; separately map project candidates and homepage settings after semantic review | Never silently infer current section shapes, route destinations, video behavior or publication. |
| `public.content_media` (3) | Integer bridge ID, content ID, media UUID, position/context/timestamp | Preserve in `legacy.content_media`; later attach to reviewed section/project relation | Preserve original parent ID and order; reject orphan relationships. |
| `public.users` (2) | Integer ID, profile-like and legacy flags | Preserve inert source attributes in restricted staging; identity linkage requires owner-verified reenrollment | Omit credentials and sessions. Ignore legacy admin/setup flags for privileges. Never auto-create owner/admin or private access. |
| `public.bug_reports` (3) | ID, description and timestamp | Remain excluded/deferred until retention and privacy review | Do not copy descriptions into logs or public schema. |

## Transformation constraints

1. Keep source table and identifier in a namespaced immutable provenance key; do not cast integer IDs into user UUIDs or Better Auth subjects.
2. Preserve original timestamp representation and report timezone ambiguity; do not guess a timezone.
3. Preserve source HTML and URLs in restricted provenance. Sanitize content at render boundaries and make media migration a separate verified process.
4. Do not migrate password hashes, reset tokens, sessions, OAuth tokens, provider history, or admin flags into Better Auth.
5. Use a versioned mapping with explicit conflict reports. An idempotent rerun is allowed only when source/mapping fingerprints match; conflicts stop without overwrite.
6. Keep active, deleted, unknown, missing-slug, and unresolved-media rows staged until reviewed. A public route requires explicit published state and PUBLIC visibility.

See [the earlier schema inventory](PHASE3E_LEGACY_DATA_INVENTORY.md) and [migration validation design](PHASE3E_MIGRATION_VALIDATION.md) for field-level constraints and source evidence.
