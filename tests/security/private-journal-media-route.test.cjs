/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, member } = require('./harness.cjs');

const mediaId = '2f0338c1-ec1a-4fd9-a35a-8e195d9327d0';
const postId = 'synthetic-post';
const media = { id: mediaId, post_id: postId, url: `journal-private/${postId}/${mediaId}.png`, type: 'image' };
const routePath = 'src/app/api/private/journal-media/[mediaId]/route.ts';
const context = { params: Promise.resolve({ mediaId }) };
function setup(profile, status = 'private') {
  return harness({
    actor: profile?.id ?? null,
    profile,
    allowUpload: true,
    tables: { posts: [{ id: postId, slug: 'synthetic', status }], media: [media] },
  });
}
async function retrieve(h) {
  return h.load(routePath).GET(new Request(`https://site.invalid/api/private/journal-media/${mediaId}`), context);
}

test('private media GET denies anonymous, ordinary, blocked and revoked viewers before S3', async () => {
  const viewers = [null, member(), member({ is_banned: true }), member({ enabled: false })];
  for (const viewer of viewers) {
    const h = setup(viewer);
    const response = await retrieve(h);
    assert.equal(response.status, 404);
    assert.equal((h.state.downloads ?? []).length, 0);
  }
});

test('private media GET returns no-store bytes for an approved viewer and owner', async () => {
  for (const viewer of [member({ can_view_private: true }), member({ is_owner: true })]) {
    const h = setup(viewer);
    const response = await retrieve(h);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
    assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await response.arrayBuffer()).byteLength, 4);
    assert.equal(h.state.downloads.length, 1);
  }
});

test('public posts serve the private object via the proxy, while unpublish blocks the next request', async () => {
  const h = setup(null, 'public');
  assert.equal((await retrieve(h)).status, 200);
  h.state.tables.posts[0].status = 'draft';
  assert.equal((await retrieve(h)).status, 404);
  assert.equal(h.state.downloads.length, 1);
});

test('unprofiled signed-in visitors can read published public media but not restricted media', async () => {
  const h = harness({ actor: 'unprofiled-user', allowUpload: true,
    tables: { posts: [{ id: postId, slug: 'synthetic', status: 'public' }], media: [media] } });
  assert.equal((await retrieve(h)).status, 200);
  h.state.tables.posts[0].status = 'private';
  assert.equal((await retrieve(h)).status, 404);
  assert.equal(h.state.downloads.length, 1);
});

test('draft media previews are owner-only even when an administrator knows the media URL', async () => {
  for (const [viewer, expectedStatus] of [[member({ role: 'admin' }), 404], [member({ is_owner: true }), 200]]) {
    const h = setup(viewer, 'draft');
    assert.equal((await retrieve(h)).status, expectedStatus);
    assert.equal((h.state.downloads ?? []).length, expectedStatus === 200 ? 1 : 0);
  }
});

test('audience revocation takes effect for the same signed-in viewer on the next request', async () => {
  const h = setup(member({ can_view_private: true }));
  assert.equal((await retrieve(h)).status, 200);
  h.state.tables.user_profiles[0].can_view_private = false;
  assert.equal((await retrieve(h)).status, 404);
  assert.equal(h.state.downloads.length, 1);
});

test('malformed IDs, legacy public objects and storage errors fail closed', async () => {
  const h = setup(member({ can_view_private: true }));
  const invalid = await h.load(routePath).GET(new Request('https://site.invalid/private'), { params: Promise.resolve({ mediaId: '../key' }) });
  assert.equal(invalid.status, 404);
  h.state.tables.media[0].url = 'blog-images/synthetic-post/legacy.png';
  assert.equal((await retrieve(h)).status, 404);
  h.state.tables.media[0].url = media.url;
  h.state.downloadError = true;
  assert.equal((await retrieve(h)).status, 503);
});
