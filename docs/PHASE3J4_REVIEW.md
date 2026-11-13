# Phase 3J.4 Review — Private Journal Media Security

## Summary

Implemented an offline private-media delivery boundary for journal images while preserving the existing public portfolio upload/read paths and the current Clerk/Supabase authentication path. New blog uploads require a distinct private S3 bucket, store only an application key in the existing media row, and are returned through a route that checks the viewer and current post policy before reading bytes. Better Auth continues to use `getViewer()` and the shared access policy; mutable audience grants are reloaded per request.

No Neon, AWS, production storage, or external service was accessed. No migration, credential change, commit, push, or deployment was performed.

## Security changes

- Added `/api/private/journal-media/[mediaId]`, which accepts only UUID media IDs, looks up the media and current post, validates a strict post/media-bound object key, evaluates the shared read policy, then reads from the dedicated private bucket.
- Anonymous retrieval is allowed only while the current parent post is public. Private retrieval requires current owner/admin/audience access. Disabled and banned users fail closed. Drafts/deleted posts are denied to audience members. Existing owner/admin access to archived content follows the established policy.
- Every protected request re-reads the viewer and content state. Access revocation and unpublishing stop a subsequent request, even when the browser still has the same session.
- Private responses use `private, no-store`, `CDN-Cache-Control: no-store`, and security headers. Only supported image MIME types and objects up to 30 MiB are returned.
- Private rich text no longer auto-loads legacy/public image URLs, video/audio sources, remote frames, or Instagram embeds. Protected app media images remain renderable.
- Private/draft/archived posts no longer serialize old public object URLs. The same quarantine is applied to the admin media DTOs. Legacy staging objects are not queried by this route.
- Blog uploads now use a distinct-bucket guard and private object keys with private/no-store metadata. Project and portfolio storage code remains unchanged.

## Compatibility and remaining privacy limits

- Public portfolio media is unchanged.
- Existing legacy public images on public posts continue to use their prior URLs. Newly uploaded blog images use the protected route even after publication; anonymous readers may retrieve them only while the post is currently public.
- The app cannot revoke a previously exposed public S3 URL, cached copy, downloaded file, or third-party copy. A legacy public object attached to a private post is hidden from current app output but may remain directly accessible. Storage migration and cache invalidation require a separate infrastructure plan and approval.
- S3 upload plus media-row insertion is not atomic. If insertion fails after upload, an unlinked private object may remain; it is not exposed by the app. No delete permission or cleanup process was added.
- The private route buffers responses up to 30 MiB. Video, audio, range requests, and larger objects need a separately reviewed streaming design.
- This offline implementation cannot establish that any bucket is actually private, that CDN configuration does not bypass the route, or that the runtime AWS identity is least privilege.

## Tests and validation

| Command | Result |
| --- | --- |
| `pnpm test:security` | Passed: 224 tests, 0 failures. Includes request-level route checks and existing auth/CMS suites. |
| `pnpm test:integration` | Passed: 60 tests, 0 failures. |
| Offline private-media bundle and `node --test tests/phase3j/*.test.mjs` | Passed: 9 tests, 0 failures. Bundles were written under `.artifacts/phase3j/`. |
| `pnpm exec tsc --noEmit` | Passed. |
| Focused `pnpm exec eslint` over changed application/test files | Passed with no diagnostics. |
| `git diff --check` | Passed. |

No browser, AWS, or Neon integration run was performed. These results do not verify provider configuration or live object privacy.

## Files changed for Phase 3J.4

- `src/app/api/private/journal-media/[mediaId]/route.ts` — protected retrieval endpoint.
- `src/app/api/admin/posts/[slug]/media/upload/route.ts` — private bucket blog uploads.
- `src/app/api/admin/posts/[slug]/media/route.ts`, `src/app/api/admin/posts/[slug]/route.ts`, `src/app/api/admin/posts/route.ts` — protect nonpublic media DTOs and content.
- `src/lib/blog/private-media.ts` — object-key validation, configuration guard, policy and URL helpers.
- `src/lib/blog/content.server.ts`, `src/lib/blog/read.ts`, `src/lib/db/repositories/blog.ts`, `src/lib/admin/getAdminPost.ts` — private content and media serialization.
- `tests/security/harness.cjs`, `tests/security/authorization.test.cjs`, `tests/security/phase3c.test.cjs`, `tests/security/private-journal-media-route.test.cjs` — synthetic upload and HTTP authorization regressions.
- `tests/phase3j/private-media.test.mjs` — key, policy, quarantine, and sanitizer tests.
- `docs/PHASE3J4_PRIVATE_MEDIA.md`, `docs/PHASE3J4_TEST_MATRIX.md` — provider setup, limitations, test matrix, and live-test procedure.

The repository already contained other uncommitted phase changes. They were not reset or intentionally modified outside the files listed above.

## Approval boundary before live testing

Separate approval is required before any development AWS resource operation or live S3/DB integration test. Before that approval, configure and verify a distinct private development bucket, its block-public-access and no-bypass CDN behavior, and a least-privilege application identity. Then use only synthetic content in an explicitly verified development database and storage target. Production storage, bucket policies, lifecycle rules, and existing legacy objects remain untouched.
