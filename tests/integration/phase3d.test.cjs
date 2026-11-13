/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { harness, member } = require('../security/harness.cjs');
const admin = member({ role: 'admin' });
const post = { id: 'p', slug: 'synthetic', status: 'draft', updated_at: '2026-01-01T00:00:00.000Z' };
const params = { params: Promise.resolve({ slug: 'synthetic' }) };
const projectParams = { params: Promise.resolve({ id: 'p', mediaId: 'm' }) };
const make = (extra = {}) => harness({ actor: admin.id, profile: admin, framework: true, tables: { posts: [post] }, ...extra });
const req = body => new NextRequest('https://fixture.invalid/api/admin/posts/synthetic', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

for (const body of [null, [], {}, { caption: {} }, { idx: -1 }, { idx: 1.5 }, { type: 'evil' }, { url: 'javascript:bad()' }, { type: 'youtube', url: 'https://youtube.com.evil.invalid/embed/x' }, { meta: [] }, { project_id: 'other' }]) test(`project media PATCH rejects invalid fields: ${JSON.stringify(body)}`, async () => {
  const h = make({ tables: { home_project_media: [{ id: 'm', project_id: 'p', type: 'image', url: '/uploads/safe.png' }] } });
  const response = await h.load('src/app/api/admin/projects/[id]/media/[mediaId]/route.ts').PATCH(req(body), projectParams);
  assert.equal(response.status, 400); assert.equal(h.state.writes.length, 0);
});
test('media PATCH validates effective existing embed type, retains parent scope and accepts captions', async () => {
  const h = make({ tables: { home_project_media: [{ id: 'm', project_id: 'p', type: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' }] } });
  const route = h.load('src/app/api/admin/projects/[id]/media/[mediaId]/route.ts');
  assert.equal((await route.PATCH(req({ url: 'https://evil.invalid/player' }), projectParams)).status, 400);
  assert.equal((await route.PATCH(req({ caption: 'Retained' }), projectParams)).status, 200);
  assert.equal(h.state.tables.home_project_media[0].caption, 'Retained');
  assert.equal((await route.PATCH(req({ caption: 'No' }), { params: Promise.resolve({ id: 'other', mediaId: 'm' }) })).status, 404);
});
for (const actor of [null, member(), member({ role: 'admin', is_banned: true })]) test('project media PATCH cannot bypass fresh admin authorization', async () => {
  const h = harness({ actor: actor?.id, profile: actor, framework: true });
  const response = await h.load('src/app/api/admin/projects/[id]/media/[mediaId]/route.ts').PATCH(req({ caption: 'No' }), projectParams);
  assert.ok([401, 403].includes(response.status)); assert.equal(h.state.writes.length, 0);
});
test('two requests with one revision produce one publication winner', async () => {
  const h = make(); let writes = 0; const bothReady = deferred();
  h.state.beforeQuery = async query => {
    if (query.table === 'posts' && query.patch) { if (++writes === 2) bothReady.resolve(); await bothReady.promise; }
  };
  const route = h.load('src/app/api/admin/posts/[slug]/route.ts');
  const results = await Promise.all([
    route.PATCH(req({ status: 'public', expected_updated_at: post.updated_at }), params),
    route.PATCH(req({ status: 'private', expected_updated_at: post.updated_at }), params),
  ]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  assert.equal(h.state.writes.filter(write => write.ids.length === 1).length, 1);
});
test('late media hydration cannot replace a newer local upload/order', async () => {
  const loader = harness().load('src/lib/cms/mediaHydration.ts').createMediaHydration();
  const pending = deferred(); const snapshots = [];
  const loading = loader.load('literal%25', media => snapshots.push(media), async url => {
    assert.equal(url, '/api/admin/posts/literal%2525/media'); return pending.promise;
  });
  loader.edited();
  pending.resolve(Response.json({ media: [{ id: 'old', type: 'image', url: '/uploads/old.png' }] }));
  await loading; assert.equal(snapshots.length, 0);
});
test('new media load cancels an old slug response even if transport ignores abort', async () => {
  const loader = harness().load('src/lib/cms/mediaHydration.ts').createMediaHydration();
  const old = deferred(); const snapshots = [];
  const pending = loader.load('old', rows => snapshots.push(rows), () => old.promise);
  await loader.load('new', rows => snapshots.push(rows), async () => Response.json({ media: [{ id: 'new', url: '/uploads/new.png' }] }));
  old.resolve(Response.json({ media: [{ id: 'old', url: '/uploads/old.png' }] })); await pending;
  assert.equal(snapshots.length, 1); assert.equal(snapshots[0][0].id, 'new');
});
test('unmounted or invalid/failed hydration never clears existing media', async () => {
  for (const response of [Response.json({ unexpected: [] }), new Response('failure', { status: 500 })]) {
    const loader = harness().load('src/lib/cms/mediaHydration.ts').createMediaHydration();
    await assert.rejects(loader.load('x', () => assert.fail('must retain current media'), async () => response));
  }
  const loader = harness().load('src/lib/cms/mediaHydration.ts').createMediaHydration();
  const pending = deferred(); const request = loader.load('x', () => assert.fail('unmounted'), () => pending.promise);
  loader.cancel(); pending.resolve(Response.json({ media: [] })); await request;
});
test('storage failure creates no media row and hides SDK details', async () => {
  const h = make({ allowUpload: true, allowInsert: true }); h.state.uploadError = true;
  const form = new FormData(); const png = new Uint8Array(24); png.set([137,80,78,71,13,10,26,10]);
  form.append('file', new File([png], 'synthetic.png', { type: 'image/png' }));
  const response = await h.load('src/app/api/admin/posts/[slug]/media/upload/route.ts').POST(new NextRequest('https://fixture.invalid/upload', { method: 'POST', body: form }), params);
  assert.equal(response.status, 500); assert.equal(h.state.writes.length, 0); assert.ok(!(await response.text()).includes('private storage'));
});
test('record failure after successful upload is reported, not misrepresented as rollback', async () => {
  const h = make({ allowUpload: true, allowInsert: true });
  h.state.beforeQuery = query => { if (query.table === 'media' && query.insertRow) h.state.errors.media = { message: 'synthetic record failure' }; };
  const form = new FormData(); const png = new Uint8Array(24); png.set([137,80,78,71,13,10,26,10]);
  form.append('file', new File([png], 'synthetic.png', { type: 'image/png' }));
  const response = await h.load('src/app/api/admin/posts/[slug]/media/upload/route.ts').POST(new NextRequest('https://fixture.invalid/upload', { method: 'POST', body: form }), params);
  assert.equal(response.status, 500); assert.equal(h.state.uploads.length, 1); assert.equal(h.state.writes.length, 0);
});
test('known transaction gap: replacement insert failure occurs after reference deletion', async () => {
  const h = make({ allowInsert: true, allowDelete: true, tables: { home_project_media: [{ id: 'old', project_id: 'p' }] } });
  h.state.beforeQuery = query => { if (query.insertRow) h.state.errors.home_project_media = { message: 'synthetic insert failure' }; };
  const response = await h.load('src/app/api/admin/projects/[id]/media/route.ts').POST(req({ mode: 'replace', items: [{ url: '/uploads/safe.png', type: 'image' }] }), projectParams);
  assert.equal(response.status, 500); assert.equal(h.state.tables.home_project_media.length, 0);
});
test('known transaction gap: independent reorder requests can interleave into duplicate indexes', async () => {
  const h = make({ tables: { posts: [post], media: [{ id: 'a', post_id: 'p', idx: 0 }, { id: 'b', post_id: 'p', idx: 1 }] } });
  let writes = 0; const blocked = deferred(); const release = deferred();
  h.state.beforeQuery = async query => { if (query.table === 'media' && query.patch && ++writes === 2) { blocked.resolve(); await release.promise; } };
  const route = h.load('src/app/api/admin/posts/[slug]/media/reorder/route.ts');
  const first = route.PATCH(req({ order: ['b', 'a'] }), params); await blocked.promise;
  assert.equal((await route.PATCH(req({ order: ['a', 'b'] }), params)).status, 200);
  release.resolve(); assert.equal((await first).status, 200);
  assert.equal(new Set(h.state.tables.media.map(row => row.idx)).size, 1);
});

test('changed media embed fields conflict rather than bypass combined type/URL validation', async () => {
  const h = make({ tables: { home_project_media: [{ id: 'm', project_id: 'p', type: 'image', url: '/uploads/safe.png' }] } });
  h.state.beforeWrite = tables => { tables.home_project_media[0].type = 'youtube'; };
  const response = await h.load('src/app/api/admin/projects/[id]/media/[mediaId]/route.ts').PATCH(req({ url: 'https://evil.invalid/player' }), projectParams);
  assert.equal(response.status, 409); assert.equal(h.state.tables.home_project_media[0].url, '/uploads/safe.png');
});
for (const body of [null, [], { status: 'unexpected' }, { status: null }]) test('project writes reject malformed state payloads', async () => {
  const h = make();
  const response = await h.load('src/app/api/admin/projects/[id]/route.ts').PATCH(req(body), projectParams);
  assert.equal(response.status, 400); assert.equal(h.state.writes.length, 0);
});

for (const action of [{ type: 'navigate', href: 'javascript:bad()' }, { type: 'openUrl', url: 'data:text/html,bad' }, { type: 'openUrl', url: 'java\nscript:bad()' }, { type: 'video', src: 'javascript:bad()' }, { type: 'gallery', images: ['data:text/html,bad'] }, { type: 'print', text: {} }]) test('terminal action JSON cannot execute an unsafe URL or malformed action', async () => {
  const h = harness(); const { CommandEngine } = h.load('src/components/terminal/lib/engine.ts');
  const calls = []; const engine = new CommandEngine({ print: text => calls.push(text), navigate: () => assert.fail('unsafe navigation'), openUrl: () => assert.fail('unsafe open'), showVideo: () => assert.fail('unsafe video') });
  engine.register({ name: 'unsafe', actions: [action] });
  assert.equal(engine.list().length, 0); await engine.execute('unsafe');
  assert.equal(calls.length, 1); assert.match(calls[0], /Command not found/);
});
test('terminal JSON/text action formats retain supported safe navigation and media', () => {
  const parse = harness().load('src/components/terminal/lib/actions.ts').parseTerminalActions;
  const actions = [{ type: 'print', text: 'Synthetic' }, { type: 'navigate', href: '/blog' }, { type: 'openUrl', url: 'https://example.invalid/path', newTab: true }, { type: 'audio', src: '/uploads/audio.mp3' }];
  assert.equal(parse(JSON.stringify(actions)).length, 4); assert.equal(parse('invalid'), null);
});

for (const offset of [String(Number.MAX_SAFE_INTEGER), 'Infinity', '-1', '1.5']) test(`catalog pagination keeps range endpoints safe for offset ${offset}`, async () => {
  const h = make();
  const response = await h.load('src/app/api/admin/posts/route.ts').GET(new NextRequest(`https://fixture.invalid/api/admin/posts?limit=50&offset=${offset}`));
  assert.equal(response.status, 200); assert.equal((await response.json()).nextOffset, 50);
  assert.equal(JSON.stringify(h.state.queries.find(q => q.table === 'posts').bounds), '[0,50]');
});
for (const actor of [null, member(), member({ role: 'admin', enabled: false }), admin]) test('unpublished preview data retains the admin authorization boundary', async () => {
  const h = make({ actor: actor?.id, profile: actor });
  const response = await h.load('src/app/api/admin/posts/[slug]/route.ts').GET(new NextRequest('https://fixture.invalid/api/admin/posts/synthetic'), params);
  assert.equal(response.status, actor === admin ? 200 : actor === null ? 401 : 403);
  if (actor !== admin) assert.ok(!(await response.text()).includes('synthetic'));
});

for (const slug of ['Legacy%25_雪', 'literal.*(id)', 'MixedCase', '--existing--']) test(`editor slug normalization preserves a valid legacy identifier: ${slug}`, () => {
  const h = harness(); const policy = h.load('src/lib/cms/slug.ts');
  assert.equal(policy.slugDraft(slug), slug); assert.equal(policy.slugFinalize(slug), slug);
  assert.equal(h.load('src/lib/cms/postInput.ts').validatePostInput({ slug }).error, undefined);
});
