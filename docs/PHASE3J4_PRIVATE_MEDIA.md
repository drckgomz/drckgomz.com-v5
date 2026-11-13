# Phase 3J.4 — Private Journal Media

## Implementation summary

Blog image uploads now use `S3_PRIVATE_JOURNAL_BUCKET` and the validated `S3_PRIVATE_JOURNAL_PREFIX` (default `journal-private`). Each object key binds a safe post identifier and a random UUID media identifier. Uploads carry `Cache-Control: private, no-store`; the object key, rather than an S3 URL, is stored in the existing `media.url` column. No schema migration is required.

`GET /api/private/journal-media/<media UUID>` resolves the media row and its current post on every request. It calls the shared `canReadPost` policy against the fresh viewer returned by `getViewer()`. This keeps Better Auth role/capability revocation effective on the next request and leaves the existing Clerk/Supabase viewer path intact. Public posts can serve their new private-bucket-backed images anonymously through this route; drafts, archived posts, deleted posts, and private posts follow the current policy. Responses are `private, no-store`, `CDN-Cache-Control: no-store`, `Vary: Cookie, Authorization`, `nosniff`, same-origin resource policy, and a restrictive CSP.

Private rich text permits automatic image loads only from the protected media route. It strips remote image sources and auto-loading video, audio, source, track, iframe, and Instagram embed blocks. External links remain links and do not load until clicked. The route accepts no object key or bucket from the caller, validates UUIDs, verifies that the stored object key exactly matches the post and media IDs, allows only image MIME types, and caps returned objects at 30 MiB.

Project/portfolio uploads remain on their existing public path. Existing direct public media references remain unchanged for public posts. References attached to private, draft, or archived posts are hidden from reader and admin media DTOs unless they match the new private key format; imported records in `legacy.*` are not served by this route.

## Audit findings and limits

- Before this change, blog upload objects used the public bucket and a one-year immutable public cache policy. That path was unsafe for private or draft content.
- The application cannot revoke an old public S3 URL. Hiding a legacy URL from a private page does not make an already public object private, remove copies, or clear browser/CDN caches. These objects require a separately approved storage migration and cache policy plan.
- A private bucket must not have public bucket policies, public ACLs, website hosting, or a CDN behavior that bypasses this application route. This repository change does not configure or inspect AWS.
- S3 upload and database insert are not atomic. If the database insert fails after the object upload, an unlinked private object can remain. It is not publicly addressable, but cleanup requires a separately designed, least-privilege orphan process.
- Responses are buffered up to 30 MiB before return. Current uploads are images; future video/audio delivery needs a reviewed streaming and range-request design rather than relaxing this cap.
- Admin APIs are still protected by their existing `requireAdminApi()` guard. New blog image uploads now require the private bucket configuration; a missing configuration fails closed and may prevent blog-image upload until the development provider is prepared.

## Required storage-provider configuration

Configure these only in a local, Git-ignored development environment for the approved development integration:

| Setting | Purpose |
| --- | --- |
| `S3_PRIVATE_JOURNAL_BUCKET` | Dedicated private bucket name; do not reuse the public portfolio bucket. |
| `S3_PRIVATE_JOURNAL_PREFIX` | Optional safe key prefix, default `journal-private`. |
| `AWS_REGION` | Region containing the private bucket. |

The application uses the AWS SDK default credential provider chain; do not put long-lived credentials in tracked files. For development, use an approved local AWS identity with only `s3:PutObject` for the private prefix (upload) and `s3:GetObject` for the private prefix (protected delivery). Do not grant public-read ACL, bucket policy, `ListBucket`, delete, or bucket-management permissions to the application identity. The bucket owner should configure block-public-access, encryption at rest, and lifecycle rules that do not unexpectedly archive active journal media. Verify the actual identity and target bucket out of band before any live test.

The serving identity requires `GetObject`; the upload identity requires `PutObject`. A future split of these identities would further reduce route privilege. If the same application identity is used, those are the only object actions required by this implementation.

## Development integration steps (approval required before live tests)

1. Create/configure a dedicated private development bucket through the approved infrastructure process; this code phase makes no AWS changes.
2. Set bucket, prefix, and region in a Git-ignored local environment file. Keep credentials in the approved local AWS credential mechanism, never in the repository or command arguments.
3. Confirm the bucket has no public policy/ACL and no CDN path that serves `journal-private/` directly. Confirm the application identity can only get/put objects in that prefix.
4. Use a separately approved development database branch and the already reviewed database configuration. No migration is required for the existing `media` schema, but a development row is required to exercise the route.
5. In a separately approved live test, upload a synthetic image to a draft, verify the S3 object key is private and the stored `media.url` is a key, then verify anonymous/ordinary users receive 404 and the owner/audience can retrieve it with `no-store` headers.
6. Revoke the synthetic audience grant and repeat the request using the same session; verify denial. Unpublish the post and repeat. Publish as public and verify anonymous retrieval works through the proxy. Do not use legacy personal media for these tests.
7. Verify a direct bucket URL is denied, no CDN caches the proxy response, and project/portfolio media still loads through its existing public URL.
8. Remove synthetic data/object only after a separately approved cleanup plan; no automatic cleanup is implemented here.

## Offline validation

`tests/phase3j/private-media.test.mjs` exercises anonymous, registered, approved, revoked, blocked, owner, unpublished/deleted, malformed-key, legacy-quarantine, and private rich-content behavior using synthetic data. It does not connect to AWS or a database. See `docs/PHASE3J4_TEST_MATRIX.md` for coverage and remaining live checks.
