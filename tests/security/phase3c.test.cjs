/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, member, request } = require('./harness.cjs');
const admin = member({ role: 'admin' });
const ctx = { params: Promise.resolve({ slug: 'synthetic' }) };
const post = { id: 'p', slug: 'synthetic' };
const setup = (extra = {}) => harness({ actor: admin.id, profile: admin, tables: { posts: [post], media: [] }, ...extra });
const uploadRoute = 'src/app/api/admin/posts/[slug]/media/upload/route.ts';
const png = new Uint8Array(24); png.set([137,80,78,71,13,10,26,10]);
function multipart(bytes, type = 'image/png', name = 'synthetic.png') {
  const form = new FormData(); form.append('file', new File([bytes], name, { type }));
  return new Request('https://site.invalid/api/admin/posts/synthetic/media/upload', { method: 'POST', body: form });
}
for (const [label, bytes, type] of [
  ['HTML with an image claim', new TextEncoder().encode('<html><script>bad()</script></html>'), 'image/png'],
  ['SVG active content', new TextEncoder().encode('<svg onload="bad()"></svg>'), 'image/svg+xml'],
  ['MIME mismatch', png, 'image/jpeg'], ['empty file', new Uint8Array(), 'image/png'],
  ['truncated signature', png.slice(0, 8), 'image/png'],
]) test(`upload rejects ${label} before storage`, async () => {
  const h = setup(); const res = await h.load(uploadRoute).POST(multipart(bytes, type), ctx);
  assert.equal(res.status, 400); assert.equal(h.state.writes.length, 0);
});
test('valid screened upload uses generated extension and mocked storage, never the supplied filename', async () => {
  const h = setup({ allowUpload: true, allowInsert: true });
  const res = await h.load(uploadRoute).POST(multipart(png, 'image/png', '../../hostile.html'), ctx);
  assert.equal(res.status, 201);
  assert.equal(h.state.uploads.length, 1);
  assert.match(h.state.uploads[0].Key, /^journal-private\/p\/[0-9a-f-]+\.png$/);
  assert.equal(h.state.uploads[0].Bucket, 'synthetic-private-bucket');
  assert.match(h.state.uploads[0].CacheControl, /private, no-store/);
  assert.match((await res.json()).media.url, /^\/api\/private\/journal-media\//);
  assert.equal(h.state.uploads[0].ContentType, 'image/png');
  assert.equal(h.state.writes[0].patch.post_id, 'p');
});
test('unauthorized upload does not parse request or access content tables', async () => {
  const h = harness(); let parsed = false;
  const res = await h.load(uploadRoute).POST({ get headers() { parsed = true; throw new Error(); } }, ctx);
  assert.equal(res.status, 401); assert.equal(parsed, false); assert.equal(h.state.writes.length, 0);
});
test('actual stream limit applies without trusting content-length', async () => {
  const api = harness().load('src/lib/cms/upload.ts'); let cancelled = false;
  const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(api.MAX_MULTIPART_BYTES + 1)); }, cancel() { cancelled = true; } });
  const req = new Request('https://site.invalid', { method: 'POST', body, duplex: 'half', headers: { 'content-type': 'multipart/form-data; boundary=x' } });
  await assert.rejects(api.readUploadForm(req), error => error.status === 413);
  assert.equal(cancelled, true);
});
test('declared oversize rejects before reading the body', async () => {
  const api = harness().load('src/lib/cms/upload.ts');
  await assert.rejects(api.readUploadForm(new Request('https://site.invalid', { method: 'POST', body: 'x', headers: { 'content-length': String(api.MAX_MULTIPART_BYTES + 1), 'content-type': 'multipart/form-data; boundary=x' } })), error => error.status === 413);
});
test('malformed multipart and duplicate files fail as client errors', async () => {
  const h = setup(); const route = h.load(uploadRoute);
  const malformed = new Request('https://site.invalid', { method: 'POST', body: 'bad', headers: { 'content-type': 'multipart/form-data; boundary=x' } });
  assert.equal((await route.POST(malformed, ctx)).status, 400);
  const form = new FormData(); form.append('file', new File([png], 'one.png', { type: 'image/png' })); form.append('file', new File([png], 'two.png', { type: 'image/png' }));
  assert.equal((await route.POST(new Request('https://site.invalid', { method: 'POST', body: form }), ctx)).status, 400);
});
test('upload failures do not expose provider diagnostics', async () => {
  const h = setup({ errors: { posts: { message: 'private connection detail' } } });
  const res = await h.load(uploadRoute).POST(multipart(png), ctx);
  assert.equal(res.status, 500); assert.ok(!(await res.text()).includes('private connection'));
});
for (const body of [null, {}, { order: [] }, { order: ['a', 'a'] }, { order: ['a', {}] }, { ids: [null] }, { order: [Infinity] }, { order: Array(1001).fill('a') }]) test('reorder rejects malformed/duplicate/unbounded input', () => {
  assert.equal(harness().load('src/lib/cms/mediaOrder.ts').parseMediaOrder(body), null);
});
for (const body of [{ order: ['a', 2] }, { ordered: [{ id: 'a' }, { mediaId: 2 }] }, { ids: ['a', '2'] }, [{ value: 'a' }, '2']]) test('reorder preserves supported legacy aliases', () => {
  assert.equal(JSON.stringify(harness().load('src/lib/cms/mediaOrder.ts').parseMediaOrder(body)), '["a","2"]');
});
test('reorder rejects cross-post IDs before mutation rather than silently dropping them', async () => {
  const h = setup({ tables: { posts: [post], media: [{ id: 'own', post_id: 'p' }, { id: 'foreign', post_id: 'other' }] } });
  const res = await h.load('src/app/api/admin/posts/[slug]/media/reorder/route.ts').PATCH(request('/api/admin/posts/x', { order: ['own', 'foreign'] }), ctx);
  assert.equal(res.status, 409); assert.equal(h.state.writes.length, 0);
});
for (const caption of [{ secret: 'x' }, 42, 'x'.repeat(2001)]) test('caption/link boundaries reject nontext or oversized captions', async () => {
  const h = setup(); const route = h.load('src/app/api/admin/media/[mediaId]/route.ts');
  assert.equal((await route.PATCH(request('/api/admin/media/x', { caption }), { params: Promise.resolve({ mediaId: 'x' }) })).status, 400);
  const res = await h.load('src/app/api/admin/posts/[slug]/media/link/route.ts').POST(request('/api/admin/posts/x', { url: 'https://media.invalid/a.jpg', caption }), ctx);
  assert.equal(res.status, 400); assert.equal(h.state.writes.length, 0);
});
test('caption uses already-decoded ID and cannot mutate other media fields', async () => {
  const h = setup({ tables: { media: [{ id: 'literal%25', post_id: 'p', caption: null }] } });
  const route = h.load('src/app/api/admin/media/[mediaId]/route.ts'); const params = { params: Promise.resolve({ mediaId: 'literal%25' }) };
  assert.equal((await route.PATCH(request('/api/admin/media/x', { caption: 'Saved' }), params)).status, 200);
  assert.equal(h.state.tables.media[0].caption, 'Saved');
  assert.equal((await route.PATCH(request('/api/admin/media/x', { caption: 'bad', post_id: 'other' }), params)).status, 400);
});
test('admin media reads apply the shared URL policy and hide database diagnostics', async () => {
  const h = setup({ tables: { posts: [post], media: [{ id: 'm', post_id: 'p', url: 'data:text/html,bad' }] } });
  const res = await h.load('src/app/api/admin/posts/[slug]/media/route.ts').GET(request('/api/admin/posts/x'), ctx);
  assert.equal((await res.json()).media[0].url, null);
});

test('cross-site fetch metadata rejects admin mutation even with an absent Origin header', async () => {
  const middleware = harness().load('src/middleware.ts').default;
  for (const method of ['POST', 'PATCH', 'DELETE']) {
    const response = await middleware({ method, headers: new Headers({ 'sec-fetch-site': 'cross-site' }), nextUrl: { pathname: '/api/admin/posts', origin: 'https://site.invalid' } });
    assert.equal(response.status, 403); assert.match(response.headers.get('cache-control'), /no-store/);
  }
});
for (const body of [null, {}, { items: [{}], mode: 'replace' }, { items: [{ type: 'image', url: 'javascript:bad()' }], mode: 'replace' }, { items: [], mode: 'unexpected' }]) test('invalid project media replacement never deletes prior data', async () => {
  const h = setup({ allowDelete: true });
  const response = await h.load('src/app/api/admin/projects/[id]/media/route.ts').POST(request('/api/admin/projects/x/media', body), { params: Promise.resolve({ id: 'p' }) });
  assert.equal(response.status, 400); assert.equal(h.state.writes.length, 0);
});
test('failed project media deletion prevents replacement inserts and parent removal', async () => {
  const h = setup({ allowDelete: true, allowInsert: true, errors: { home_project_media: { message: 'private diagnostic' } } });
  const params = { params: Promise.resolve({ id: 'p' }) };
  const response = await h.load('src/app/api/admin/projects/[id]/media/route.ts').POST(request('/api/admin/projects/x/media', { mode: 'replace', items: [{ url: 'projects/p/safe.png', type: 'image' }] }), params);
  assert.equal(response.status, 500); assert.equal(h.state.writes.length, 0); assert.ok(!(await response.text()).includes('private diagnostic'));
  assert.equal((await h.load('src/app/api/admin/projects/[id]/route.ts').DELETE(request('/api/admin/projects/x'), params)).status, 500);
  assert.equal(h.state.writes.length, 0);
});
for (const fields of [{ projectId: '../outside', contentType: 'image/png' }, { projectId: 'p', contentType: 'image/svg+xml' }, { projectId: 'p', contentType: 'text/html' }]) test('presign rejects unsafe object paths and active content before SDK access', async () => {
  const h = setup();
  const res = await h.load('src/app/api/admin/uploads/presign/route.ts').POST(request('/api/admin/uploads/presign', { scope: 'projects', filename: 'synthetic', ...fields }));
  assert.equal(res.status, 400);
});
test('presign provider/configuration failures return a generic error', async () => {
  const h = setup();
  const res = await h.load('src/app/api/admin/uploads/presign/route.ts').POST(request('/api/admin/uploads/presign', { scope: 'projects', projectId: 'p', filename: 'synthetic.png', contentType: 'image/png' }));
  assert.equal(res.status, 500); assert.equal((await res.json()).error, 'Upload authorization failed.');
});
test('normalization rejects malformed records and duplicate URL parsers share exact-host policy', () => {
  const media = harness().load('src/lib/blog/media.ts');
  assert.equal(media.normalizeMedia([null, {}, { id: 'x', url: {} }, { id: 'y', url: '/uploads/a.png', caption: {} }]).length, 1);
  assert.equal(media.getYouTubeVideoId('https://attacker.invalid/?v=dQw4w9WgXcQ'), undefined);
  assert.equal(media.getYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('terminal blog command delegates to guarded Clerk route and never collects passwords or stores tokens', async () => {
  const Engine = harness().load('src/components/terminal/lib/engine.ts').CommandEngine;
  const navigation = []; const output = [];
  const engine = new Engine({ print: text => output.push(text), navigate: href => navigation.push(href) });
  await engine.execute('blog');
  assert.deepEqual(navigation, ['/blog']);
  assert.ok(!output.some(line => /password|email/i.test(line)));
  // A second command still uses the registry; no hidden credential-collection mode.
  engine.register({ name: 'safe', actions: [{ type: 'print', text: 'Registry works' }] });
  await engine.execute('safe'); assert.ok(output.includes('Registry works'));
});

test('successful reorder updates only existing media rows within the selected post', async () => {
  const h = setup({ tables: { posts: [post], media: [{ id: 'a', post_id: 'p', idx: 0 }, { id: 'b', post_id: 'p', idx: 1 }, { id: 'foreign', post_id: 'other', idx: 10 }] } });
  const response = await h.load('src/app/api/admin/posts/[slug]/media/reorder/route.ts').PATCH(request('/api/admin/posts/x', { order: ['b', 'a'] }), ctx);
  assert.equal(response.status, 200);
  assert.equal(h.state.tables.media.find(row => row.id === 'b').idx, 0);
  assert.equal(h.state.tables.media.find(row => row.id === 'a').idx, 1);
  assert.equal(h.state.tables.media.find(row => row.id === 'foreign').idx, 10);
});
test('media moved between lookup and reorder write is neither modified nor recreated', async () => {
  const h = setup({ tables: { posts: [post], media: [{ id: 'a', post_id: 'p', idx: 5 }] } });
  h.state.beforeWrite = tables => { tables.media[0].post_id = 'other'; };
  const response = await h.load('src/app/api/admin/posts/[slug]/media/reorder/route.ts').PATCH(request('/api/admin/posts/x', { order: ['a'] }), ctx);
  assert.equal(response.status, 409); assert.equal(h.state.tables.media[0].idx, 5);
  assert.equal(h.state.writes[0].ids.length, 0);
});
