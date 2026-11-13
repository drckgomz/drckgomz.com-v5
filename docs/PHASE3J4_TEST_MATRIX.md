# Phase 3J.4 Private Media Test Matrix

| Boundary / behavior | Offline coverage | Result / limitation |
| --- | --- | --- |
| Anonymous access to public vs private post | `tests/phase3j/private-media.test.cjs` | Covered by shared `canReadPost` policy. |
| New registered user without private capability | Same | Denied for private media. |
| Approved audience member | Same | Allowed while current profile carries the capability. |
| Revoked audience member | Same | Denied on the next policy evaluation; Better Auth viewer reloads grants per request. |
| Disabled/blocked account | Same | Denied. |
| Owner | Same | Allowed by existing policy. |
| Draft, archive, deleted state | Same | Draft/deleted denied; archive follows existing owner/admin policy. |
| Private object key binding and traversal | Same | UUID, key prefix, post ID, media ID, extension, and traversal checks exercised. |
| Legacy media quarantine | Same | Nonpublic post DTOs omit old public URLs; legacy staging is not queried by media route. |
| Rich content remote image/video/iframe/Instagram loads | Same | Untrusted auto-load sources stripped; protected image route retained. |
| Response cache/security headers | Source review only | Route sets `private, no-store`, CDN no-store, `Vary`, `nosniff`, CSP, CORP, and no-referrer. No live HTTP assertion yet. |
| S3 bucket privacy and direct-object access | Not locally verifiable | Requires separately approved development bucket inspection. |
| S3 media retrieval and object MIME/size behavior | Not locally verifiable | Requires a synthetic object and separately approved live integration. |
| Revocation/unpublish over an existing browser session | Policy regression covered | Actual request/response requires approved database integration. |
| Public portfolio compatibility | Existing routes unchanged; regression suite pending | No AWS-backed visual run in this phase. |

Offline commands run for this matrix are recorded in `docs/PHASE3J4_REVIEW.md`. The bundled helper used for the unit tests is test-only output under `.artifacts/phase3j/`; it is not an application artifact.
