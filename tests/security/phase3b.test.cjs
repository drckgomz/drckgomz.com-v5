/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, member, request } = require('./harness.cjs');
const admin = member({ role: 'admin' });
const row = { id: 'p', slug: 'literal%25', status: 'public', title: 'Synthetic', updated_at: '2026-01-01T00:00:00.000Z' };
const ctx = { params: Promise.resolve({ slug: row.slug }) };
function setup() { return harness({ actor: admin.id, profile: admin, tables: { posts: [row] } }); }
test('all status writers require a revision; stale edits cannot republish an unpublished post', async () => {
  const h = setup(); const route = h.load('src/app/api/admin/posts/[slug]/route.ts');
  const missing = await route.PATCH(request('/api/admin/posts/x', { status: 'public' }), ctx);
  assert.equal(missing.status, 428); assert.equal(h.state.writes.length, 0);
  const unpublished = await route.PATCH(request('/api/admin/posts/x', { status: 'draft', expected_updated_at: row.updated_at }), ctx);
  assert.equal(unpublished.status, 200);
  const stale = await route.PATCH(request('/api/admin/posts/x', { status: 'public', expected_updated_at: row.updated_at }), ctx);
  assert.equal(stale.status, 409); assert.equal(h.state.tables.posts[0].status, 'draft');
});
test('revision tokens strictly advance even when the source timestamp is in the future', async () => {
  const h = setup(); h.state.tables.posts[0].updated_at = '2090-01-01T00:00:00.000Z';
  const res = await h.load('src/app/api/admin/posts/[slug]/route.ts').PATCH(request('/api/admin/posts/x', { title: 'Saved', expected_updated_at: '2090-01-01T00:00:00.000Z' }), ctx);
  assert.equal(res.status, 200); assert.ok((await res.json()).post.updated_at > '2090-01-01T00:00:00.000Z');
});
test('Next-provided slug values are not decoded twice', async () => {
  const h = setup();
  const res = await h.load('src/app/api/admin/posts/[slug]/route.ts').GET(request('/api/admin/posts/x'), ctx);
  assert.equal(res.status, 200); assert.equal((await res.json()).post.slug, row.slug);
});
for (const date of ['2026-02-30', '2025-02-29', '2026-04-31', '2026-02-30T12:00:00Z']) test(`invalid calendar date is rejected: ${date}`, () => {
  assert.ok(harness().load('src/lib/cms/postInput.ts').validatePostInput({ date }).error);
});
for (const value of ['javascript:alert(1)', 'data:text/html,bad', 'java\nscript:bad', 'https://media.invalid/" onerror="bad']) test('media normalization rejects an executable or malformed URL', () => {
  assert.equal(harness().load('src/lib/blog/media.ts').normalizeMaybeS3Url(value), null);
});
test('valid uploaded object keys and local media remain compatible', () => {
  const normalize = harness().load('src/lib/blog/media.ts').normalizeMaybeS3Url;
  assert.equal(normalize('uploads/photo.jpg'), '/uploads/photo.jpg');
  assert.equal(normalize('/uploads/photo.jpg'), '/uploads/photo.jpg');
  assert.equal(normalize('https://media.invalid/photo.jpg'), 'https://media.invalid/photo.jpg');
});

test('admin catalog query is bounded and deterministic before serialization', async () => {
  const posts = Array.from({ length: 1200 }, (_, i) => ({ ...row, id: String(i).padStart(5, '0'), slug: `post-${i}`, media: [] }));
  const h = harness({ actor: admin.id, profile: admin, tables: { posts } });
  const res = await h.load('src/app/api/admin/posts/route.ts').GET(request('/api/admin/posts?limit=10&offset=30&status=public'));
  assert.equal(res.status, 200); const body = await res.json();
  assert.equal(body.posts.length, 10); assert.equal(body.posts[0].id, '00030'); assert.equal(body.hasMore, true);
  assert.equal(h.state.queries.filter(q => q.table === 'posts').length, 1);
  assert.equal(JSON.stringify(h.state.queries.find(q => q.table === 'posts').bounds), '[30,40]');
});
test('admin catalog rejects invalid status and does not expose database diagnostics', async () => {
  const h = setup(); const route = h.load('src/app/api/admin/posts/route.ts');
  assert.equal((await route.GET(request('/api/admin/posts?status=unexpected'))).status, 400);
  const fail = harness({ actor: admin.id, profile: admin, errors: { posts: { message: 'synthetic sensitive diagnostic' } } });
  const res = await fail.load('src/app/api/admin/posts/route.ts').GET(request('/api/admin/posts'));
  assert.equal(res.status, 500); assert.ok(!(await res.text()).includes('sensitive diagnostic'));
});

test('gallery rejects arbitrary iframe URLs and malformed rows but preserves supported formats', () => {
  const normalize = harness().load('src/lib/blog/gallery.ts').normalizeGalleryMedia;
  const rows = normalize([
    { type: 'youtube', url: 'https://evil.invalid/player' },
    { type: 'youtube', url: 'data:text/html,script' },
    { type: 'instagram', url: 'https://instagram.com.evil.invalid/p/ABC/' }, null, { type: 'image', url: {} },
    { type: 'image', url: '/uploads/synthetic.jpg', caption: 'Caption' },
    { type: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' },
    { type: 'instagram', url: 'https://www.instagram.com/p/SYNTHETIC/' },
  ]);
  assert.equal(rows.length, 3); assert.equal(rows[0].caption, 'Caption');
  const html = harness().load('src/lib/blog/content.server.ts').prepareBlogContent(rows.map(m => `[MEDIA ${m.type.toUpperCase()}: media (${m.id})]`).join(''), rows);
  assert.ok(!html.includes('evil.invalid')); assert.ok(html.includes('sandbox=')); assert.ok(html.includes('View Instagram post'));
});

test('failed media removal retains the parent post and avoids the second delete', async () => {
  const h = harness({ actor: admin.id, profile: admin, tables: { posts: [row] }, errors: { media: { message: 'synthetic deletion error' } }, allowDelete: true });
  const res = await h.load('src/app/api/admin/posts/[slug]/route.ts').DELETE(request('/api/admin/posts/x'), ctx);
  assert.equal(res.status, 500); assert.equal(h.state.tables.posts.length, 1);
  assert.equal(h.state.queries.filter(q => q.table === 'posts' && q.deletion).length, 0);
});

test('editor hydration cannot restore a rejected URL through raw-row spreading', () => {
  const normalize = harness().load('src/components/admin/editor/media.ts').normalizeMedia;
  const items = normalize([{ id: 'unsafe', type: 'image', url: 'javascript:bad()' }, { id: 42, type: 'image', url: '/uploads/safe.jpg', caption: 'Kept' }]);
  assert.equal(items.length, 1); assert.equal(items[0].id, '42'); assert.equal(items[0].caption, 'Kept');
});
