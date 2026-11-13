/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'); const assert = require('node:assert/strict');
const { buildSync } = require('esbuild'); const vm = require('node:vm');
const code = buildSync({ entryPoints: ['src/lib/cms/media-metadata.ts'], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const mod = { exports: {} }; vm.runInNewContext(code, { module: mod, exports: mod.exports, Response, Request, TextDecoder, Uint8Array, URL });
const { createMediaMetadataHandlers } = mod.exports;
function fixture({ denied = null, unavailable = false } = {}) {
  let item = { id: 'synthetic-media', title: null, caption: null, alt_text: '', revision: 1 }; let writes = 0;
  const handlers = createMediaMetadataHandlers({ authorize: async () => denied, read: async () => unavailable ? { kind: 'unavailable' } : { kind: 'ok', item },
    write: async (_id, patch) => { writes++; if (unavailable) return { kind: 'unavailable' }; if (patch.expected_revision !== item.revision) return { kind: 'conflict' }; item = { ...item, title: patch.title, caption: patch.caption, alt_text: patch.alt_text, revision: item.revision + 1 }; return { kind: 'ok', item }; } });
  return { handlers, writes: () => writes };
}
const data = { title: 'Synthetic', caption: 'Caption', alt_text: 'Accessible description', expected_revision: 1 };
const request = (body, origin = 'http://localhost:3000') => new Request('http://localhost:3000/api/admin/media/synthetic-media/metadata', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Host: 'localhost:3000', Origin: origin }, body: JSON.stringify(body) });
test('media metadata contract persists sanitized text and detects stale revisions', async () => {
  const h = fixture(); const saved = await h.handlers.PATCH(request(data), 'synthetic-media'); assert.equal(saved.status, 200);
  const refreshed = await (await h.handlers.GET(new Request('http://localhost:3000'), 'synthetic-media')).json(); assert.equal(refreshed.item.alt_text, data.alt_text); assert.equal(refreshed.item.revision, 2);
  assert.equal((await h.handlers.PATCH(request(data), 'synthetic-media')).status, 409);
});
test('media metadata denies unauthorized and cross-origin writes before storage', async () => {
  const h = fixture({ denied: Response.json({ error: 'Forbidden' }, { status: 403 }) }); assert.equal((await h.handlers.PATCH(request(data), 'synthetic-media')).status, 403); assert.equal(h.writes(), 0);
  const other = fixture(); assert.equal((await other.handlers.PATCH(request(data, 'https://evil.invalid'), 'synthetic-media')).status, 403); assert.equal(other.writes(), 0);
});
test('media metadata rejects storage-key changes, privilege fields, invalid alt text and missing revisions', async () => {
  for (const value of [{ ...data, url: 'https://evil.invalid/' }, { ...data, is_owner: true }, { ...data, alt_text: null }, { ...data, alt_text: 'x'.repeat(501) }, { ...data, expected_revision: 0 }]) {
    const h = fixture(); assert.ok([400,428].includes((await h.handlers.PATCH(request(value), 'synthetic-media')).status)); assert.equal(h.writes(), 0);
  }
});
test('missing metadata migration is an explicit unavailable response', async () => {
  const h = fixture({ unavailable: true }); const response = await h.handlers.GET(new Request('http://localhost:3000'), 'synthetic-media'); assert.equal(response.status, 503); assert.equal('item' in await response.json(), false);
});
test('oversized metadata requests are rejected before storage', async () => {
  const h = fixture(); assert.equal((await h.handlers.PATCH(request({ ...data, caption: 'x'.repeat(20000) }), 'synthetic-media')).status, 413); assert.equal(h.writes(), 0);
});
