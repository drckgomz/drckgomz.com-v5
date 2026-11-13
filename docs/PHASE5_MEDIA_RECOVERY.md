# Phase 5 — Media recovery and privacy status

## What the backup establishes

The reviewed dump contains 10 shared media metadata rows, two post-media links, three content-media links, and media references on generic content. The inventory reports HTTPS URLs and internal object-key fields, but a database dump cannot prove that objects exist, match their MIME claims, remain accessible, or are safe to expose. No live S3 listing, object fetch, upload, move, rename or deletion was performed in this phase.

The prior development staging import preserved media references as metadata only. The current local application code quarantines historical URLs on restricted/draft content and routes newly protected journal media through an authorization-checked, `no-store` handler. Existing legacy objects may still be public at their origin. A proxy cannot revoke a permanent public object URL.

## Future reconciliation

1. Export a sanitized per-object reconciliation containing source media UUID, parent relationship IDs, expected key and a locally verified file digest; keep personal post content and credentials out of reports.
2. For authorized local copies, validate signature, MIME, extension, dimensions/duration, size and malware policy before staging. Never trust only the filename or declared Content-Type.
3. Preserve source identifiers and order in the mapping ledger. Missing objects remain explicitly missing; do not replace with guessed paths or sample art.
4. Keep publication media and private media in distinct storage namespaces/buckets. Private delivery must require a fresh server authorization check and return private/no-store headers. Do not put a private object's permanent public URL in post HTML, thumbnails, embeds, manifests or caches.
5. Make storage transfer a separately approved operation. Verify copy counts and checksums before any source cleanup; this phase authorizes no AWS changes.

## Unresolved

The backup contains no object inventory proof. The current `site_media` schema in migration 0004 stores object metadata, but has no RLS policies or application storage mutation flow. Blog private-media access is limited to the older `can_view_private` capability; the new MEMBERS/CLOSE_FRIENDS/SELECTED_PEOPLE enums are not yet wired into database authorization. Keep these systems blocked until those gaps and the reviewed RLS migration are resolved.
