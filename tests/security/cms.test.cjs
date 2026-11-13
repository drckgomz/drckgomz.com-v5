/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, member, request } = require('./harness.cjs');
const admin = member({ role: 'admin' });
const post = { id: 'p', slug: 'synthetic', title: 'Synthetic', status: 'draft', content: '<p>Old</p>', updated_at: '2026-01-01T00:00:00.000Z' };
const ctx = { params: Promise.resolve({ slug: 'synthetic' }) };
function setup(rows = [post], extra = {}) { return harness({ actor: admin.id, profile: admin, tables: { posts: rows }, ...extra }); }
for (const input of [null, [], { title: '' }, { slug: '' }, { title: 7 }, { status: 'active' }, { status: '' }, { constructor: 'invalid' }, { expected_updated_at: null }, { status: null }, { content: {} }, { thumbnail_url: 'javascript:alert(1)' }, { slug: 'route/path' }, { slug: 'route?query' }, { title: 'x'.repeat(241) }, { expected_updated_at: 'invalid' }, { is_owner: true }]) {
  test(`CMS rejects invalid fields without writing: ${JSON.stringify(input).slice(0,80)}`, async () => {
    const h = setup();
    const res = await h.load('src/app/api/admin/posts/[slug]/route.ts').PATCH(request('/api/admin/posts/synthetic', input), ctx);
    assert.equal(res.status, 400); assert.equal(h.state.writes.length, 0);
  });
}
test('a missing post cannot be silently recreated by PATCH', async () => {
  const h = setup([]);
  const res = await h.load('src/app/api/admin/posts/[slug]/route.ts').PATCH(request('/api/admin/posts/synthetic', { title: 'New', slug: 'synthetic' }), ctx);
  assert.equal(res.status, 404); assert.equal(h.state.writes.length, 0);
});
test('stale revision conflicts and leaves existing content untouched', async () => {
  const h = setup();
  const res = await h.load('src/app/api/admin/posts/[slug]/route.ts').PATCH(request('/api/admin/posts/synthetic', { title: 'Overwrite', expected_updated_at: '2025-01-01T00:00:00.000Z' }), ctx);
  assert.equal(res.status, 409); assert.equal(h.state.tables.posts[0].title, 'Synthetic');
});
test('concurrent revision changes cannot overwrite a later save', async () => {
  const h = setup();
  h.state.beforeWrite = tables => { tables.posts[0].updated_at = '2026-02-01T00:00:00.000Z'; };
  const res = await h.load('src/app/api/admin/posts/[slug]/route.ts').PATCH(request('/api/admin/posts/synthetic', { title: 'Overwrite', expected_updated_at: post.updated_at }), ctx);
  assert.equal(res.status, 409); assert.equal(h.state.tables.posts[0].title, 'Synthetic');
});
for (const status of ['draft', 'public', 'private', 'archived']) test(`validated editor saves preserve ${status} publication state and sanitize HTML`, async () => {
  const h = setup();
  const res = await h.load('src/app/api/admin/posts/[slug]/route.ts').PATCH(request('/api/admin/posts/synthetic', { status, content: '<h2>Kept</h2><details><summary>Notes</summary>More</details><script>bad()</script><img src="/image.jpg" onerror="bad()"><p>[MEDIA IMAGE: caption (m)]</p>', expected_updated_at: post.updated_at }), ctx);
  assert.equal(res.status, 200);
  const saved = (await res.json()).post;
  assert.equal(saved.status, status); assert.ok(saved.content.includes('<details>')); assert.ok(saved.content.includes('[MEDIA IMAGE: caption (m)]')); assert.ok(!saved.content.includes('onerror')); assert.ok(!saved.content.includes('<script'));
});
test('explicit creation defaults to draft, preserves ID data contract and rejects duplicates generically', async () => {
  const h = setup([], { allowInsert: true });
  const res = await h.load('src/app/api/admin/posts/route.ts').POST(request('/api/admin/posts', { title: 'Synthetic', slug: 'synthetic' }));
  assert.equal(res.status, 201); assert.equal((await res.json()).post.status, 'draft');
  const conflict = setup([], { errors: { posts: { code: '23505', message: 'sensitive details' } }, allowInsert: true });
  const duplicate = await conflict.load('src/app/api/admin/posts/route.ts').POST(request('/api/admin/posts', { title: 'Synthetic', slug: 'synthetic' }));
  assert.equal(duplicate.status, 409); assert.ok(!(await duplicate.text()).includes('sensitive details'));
});
test('stored format compatibility includes encoded brackets, nested chips, captions and real media IDs', () => {
  const h = harness();
  const render = h.load('src/lib/blog/content.server.ts');
  for (const raw of ['<p>[MEDIA IMAGE: caption (m.1)]</p>', '<span class="media-placeholder">&#91;MEDIA IMAGE: caption (m.1)&#93;</span>', '<span><span>[MEDIA IMAGE: caption (m.1)]</span></span>']) {
    const out = render.prepareBlogContent(raw, [{ id: 'm.1', type: 'image', url: '/safe.jpg', caption: '<Caption> & text' }]);
    assert.ok(out.includes('src="/safe.jpg"')); assert.ok(out.includes('&lt;Caption&gt;')); assert.ok(!out.includes('[MEDIA'));
  }
});
test('media URL interpolation and unsupported iframe origins cannot inject markup', () => {
  const render = harness().load('src/lib/blog/content.server.ts');
  const out = render.prepareBlogContent('<p>[MEDIA IMAGE: x (m)]</p><iframe src="https://evil.invalid/"></iframe>', [{ id: 'm', type: 'image', url: '/safe.jpg" onerror="bad()', caption: 'test' }]);
  assert.ok(!/\sonerror=/.test(out)); assert.ok(!out.includes('<iframe'));
});
test('YouTube and Instagram formats survive server sanitization without executable script', () => {
  const render = harness().load('src/lib/blog/content.server.ts');
  const out = render.prepareBlogContent('[MEDIA YOUTUBE: video (y)] [MEDIA INSTAGRAM: post (i)]', [
    { id: 'y', type: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Video' },
    { id: 'i', type: 'instagram', url: 'https://www.instagram.com/p/SYNTHETIC/' },
  ]);
  assert.ok(out.includes('<iframe')); assert.ok(out.includes('data-instgrm-permalink')); assert.ok(out.includes('View Instagram post')); assert.ok(!out.includes('<script'));
});
test('lookalike embed domains and unsafe URLs are not interpreted as supported media', () => {
  const { getYouTubeId, isInstagramUrl } = harness().load('src/lib/blog/render.ts');
  for (const value of ['https://youtube.com.evil.invalid/watch?v=dQw4w9WgXcQ', 'javascript:dQw4w9WgXcQ', 'https://evil.invalid/dQw4w9WgXcQ']) assert.equal(getYouTubeId(value), null);
  assert.equal(isInstagramUrl('https://instagram.com.evil.invalid/p/ABC/'), false);
});
test('unauthorized and banned callers still cannot save or preview admin data', async () => {
  for (const actor of [null, member(), member({ role: 'admin', is_banned: true })]) {
    const h = harness({ actor: actor?.id, profile: actor, tables: { posts: [post] } });
    const route = h.load('src/app/api/admin/posts/[slug]/route.ts');
    const res = await route.PATCH(request('/api/admin/posts/synthetic', { status: 'public' }), ctx);
    assert.ok([401,403].includes(res.status)); assert.equal(h.state.writes.length, 0);
  }
});
