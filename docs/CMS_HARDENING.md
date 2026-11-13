# CMS hardening: Phase 3B

## Changed contracts

PATCH /api/admin/posts/[slug] now requires expected_updated_at, including explicit null for genuinely null source rows. Missing token returns 428; stale token 409; missing post 404; invalid fields 400. All existing in-repository status/edit clients now supply it. Scripts/older clients must GET a fresh authorized row before changing it. No fallback to blind overwrite. Existing admin authorization applies before business data access.

The next timestamp is greater than both current clock and the previous parsed timestamp, avoiding a same-millisecond unchanged token for writers sharing this handler. Conditional SQL update permits one winner for the old token. External writers that ignore revisions and database triggers remain outside this guarantee; integer versions/transactions require verified schema and separate authorization.

List status actions send the row revision and ask before making a nonpublic post public. Thumbnail choice updates local form state and is saved with all other fields in the editor's single conditional PATCH, avoiding an independent mutation/revision mismatch. Publish, private, draft and archived states are unchanged. No content was silently published, imported or edited in a real database.

## Catalog and UI

GET /api/admin/posts uses status validation, limit 1–50 (default 25), nonnegative safe-integer offset, stable updated_at/id order and limit+1 root candidates. Returns posts, hasMore and nextOffset; content HTML is not in list projection. Child media cardinality is not bounded by the root-row limit. Errors no longer return raw database diagnostics for catalog reads.

ManagePostsPage exposes previous/next pages, loading/empty/error states and busy mutation controls. Search explicitly applies to the current page (title/slug/excerpt). Global server-side full-text search is deferred until a verified indexing/query contract exists; the UI does not pretend a page search covers the catalog. Offset pagination may shift during concurrent inserts/order changes. Same-origin API calls no longer export Clerk tokens to an optional legacy backend. Aborted/stale reads cannot replace newer results.

List/actions use semantic theme colors, wrapping controls and larger row buttons. No new browser pass is claimed because loopback execution is blocked. Test cases are prepared for the real list component, alongside offline bundle checks.

## Editing, media and autosave

Existing HTML/placeholders, drafts, preview, upload/link/caption/thumbnail/remove/reorder features remain. Valid local uploaded paths and HTTP media are normalized; unsafe schemes/data URLs and arbitrary iframe fallback are rejected. Existing already-stored SVG or external media needs a separate content/origin audit; this is not object-level malware screening.

Reorder timers now cancel on unmount/slug change. Timer cancellation is not transactional ordering or confirmation that a pending change was saved. Media mutations are independent from post text and can still partially fail. Existing delete now stops if child removal fails, but cannot roll back child deletion if parent removal fails. Do not implement a count-then-write or guessed database RPC to conceal this limitation.

Autosave is deliberately deferred: safe introduction requires a draft-only endpoint/contract, per-entity revision policy, debounce/cancel behavior, offline/conflict recovery, media coordination and explicit separation from publish/unpublish. Browser unload warnings are best effort; client-side navigation and mobile process termination can still lose unsaved work. No private localStorage autosave or background publishing was added. Preview is local/sanitized and does not make public object URLs confidential.

## Open work

Verified transactional post/media deletion and reorder; required revisions on every external writer; typed editor replacing contentEditable quirks; no-JS server reading; bounded child media; upload streaming/byte validation and orphan handling; global search; real-browser/mobile integration; atomic owner and private S3 rollout. Tests demonstrate local contracts, not live database behavior.
