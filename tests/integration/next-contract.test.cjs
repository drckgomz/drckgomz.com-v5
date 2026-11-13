/* eslint-disable @typescript-eslint/no-require-imports */
// Real Next request/response primitives and real compiled handlers; no listening
// server, provider SDK, environment loader or production database is involved.
const test = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest, NextResponse } = require('next/server');
const { harness, member } = require('../security/harness.cjs');
const post = { id: 'fixture', slug: 'fixture', title: 'Synthetic', status: 'public', content: '<p>Readable</p><script>bad()</script>', media: [], updated_at: '2026-01-01T00:00:00.000Z' };
function fixture(profile = null) { return harness({ actor: profile?.id, profile, tables: { posts: [post] }, framework: true }); }
const ctx = { params: Promise.resolve({ slug: 'fixture' }) };
test('framework GET returns real NextResponse with sanitized public DTO and no-store', async () => {
  const h = fixture();
  const res = await h.load('src/app/api/public/blogs/[slug]/route.ts').GET(new NextRequest('https://fixture.invalid/api/public/blogs/fixture'), ctx);
  assert.ok(res instanceof NextResponse); assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control'), /no-store/);
  assert.ok(!(await res.json()).post.content.includes('<script'));
});
for (const actor of [null, member(), member({ role: 'admin', is_banned: true })]) test('Next POST/PATCH contract denies unauthorized callers before business writes', async () => {
  const h = fixture(actor);
  const res = await h.load('src/app/api/admin/posts/[slug]/route.ts').PATCH(new NextRequest('https://fixture.invalid/api/admin/posts/fixture', { method: 'PATCH', body: JSON.stringify({ status: 'public', expected_updated_at: post.updated_at }), headers: { 'content-type': 'application/json' } }), ctx);
  assert.ok(res instanceof NextResponse); assert.ok([401,403].includes(res.status)); assert.equal(h.state.writes.length, 0);
});
test('repository/Next contract: unpublish conditionally conflicts with a stale editor and hides the reader DTO', async () => {
  const h = fixture(member({ role: 'admin' }));
  const handler = h.load('src/app/api/admin/posts/[slug]/route.ts');
  const patch = body => handler.PATCH(new NextRequest('https://fixture.invalid/api/admin/posts/fixture', { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), ctx);
  assert.equal((await patch({ status: 'draft', expected_updated_at: post.updated_at })).status, 200);
  assert.equal((await patch({ status: 'public', expected_updated_at: post.updated_at })).status, 409);
  const reader = harness({ tables: { posts: h.state.tables.posts }, framework: true });
  const response = await reader.load('src/app/api/public/blogs/[slug]/route.ts').GET(new NextRequest('https://fixture.invalid/api/public/blogs/fixture'), ctx);
  assert.equal(response.status, 404); assert.ok(!(await response.text()).includes('Readable'));
});
test('admin repository projection excludes content while enforcing a bounded root query', async () => {
  const h = fixture(member({ role: 'admin' }));
  const res = await h.load('src/app/api/admin/posts/route.ts').GET(new NextRequest('https://fixture.invalid/api/admin/posts?limit=1'));
  assert.ok(res instanceof NextResponse);
  assert.ok(!Object.hasOwn((await res.json()).posts[0], 'content'));
  assert.equal(JSON.stringify(h.state.queries.find(q => q.table === 'posts').bounds), '[0,1]');
});

test('Next/CMS lifecycle: create private draft, publish, update, unpublish, archive and remove references', async () => {
  const h = harness({ actor: 'member', profile: member({ role: 'admin' }), tables: { posts: [], media: [] }, framework: true, allowInsert: true, allowDelete: true });
  const create = await h.load('src/app/api/admin/posts/route.ts').POST(new NextRequest('https://fixture.invalid/api/admin/posts', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Lifecycle', slug: 'lifecycle', content: '<p>Draft</p><script>bad()</script>' }),
  }));
  assert.equal(create.status, 201); assert.equal((await create.json()).post.status, 'draft');
  const params = { params: Promise.resolve({ slug: 'lifecycle' }) };
  const route = h.load('src/app/api/admin/posts/[slug]/route.ts');
  const anonymousRead = async () => {
    const reader = harness({ tables: { posts: h.state.tables.posts }, framework: true });
    return reader.load('src/app/api/public/blogs/[slug]/route.ts').GET(new NextRequest('https://fixture.invalid/api/public/blogs/lifecycle'), params);
  };
  assert.equal((await anonymousRead()).status, 404);
  for (const fields of [{ status: 'public' }, { title: 'Public update' }, { status: 'private' }, { status: 'draft' }, { status: 'archived' }]) {
    const revision = h.state.tables.posts[0].updated_at;
    const response = await route.PATCH(new NextRequest('https://fixture.invalid/api/admin/posts/lifecycle', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...fields, expected_updated_at: revision }),
    }), params);
    assert.equal(response.status, 200); const saved = (await response.json()).post;
    assert.notEqual(saved.updated_at, revision); assert.ok(!saved.content.includes('<script'));
    assert.equal((await anonymousRead()).status, saved.status === 'public' ? 200 : 404);
  }
  const removed = await route.DELETE(new NextRequest('https://fixture.invalid/api/admin/posts/lifecycle', { method: 'DELETE' }), params);
  assert.equal(removed.status, 200); assert.equal(h.state.tables.posts.length, 0);
  assert.equal((await anonymousRead()).status, 404);
});

test('Next multipart upload error contract: malformed input is JSON 400 before storage', async () => {
  const h = harness({ actor: 'member', profile: member({ role: 'admin' }), tables: { posts: [post] }, framework: true });
  const res = await h.load('src/app/api/admin/posts/[slug]/media/upload/route.ts').POST(new NextRequest('https://fixture.invalid/api/admin/posts/fixture/media/upload', {
    method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=x' }, body: 'broken',
  }), ctx);
  assert.ok(res instanceof NextResponse); assert.equal(res.status, 400);
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal(h.state.writes.length, 0);
});
