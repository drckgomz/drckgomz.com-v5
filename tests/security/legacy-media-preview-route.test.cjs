/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const route = fs.readFileSync('src/app/api/dev/legacy-media-preview/[mediaId]/route.ts', 'utf8');
const repository = fs.readFileSync('src/lib/db/repositories/admin-posts.ts', 'utf8');

test('legacy S3 preview is local-only, owner-gated, pinned to a fixed URL parser, and never redirects or caches', () => {
  assert.match(route, /NODE_ENV === "production" \|\| process\.env\.LOCAL_PG_INTEGRATION !== "1"/);
  assert.match(route, /requireAdminApi\("posts:read"\)/);
  assert.match(route, /getOwnerLegacyMediaSourceById\(mediaId\)/);
  assert.match(route, /parseLegacyBlogImageReference\(media\.url\)/);
  assert.match(route, /redirect: "error"/);
  assert.match(route, /cache: "no-store"/);
  assert.match(route, /AbortSignal\.timeout\(8_000\)/);
  assert.match(route, /MAX_BYTES = 20 \* 1024 \* 1024/);
  assert.match(route, /Content-Length/);
  assert.match(route, /validImageSignature\(bytes, contentType\)/);
  assert.match(route, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.match(route, /"Cross-Origin-Resource-Policy": "same-origin"/);
});

test('admin CMS emits only the local protected preview path, never its stored origin URL', () => {
  assert.match(repository, /url: item\.type === "image" \? localLegacyBlogImagePreviewUrl\(item\.id, item\.url\) : null/);
  assert.doesNotMatch(repository, /url:\s*item\.url/);
  assert.match(repository, /sourceMediaId \|\| item\.id/);
});
