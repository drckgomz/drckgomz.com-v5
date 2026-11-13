/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports) {
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module: mod, exports: mod.exports, Response, Request, URL, TextDecoder, Uint8Array, require: name => { if (!(name in imports)) throw new Error(`Unmocked import ${name}`); return imports[name]; } });
  return mod.exports;
}
function setup({ denial = null, result = { kind: 'created', post: { id: 'synthetic-id', slug: 'synthetic-copy' } }, failure = false } = {}) {
  const writes = [];
  const helpers = load('src/lib/cms/request.ts', {});
  const origin = load('src/lib/auth/same-origin.ts', {});
  const route = load('src/app/api/admin/posts/[slug]/duplicate/route.ts', {
    '@/lib/admin/requireAdminApi': { requireAdminApi: async operation => { assert.equal(operation, 'posts:update'); return denial; } },
    '@/lib/auth/same-origin': origin, '@/lib/cms/request': helpers,
    '@/lib/db/repositories/admin-posts': { duplicateOwnerDraft: async input => { writes.push(input); if (failure) throw new Error('sensitive database detail'); return result; } },
  });
  const send = (body = { expected_revision: 3 }, requestOrigin = 'http://localhost:3000') => route.POST(new Request('http://localhost:3000/api/admin/posts/synthetic/duplicate', {
    method: 'POST', headers: { host: 'localhost:3000', origin: requestOrigin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ slug: 'synthetic' }) });
  return { send, writes };
}
test('duplicate denies anonymous and nonowner requests before repository work', async () => {
  for (const status of [401, 403]) { const h = setup({ denial: Response.json({ error: 'Denied' }, { status }) }); assert.equal((await h.send()).status, status); assert.equal(h.writes.length, 0); }
});
test('duplicate requires same origin and exactly one positive integer revision', async () => {
  const h = setup(); assert.equal((await h.send(undefined, 'https://attacker.test')).status, 403);
  for (const body of [{}, { expected_revision: 0 }, { expected_revision: '3' }, { expected_revision: 1.5 }, { expected_revision: 3, visibility: 'public' }]) assert.equal((await h.send(body)).status, 428);
  assert.equal((await h.send({ expected_revision: 3, padding: 'x'.repeat(17000) })).status, 413); assert.equal(h.writes.length, 0);
});
test('duplicate forwards only source slug/revision and sends a private no-store result', async () => {
  const h = setup(); const response = await h.send(); assert.equal(response.status, 201); assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.equal(JSON.stringify(h.writes), JSON.stringify([{ slug: 'synthetic', expectedRevision: 3 }])); assert.equal((await response.json()).post.slug, 'synthetic-copy');
});
test('duplicate exposes conflicts and absence honestly without leaking database errors', async () => {
  for (const [kind, status] of [['missing',404],['conflict',409],['too-large',413]]) assert.equal((await setup({ result: { kind } }).send()).status, status);
  const response = await setup({ failure: true }).send(); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /sensitive database/);
});
