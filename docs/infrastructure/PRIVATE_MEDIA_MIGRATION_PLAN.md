# Private editorial media migration proposal

Status: **design only — no AWS changes, object copies, database connections or executable migrations**. Based on the read-only AWS audit and local Phase 3D code review, 2026-11-11. The audit's bucket configuration is architectural input, not a renewed account inspection.

## Problem and compatibility contract

The audit reports public object-read policies on both website buckets, including all prefixes of `derickgomez-images`, a configured legacy image-processing notification and Deep Archive risk under `standard/`. Current blog uploads choose a configured bucket/prefix independently of post status and ask for year-long public caching. Project presigns similarly choose public-addressable object identities. Parent authorization hides API discovery but cannot protect a known public URL. Unpublish, delete-reference and caption/reorder operations do not remove objects or revoke cached/downloaded copies.

Preserve existing intentionally public URLs and assets. Do not blanket-block either existing bucket, rewrite all stored URLs, remove the processor notification, change lifecycle rules or delete originals as an incidental part of this work. Existing publication on a public URL cannot be undone retroactively. Editorial owner review must classify historical assets and shared references; private intent cannot be inferred solely from folder names.

## Proposed layout and records

Use a **new dedicated private editorial bucket**, with all public access blocked, Bucket owner enforced ownership, encryption and HTTPS-only access. Keep its name operator-owned until explicitly approved. Proposed server-generated keys:

| Storage role | Proposed key/layout | Access |
| --- | --- | --- |
| Private original | `editorial/{tenant-or-site-id}/{media-id}/{generation}/original.{validated-extension}` | App/processor roles only |
| Private processed variant | `editorial/{site-id}/{media-id}/{generation}/variants/{preset}.{ext}` | Same private policy; never the legacy public `standard/` output |
| Explicit published copy | `published/{publication-id}/{media-id}/{generation}/{preset}.{ext}` on approved public delivery origin | Deliberately public immutable copy |
| Legacy public object | Existing exact bucket/key/URL, stored as a legacy reference | Preserve until separately reviewed |

Site/parent/media identifiers and generation are server-owned. Reject user-supplied bucket/key selections and key traversal. Do not persist signed URLs in post HTML, thumbnail fields, media rows or logs. Store durable object identity and render authorized delivery URLs at read time. Plain external URLs are a separate, explicitly public reference class; arbitrary third-party links cannot be made private by signing an app URL.

Proposed database additions, subject to actual-schema review: media ownership/parent association; bucket/key/version/checksum/size/verified MIME; original/variant lineage; `quarantined`, `ready`, `failed`, `retired` processing state; monotonic media-set and post revisions; immutable publication manifests; publication generation/status; job/outbox identities/idempotency keys; delivery class (`private`, `published-copy`, `legacy-public`, `external-public`); tombstones and auditable transition records. Cross-post shared references need an explicit association table/reference count, not inferred ownership. No DDL or guessed RPC is supplied.

## Private upload and preview

1. Authenticate and read fresh app permissions and parent association. Deny banned/disabled/missing users; a draft preview is editor/admin-only unless a separately approved reviewer capability exists. Do not grant draft access from `can_view_private` alone.
2. Reserve a media ID/quarantined record against the expected parent/media-set revision; issue a short-lived upload capability only for that server-generated identity. Use a signed POST with a size policy or a bounded app streaming path if enforceable size is required. The existing signed PUT MIME claim is insufficient.
3. A finalize worker verifies actual object identity, checksum, byte count, decoded dimensions, file structure/MIME and permitted types; scanning/limits run before rendering. Failed uploads remain quarantined. Thumbnails, posters, crops and derivatives inherit original confidentiality.
4. Use a new processor role/event configuration for private input/output, with idempotency and recursion prevention. Do not reuse the audited Lambda until its permissions, implementation and output destinations are verified. No private bytes may reach the legacy public derivative prefix.
5. An authenticated preview resolver accepts a media ID, not a bucket/key. Inside the read boundary, verify fresh account capability, current parent status/deletion, association and ready generation. Return private/no-store and either proxy bytes or issue a GET capability lasting at most 60 seconds. Use no-referrer and redact query signatures from traces/logs. A signed URL is transferable until expiry; it is not identity-bound or instantly revocable.
6. If immediate revocation is required, authorize every delivery request through a proxy with no shared caching; define acceptable in-flight response behavior. CloudFront OAC protects the origin, **not** viewers. Signed viewer access is an additional decision. Use an S3 REST origin, not a website endpoint, for OAC.

Recommended preview test matrix: anonymous/member/private-reader/editor/admin/owner/banned/disabled, missing parent, moved media, retired generation, revoked actor, expired capability, wrong method/content type, range requests and thumbnail/derivative parity. Never redirect an unauthorized preview to a known public original.

## Publish workflow: storage and database are not one transaction

1. In a transaction, recheck actor authority, expected post/media-set revisions, ready assets and slug/state rules. Record a pending publication manifest and outbox job. Keep the post nonpublic until final verification; do not create a partial public article.
2. An idempotent worker copies only explicitly approved original/variant generations to a new publication namespace. Verify checksums, content headers, public-origin policy, retrievability and storage class for every required asset. Do not inherit legacy archival rules automatically.
3. After all objects are ready, transactionally compare the pending manifest/revisions again and activate the publication generation plus post visibility. If edits/unpublish happened meanwhile, reject activation and retire the job; a late worker must never republish it.
4. Render public HTML and thumbnails from the activated manifest. Separate private preview records from public DTOs. Publish jobs track partial copies and recover/reconcile rather than silently assuming success.

Public immutable copies may exist before final activation if the chosen public origin is already readable. Unpredictable keys only reduce discovery; they do not confer confidentiality. If preactivation confidentiality is required, stage copies privately and enforce viewer access until activation through an approved delivery gate. Public policy and database commits cannot be made atomically consistent by application code alone.

## Unpublish and delete behavior

Transactionally mark the publication nonpublic, advance revisions and retire pending jobs before revocation cleanup. API/HTML resolution immediately stops returning public content to ordinary readers. Preview reverts to the private original path with authorization. Queue removal or revocation of dedicated public copies and targeted CDN invalidation according to an approved retention policy. Never remove a shared/legacy object still referenced by another public publication.

A public URL with long cache lifetimes, cached CDN response, existing signed capability, download or third-party copy can remain readable. CDN invalidation cannot retract browsers/downloads; signed URLs last until expiry. Communicate this limitation to the editor. If confidentiality after unpublish is mandatory, choose continuously authorized delivery from the start rather than publicly readable immutable assets. Reference deletion and object deletion have different retention and recovery requirements.

## Migration sequence and gates

1. **Explicit operator approval first:** confirm production bindings, sanctioned account scope and dedicated development database branch without exporting credentials. Obtain schema/RLS/processor/lifecycle/CloudFront ownership evidence through a separately authorized operator. This plan authorizes none of those operations.
2. Record a protected, bounded inventory mapping existing media IDs to parent states, variants, actual object locations, storage classes and shared references. Reconcile unknowns; do not put private inventories in Git or test fixtures. Preserve legacy IDs/placeholders and public URL redirects.
3. Stage the new private origin, upload/finalize/preview worker flow and proposed DB changes using synthetic data only. Verify anonymous denied reads and actual viewer authorization; signing a publicly readable object is not a test of confidentiality.
4. Switch **new draft uploads only** behind a reviewed server-side feature flag; public legacy reads remain unchanged. Fail closed if private delivery is unavailable; never fall back to a public upload destination.
5. Copy approved legacy originals privately with protected manifests/checksums, retaining original public URLs. Record that these legacy bytes were historically exposed; a private duplicate is not a retroactive confidentiality repair. Identify archived active `standard/` assets and approve any restoration/lifecycle change separately.
6. Run a narrow owner-reviewed content pilot through publish/update/unpublish/failure recovery. Reconcile media references, objects and manifests; test retries and worker crashes at every boundary.
7. Only after pilot acceptance, migrate additional classified content. Separate approvals govern removing public grants, retiring aliases/objects, changing legacy Lambda notifications and lifecycle rules. No broad bucket cleanup is implicit.

## Rollback and recovery

Rollback flags stop new reservations/publication jobs and retain private data. Continue legacy public delivery for already public assets. Restore the prior app version only if it understands new delivery classes or keep the compatible resolver enabled; never make private originals public to restore an old client. Pending jobs remain nonpublic; compare-and-swap prevents old workers from activating them. Keep protected copy manifests, object version IDs/checksums and association history until retention is approved. Restore reference transactions from verified snapshots; reconcile external partial copies separately. Never perform blind dual writes across Supabase/Neon/S3.

## Required permissions and database work — proposed only

| Actor | Minimal operation class | Scope / exclusions |
| --- | --- | --- |
| Runtime upload signer | Put to reserved private object identities; abort multipart only if used | No public ACL, IAM/policy/lifecycle changes or arbitrary bucket access |
| Private preview resolver | Get designated ready originals/variants, optional version reads | Server-approved association only; no caller-selected key or broad listing |
| Processor | Get private inputs, Put private variants | Exact input/output prefixes; constrained event source; no legacy public writes |
| Publication worker | Read approved ready objects; Put approved publication generation | Idempotent manifest-scoped copy; retirement Delete only under approved retention |
| Reconciler | Bounded inventory/metadata, optional approved delete/version operations | Separate operational role, auditable scope and protected reports |
| CDN origin | Read exact origin via OAC with exact distribution binding | Viewer access handled separately |
| Provisioning operator | Create/configure narrowly reviewed S3/CDN/events/KMS/logging resources | Separate authorization; runtime must not hold these powers |
| Database runtime | Execute reviewed transactional repositories and read permitted projections | Fresh actor check, parent/media revision and owner invariants inside transaction |

KMS Encrypt/Decrypt/GenerateDataKey only if the chosen encryption key requires them, scoped to the key and service context. Object/version deletion, restores, lifecycle modifications and legacy processor changes are distinct privileges, never prerequisites casually granted to the application.

## Acceptance requirements

Actual development-branch attestation, least-privilege SQL/RLS verification and real rollback/isolation tests; cross-tab reorder and publish/unpublish races; interrupted upload/copy/finalize/outbox recovery; orphan retention and reconciliation; checksum/variant completeness; public legacy URL parity; no accidental public reads of originals/variants; bounded signed GET expiry; sensitive query/log redaction; CDN cache/revocation tests; storage-class retrievability; processor recursion/private-output checks; browser/device accessibility and load budgets. Current synthetic tests demonstrate application contracts and known failures; they do not certify this proposed system.
