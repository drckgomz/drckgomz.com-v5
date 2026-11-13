# Media confidentiality: code audit and proposed delivery

Status: planning only, 2026-11-11. No S3 policies, objects, credentials, CDN configuration or provider permissions were read or changed. Repository code cannot establish whether objects are currently private.

## Observed paths

| Path | Observed behavior | Consequence |
| --- | --- | --- |
| `src/app/api/admin/posts/[slug]/media/upload/route.ts` | Admin-gated multipart upload; image MIME prefix only; PutObject under configurable blog-images/post-id prefix; media.url stores object key; sends public, year-long immutable Cache-Control regardless of parent status | Cache-Control is not an ACL, but caches may retain responses if origin permits reads. Draft/private association does not make object private. Size/content verification remains incomplete. |
| `src/app/api/admin/uploads/presign/route.ts` | Admin-gated five-minute signed PUT to projects/project-id/UUID-filename; client-supplied content type | Upload permission, not protected download. Project existence/type/size validation requires further work. |
| `src/app/admin/projects/[id]/components/ProjectMediaManager.tsx` | Constructs public media-base URL from returned key and stores URL | Absolute public-origin links survive after visibility changes. |
| `src/lib/blog/media.ts` | Retains absolute URLs and /uploads paths; expands keys against configured public S3 base | Authorized serialization can hide discovery, but cannot revoke a known link. |
| `src/lib/blog/read.ts`, project readers/APIs | Check parent visibility/deletion; explicit public DTOs; no arbitrary project meta; sanitize project schemes/HTML | Unauthorized application responses omit private parent media. They do not mediate origin GETs. |
| Homepage/resume/background/social and terminal media | Public assets coexist with permission-gated terminal registry actions | Public design assets can remain public. A gated terminal command does not prove underlying URL privacy. |

Existing public media links were preserved.

## Intended classification (requires owner confirmation)

Public homepage footage/posters, published portfolio assets and intentionally public downloads may use public immutable URLs. Draft, archived, deleted or private blog/project originals, thumbnails, alternate encodings and editorial uploads should be treated as confidential candidates until explicitly published. Their current access rules are inferred from parent authorization; actual object ACL/policy and owner intent remain unverified. Shared objects, external embeds and historically published assets require individual decisions; changing parent status cannot undo prior downloads.

## Proposed private delivery contract

1. A same-origin GET endpoint takes an application media ID, never an arbitrary URL, bucket or key. Load media and its parent through server-owned lookup. Validate Clerk identity and fresh active/unbanned profile, parent status/deletion and applicable private/admin capability before returning metadata or signing.
2. Resolve a server-owned private bucket/key and allowed variant. Disallow untrusted key traversal/prefix selection and arbitrary URL fetching/signing. Do not introduce an SSRF proxy. Reject orphaned, cross-parent, deleted or unsupported references with a nonrevealing response.
3. Require independently verified private origin/CDN controls. For authorized requests mint a short-lived signed GET (proposed 60–120 seconds); respond private/no-store, avoid logging signature query strings and use referrer restrictions. Signed PUTs stay separate. Download filenames/content types must be safe; risky formats should be attachment-only or rejected after content inspection.
4. A signed URL is a bearer capability: recipients can share it until expiry; in-flight downloads/copies cannot be revoked. If immediate per-request revocation is required, use an authenticated streaming proxy or verified edge authorization and account for range requests/video seeking, cache keys, bandwidth and availability. Ordinary signed redirects do not provide that guarantee.
5. Parent changes affect future issuance. Public/private sharing needs protected copies and variant lineage so a public sibling cannot expose private originals. External YouTube/Instagram embeds remain controlled by their respective providers and cannot be made private by wrapping HTML.

## Separately authorized rollout dependencies

Inventory object references/variants and sharing; verify bucket/CDN policies; test unsigned GET denial with synthetic objects; design copy/retention and cache invalidation; backfill server-owned key metadata only after reviewed schema; introduce protected reads without exposing new public URLs; test status changes, banned/disabled users, revoked grants, direct keys, expiry, range requests and audit-log redaction. Do not mutate existing objects or policies as part of this code-only phase.

Existing public URLs, third-party copies and long-lived caches may remain accessible. This document is a design, not a statement that media confidentiality has been achieved.
