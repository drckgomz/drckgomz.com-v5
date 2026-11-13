/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function management({ owner = true, denied = false, local = true, queryError = false, rows = [], css = '--background: white;' } = {}) {
  const state = { queries: [], files: [] };
  const source = fs.readFileSync('src/lib/admin/management.ts', 'utf8');
  const mod = { exports: {} };
  const imports = {
    'server-only': {},
    'node:fs/promises': { readFile: async path => { state.files.push(path); return css; } },
    'node:path': require('node:path'),
    'drizzle-orm': { sql: (strings) => strings.join('?') },
    'next/navigation': { notFound: () => { throw new Error('NOT_FOUND'); } },
    '@/lib/admin/requireAdmin': { requireAdmin: async () => { if (denied) throw new Error('DENIED'); return { is_owner: owner }; } },
    '@/lib/db/owner-session': { withCurrentOwnerSession: async run => run({ execute: async sql => { state.queries.push(sql); if (queryError) throw new Error('sensitive database detail'); return { rows }; } }) },
    '@/lib/db/local-postgres-target': { isLocalPostgresIntegrationEnabled: () => local, verifyAllLocalPostgresTargets: () => {} },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: mod, exports: mod.exports, require: name => { if (!(name in imports)) throw new Error('Unmocked import'); return imports[name]; }, process: { env: {}, cwd: () => process.cwd() },
  });
  return { ...mod.exports, state };
}

test('management data and theme source reject nonowners before any query or file read', async () => {
  for (const options of [{ owner: false }, { denied: true }]) {
    const h = management(options);
    for (const fn of [h.readAppearanceStatus, h.readBugBackend, h.readCanonicalTheme, h.readPrivateAccessAvailability]) await assert.rejects(fn);
    assert.equal(h.state.queries.length, 0); assert.equal(h.state.files.length, 0);
  }
});
test('remote/unconfigured runtime cannot fall back to local owner queries', async () => {
  const h = management({ local: false });
  assert.equal((await h.readAppearanceStatus()).available, false);
  assert.equal((await h.readBugBackend()).available, false);
  assert.equal(h.state.queries.length, 0);
});
test('appearance database errors are unavailable states without leaking database diagnostics or implying empty data', async () => {
  const h = management({ queryError: true });
  const result = await h.readAppearanceStatus();
  assert.equal(result.available, false);
  assert.equal('rows' in result, false);
  assert.doesNotMatch(result.reason, /sensitive database/);
});
test('appearance metadata query excludes settings payloads and infrastructure values', async () => {
  const h = management({ rows: [{ key: 'homepage', publication: 'draft', version: 1, updated_at: '2026-11-13' }] });
  const result = await h.readAppearanceStatus();
  assert.equal(result.rows[0].key, 'homepage');
  assert.match(h.state.queries[0], /select key, publication, version/);
  assert.doesNotMatch(h.state.queries[0], /select \*|draft,|published,|storage_key/);
});
test('missing bug backend explicitly distinguishes unavailable from an empty inbox', async () => {
  const h = management({ rows: [{ present: false }] });
  const result = await h.readBugBackend();
  assert.equal(result.available, false); assert.match(result.reason, /not an empty inbox/);
});
test('canonical theme reads only its fixed source and parses actual declarations', async () => {
  const h = management({ css: ':root { --background: white; --font-body: system-ui; }' });
  const result = await h.readCanonicalTheme();
  assert.equal(result.tokens.length, 2); assert.equal(result.tokens[0].value, 'white');
  assert.equal(h.state.files[0], require('node:path').resolve('src/styles/themes.css'));
});

function mediaCatalog({ owner = true, rows = [], queryError = false } = {}) {
  const state = { queryCount: 0, limit: null, projection: null };
  const mod = { exports: {} };
  const query = {
    from() { state.queryCount++; return this; }, innerJoin() { return this; }, where() { return this; }, orderBy() { return this; },
    limit(value) { state.limit = value; return this; },
    async offset() { if (queryError) throw new Error('sensitive source URL'); return rows; },
  };
  const schema = Object.fromEntries(['posts','media'].map(table => [table, new Proxy({}, { get: (_, key) => `${table}.${String(key)}` })]));
  const imports = {
    'server-only': {},
    'drizzle-orm': Object.fromEntries(['and','asc','eq','ilike','or'].map(name => [name, (...args) => ({ name, args })])),
    '@/lib/db/schema': schema,
    '@/lib/db/owner-session': { withCurrentOwnerSession: async run => run({ select: projection => { state.projection = projection; return query; } }) },
    '@/lib/admin/management': { requireManagementOwner: async () => { if (!owner) throw new Error('DENIED'); } },
    '@/lib/db/local-postgres-target': { isLocalPostgresIntegrationEnabled: () => true, verifyAllLocalPostgresTargets: () => {} },
    '@/lib/blog/legacy-media-preview': { localLegacyBlogImagePreviewUrl: (id, source) => source === 'approved-source' ? `/api/dev/legacy-media-preview/${id}` : null },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/admin/media-catalog.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: mod, exports: mod.exports, require: name => { if (!(name in imports)) throw new Error('Unmocked import'); return imports[name]; }, process: { env: {} },
  });
  return { ...mod.exports, state };
}
test('media catalog denies before business reads and bounds the query without post content', async () => {
  const denied = mediaCatalog({ owner: false });
  await assert.rejects(() => denied.readMediaCatalog({ search: '', type: 'all', offset: 0 }));
  assert.equal(denied.state.queryCount, 0);
  const h = mediaCatalog();
  await h.readMediaCatalog({ search: '100%_match', type: 'image', offset: 0 });
  assert.equal(h.state.limit, 25);
  assert.equal('content' in h.state.projection, false);
});
test('media catalog never serializes origin URLs and distinguishes query failure from empty results', async () => {
  const h = mediaCatalog({ rows: [
    { id: 'one', type: 'image', sourceUrl: 'approved-source', title: null, caption: null, postTitle: 'Synthetic', postSlug: 'synthetic' },
    { id: 'two', type: 'image', sourceUrl: 'unapproved-source', title: null, caption: null, postTitle: 'Synthetic', postSlug: 'synthetic' },
  ] });
  const data = await h.readMediaCatalog({ search: '', type: 'all', offset: 0 });
  assert.equal(data.items[0].previewUrl, '/api/dev/legacy-media-preview/one');
  assert.equal(data.items[1].previewUrl, null);
  assert.equal('sourceUrl' in data.items[0], false);
  assert.doesNotMatch(JSON.stringify(data), /approved-source/);
  const failing = mediaCatalog({ queryError: true });
  const unavailable = await failing.readMediaCatalog({ search: '', type: 'all', offset: 0 });
  assert.equal(unavailable.available, false);
  assert.doesNotMatch(JSON.stringify(unavailable), /sensitive source/);
});

test('private-access UI readiness requires both executable database functions and fails closed on lookup errors', async () => {
  for (const options of [{ rows: [] }, { rows: [{ available: false }] }, { queryError: true }]) {
    assert.equal(await management(options).readPrivateAccessAvailability(), false);
  }
  assert.equal(await management({ rows: [{ available: true }] }).readPrivateAccessAvailability(), true);
});
