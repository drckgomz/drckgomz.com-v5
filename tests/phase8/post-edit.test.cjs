/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module: mod, exports: mod.exports, Response, Request, URL, TextDecoder, Uint8Array, process: { env: {} }, require: name => { if (!(name in imports)) throw new Error(`Unmocked import ${name}`); return imports[name]; } });
  return mod.exports;
}
function setup({ denial = null, available = true, kind = 'saved' } = {}) {
  const writes = [];
  const route = load('src/app/api/admin/posts/[slug]/route.ts', {
    '@/lib/admin/requireAdminApi': { requireAdminApi: async () => denial },
    '@/lib/auth/response': { privateJson: (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } }) },
    '@/lib/auth/same-origin': load('src/lib/auth/same-origin.ts'),
    '@/lib/cms/request': load('src/lib/cms/request.ts'),
    '@/lib/cms/postInput': load('src/lib/cms/postInput.ts'),
    '@/lib/blog/content.server': { sanitizeBlogHtml: value => value },
    '@/lib/db/repositories/admin-posts': { postMetadataAvailable: async () => available, updateOwnerPostText: async input => { writes.push(input); return { kind, post: { revision: 4, excerpt: input.excerpt, date: input.date } }; } },
  });
  const send = (body, origin = 'http://localhost:3000') => route.PATCH(new Request('http://localhost:3000/api/admin/posts/synthetic', { method: 'PATCH', headers: { host: 'localhost:3000', origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ slug: 'synthetic' }) });
  return { send, writes };
}
test('post metadata requires authorization, origin and a revision before writes', async () => {
  for (const status of [401,403]) { const h = setup({ denial: Response.json({}, { status }) }); assert.equal((await h.send({ excerpt: 'test', expected_revision: 3 })).status, status); assert.equal(h.writes.length, 0); }
  const h = setup(); assert.equal((await h.send({ expected_revision: 3, excerpt: 'test' }, 'https://evil.test')).status, 403);
  assert.equal((await h.send({ excerpt: 'test' })).status, 428); assert.equal(h.writes.length, 0);
});
test('post metadata trims summary, accepts null and forwards revision atomically', async () => {
  const h = setup(); const response = await h.send({ expected_revision: 3, excerpt: ' Summary ', date: '2026-11-13', title: ' Title ' });
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(JSON.stringify(h.writes[0]), JSON.stringify({ slug: 'synthetic', expectedRevision: 3, excerpt: 'Summary', date: '2026-11-13', title: 'Title' }));
  assert.equal((await h.send({ expected_revision: 3, excerpt: null, date: null })).status, 200);
});
test('metadata rejects invalid dates, overlong summaries and unsupported fields', async () => {
  const h = setup();
  for (const data of [{ date: '2026-02-30' }, { date: '2026-11-13T00:00:00Z' }, { excerpt: 'x'.repeat(2001) }, { excerpt: 4 }]) assert.equal((await h.send({ expected_revision: 3, ...data })).status, 400);
  assert.equal((await h.send({ expected_revision: 3, roles: ['owner'] })).status, 501); assert.equal(h.writes.length, 0);
});
test('metadata readiness fails closed while existing text saves remain available', async () => {
  const h = setup({ available: false }); assert.equal((await h.send({ expected_revision: 3, excerpt: 'Summary', title: 'Title' })).status, 503); assert.equal(h.writes.length, 0);
  assert.equal((await h.send({ expected_revision: 3, title: 'Title' })).status, 200);
});
test('post edits report stale revisions and protected recovered content', async () => {
  for (const kind of ['conflict','legacy-protected']) assert.equal((await setup({ kind }).send({ expected_revision: 3, content: 'Synthetic' })).status, 409);
});
