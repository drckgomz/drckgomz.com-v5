/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, member, request } = require('./harness.cjs');
const owner = member({ id: 'owner', is_owner: true });
const admin = member({ id: 'admin', role: 'admin' });
const target = member({ id: 'target' });
const loadHtml = () => harness().load('src/lib/content/projectHtml.ts');
const attacks = {
  event: '<img src="/valid.jpg" onerror="alert(1)"><div onclick="alert(2)">text</div>',
  script: '<script>alert(1)</script><p>safe</p>',
  scheme: '<a href="javascript:alert(1)">link</a>',
  entity: '<a href="jav&#x61;script:alert(1)">link</a>',
  control: '<a href="java&#10;script:alert(1)">link</a>',
  svg: '<svg onload="alert(1)"><script>alert(2)</script></svg>',
  math: '<math><mtext><img src="x" onerror="alert(1)"></mtext></math>',
  iframe: '<iframe src="/admin" srcdoc="<script>alert(1)</script>"></iframe>',
  iframeHost: '<iframe src="https://www.youtube.com.evil.invalid/embed/video"></iframe>',
  iframePath: '<iframe src="https://www.youtube.com/redirect?q=/admin"></iframe>',
  object: '<object data="data:text/html,bad"></object><embed src="bad"><applet>bad</applet>',
  data: '<img src="data:image/svg+xml,<svg onload=alert(1)>">',
  css: '<p style="position:fixed;background:url(javascript:alert(1));text-align:center">safe</p>',
  form: '<form action="/api/admin/users/target"><input autofocus onfocus="alert(1)"></form>',
  media: '<video src="javascript:alert(1)" poster="javascript:alert(2)"><source src="data:text/html,bad"></video>',
  malformed: '<scr<script>ipt>alert(1)</scr<script>ipt><IMG SRC=x ONERROR=alert(2)>',
  clobber: '<a id="location" name="document" href="/safe">safe</a>',
};
for (const [name, input] of Object.entries(attacks)) {
  test(`real server HTML sanitizer removes executable markup: ${name}`, () => {
    const clean = loadHtml().sanitizeProjectHtml(input);
    assert.ok(!/<\s*\/?\s*(script|svg|math|object|embed|applet|form|input)\b/i.test(clean), clean);
    assert.ok(!/\s(?:on\w+|srcdoc|id|name)\s*=/i.test(clean), clean);
    assert.ok(!/(?:href|src|poster)\s*=\s*"\s*(javascript|vbscript|data):/i.test(clean), clean);
    assert.ok(!/style="[^"]*(position|background|url\()/i.test(clean), clean);
    if (name.startsWith('iframe')) assert.ok(!clean.includes('<iframe'));
    assert.equal(loadHtml().sanitizeProjectHtml(clean), clean, 'sanitization must be idempotent');
  });
}
test('legitimate formatting, image/video/audio and approved YouTube embeds survive', () => {
  const { sanitizeProjectHtml } = loadHtml();
  const html = '<h2>Title</h2><p style="text-align:center"><strong>Bold</strong> <em>Italic</em></p>' +
    '<ul><li>Item</li></ul><pre><code>const a = 1;</code></pre><table><tr><td colspan="2">cell</td></tr></table>' +
    '<figure><img src="/photo.jpg" alt="Caption" loading="lazy"><figcaption>Caption</figcaption></figure>' +
    '<video controls poster="/poster.jpg"><source src="https://media.example.invalid/movie.mp4" type="video/mp4"></video>' +
    '<audio controls src="/audio.mp3"></audio><a target="_blank" href="https://example.invalid">Visit</a>' +
    '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Film" allowfullscreen></iframe>';
  const clean = sanitizeProjectHtml(html);
  for (const value of ['<h2>', '<strong>', '<em>', '<li>', '<code>', 'colspan="2"', 'alt="Caption"', '<video', '<source', '<audio', '<iframe', 'text-align:center']) assert.ok(clean.includes(value), value);
  assert.ok(clean.includes('rel="noopener noreferrer"'));
  assert.ok(clean.includes('sandbox="allow-scripts allow-same-origin allow-presentation"'));
});
for (const url of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'data:text/html,bad', 'vbscript:bad', '\\evil.invalid/path']) {
  test(`non-HTML project URLs reject unsafe schemes: ${JSON.stringify(url)}`, () => assert.equal(loadHtml().safeProjectUrl(url, true), null));
}
test('safe ordinary URLs, object keys and email links are preserved', () => {
  const { safeProjectUrl } = loadHtml();
  for (const url of ['/projects/work', 'projects/key.jpg', 'https://media.example.invalid/a.jpg', 'mailto:person@example.invalid']) assert.equal(safeProjectUrl(url, true), url);
  assert.equal(safeProjectUrl('//media.example.invalid/a.jpg'), 'https://media.example.invalid/a.jpg');
});
test('legacy HTML is sanitized before either project page or public detail/dialog data sees it', async () => {
  const malicious = attacks.event + attacks.scheme + attacks.script;
  const project = { id: 'project', slug: 'project', title: 'Synthetic', status: 'public', content: malicious, href: 'javascript:bad', image_url: 'data:text/html,bad' };
  const h = harness({ tables: { home_projects: [project], home_project_media: [] } });
  const res = await h.load('src/app/api/home/projects/[id]/route.ts').GET(request('/api/home/projects/project'), { params: Promise.resolve({ id: 'project' }) });
  const body = await res.json();
  assert.equal(body.project.href, null);
  assert.equal(body.project.image_url, null);
  assert.ok(!body.project.content.includes('onerror'));
  assert.ok(!body.project.content.includes('<script'));
  for (const page of ['src/app/[slug]/page.tsx', 'src/app/projects/[slug]/page.tsx']) {
    const tree = await h.load(page).default({ params: Promise.resolve({ slug: 'project' }) });
    assert.ok(!JSON.stringify(tree).includes('onerror'));
    assert.ok(!JSON.stringify(tree).includes('javascript:'));
  }
});
test('admin project read and write both sanitize content; the stored row is not needed for safe legacy reads', async () => {
  const h = harness({ actor: admin.id, profile: admin, tables: { home_projects: [{ id: 'p', content: attacks.event, href: 'javascript:bad' }] } });
  const route = h.load('src/app/api/admin/projects/[id]/route.ts');
  const ctx = { params: Promise.resolve({ id: 'p' }) };
  const read = await route.GET(request('/api/admin/projects/p'), ctx);
  assert.ok(!(await read.text()).includes('onerror'));
  const write = await route.PATCH(request('/api/admin/projects/p', { content: attacks.event, href: 'javascript:bad' }), ctx);
  assert.equal(write.status, 200);
  assert.ok(!h.state.writes[0].patch.content.includes('onerror'));
  assert.equal(h.state.writes[0].patch.href, null);
});
async function patch(actor, destination, values, otherProfiles = []) {
  const h = harness({ actor: actor?.id || null, profile: actor, tables: { user_profiles: [destination, ...otherProfiles] } });
  const res = await h.load('src/app/api/admin/users/[id]/route.ts').PATCH(request('/api/admin/users/target', values), { params: Promise.resolve({ id: destination.id }) });
  return { h, res };
}
for (const flags of [{ is_banned: true }, { enabled: false }, { enabled: null }, { is_banned: null }]) {
  test(`owner promotion rejects inactive or uncertain post-state: ${JSON.stringify(flags)}`, async () => {
    const { h, res } = await patch(owner, { ...target, ...flags }, { is_owner: true });
    assert.equal(res.status, 400); assert.equal(h.state.writes.length, 0);
  });
}
test('contradictory owner-and-ban/disable mutations are rejected', async () => {
  for (const values of [{ is_owner: true, is_banned: true }, { is_owner: true, enabled: false }]) {
    const { h, res } = await patch(owner, target, values);
    assert.equal(res.status, 400); assert.equal(h.state.writes.length, 0);
  }
});
test('another active owner can safely restore a banned and disabled owner', async () => {
  const destination = member({ id: 'target', is_owner: true, enabled: false, is_banned: true });
  const { h, res } = await patch(owner, destination, { enabled: true, is_banned: false });
  assert.equal(res.status, 200);
  const restored = h.state.tables.user_profiles.find(p => p.id === 'target');
  assert.equal(restored.is_owner, true); assert.equal(restored.enabled, true); assert.equal(restored.is_banned, false);
  assert.equal(restored.banned_at, null); assert.equal(restored.banned_reason, null);
});
test('ordinary admin cannot recover or change another owner', async () => {
  const { h, res } = await patch(admin, member({ id: 'target', is_owner: true, is_banned: true }), { is_banned: false });
  assert.equal(res.status, 403); assert.equal(h.state.writes.length, 0);
});
test('owner self changes remain forbidden, including last-owner restrictions', async () => {
  for (const values of [{ is_owner: false }, { enabled: false }, { is_banned: true }, { is_banned: false }]) {
    const { h, res } = await patch(owner, owner, values);
    assert.equal(res.status, 403); assert.equal(h.state.writes.length, 0);
  }
});
test('destructive co-owner management stays blocked without atomic database support, even with multiple owners', async () => {
  const destination = member({ id: 'target', is_owner: true });
  for (const values of [{ is_owner: false }, { role: 'user' }, { is_banned: true }, { enabled: false }]) {
    const { h, res } = await patch(owner, destination, values, [member({ id: 'third', is_owner: true })]);
    assert.ok([400, 409].includes(res.status)); assert.equal(h.state.writes.length, 0);
  }
});
test('concurrent recovery cannot overwrite target permission changes', async () => {
  const destination = member({ id: 'target', is_owner: true, enabled: false, is_banned: true });
  const h = harness({ actor: owner.id, profile: owner, tables: { user_profiles: [destination] } });
  h.state.beforeWrite = tables => { tables.user_profiles.find(p => p.id === 'target').is_banned = false; };
  const res = await h.load('src/app/api/admin/users/[id]/route.ts').PATCH(request('/api/admin/users/target', { enabled: true, is_banned: false }), { params: Promise.resolve({ id: 'target' }) });
  assert.equal(res.status, 409);
  assert.equal(h.state.tables.user_profiles.find(p => p.id === 'target').enabled, false);
});
test('nullable ordinary target flags use null-aware conditional updates without granting privileges', async () => {
  const destination = member({ id: 'target', role: null, is_owner: null, is_whitelist_admin: null });
  const { h, res } = await patch(admin, destination, { can_view_private: true });
  assert.equal(res.status, 200);
  const updated = h.state.tables.user_profiles.find(p => p.id === 'target');
  assert.equal(updated.role, null); assert.equal(updated.is_owner, null); assert.equal(updated.can_view_private, true);
});
test('nullable actor flags never imply administrative authority or an active account', async () => {
  for (const flags of [{ role: null, is_owner: null }, { enabled: null, role: 'admin' }, { is_banned: null, role: 'admin' }]) {
    const { h, res } = await patch(member({ id: 'actor', ...flags }), target, { can_view_private: true });
    assert.equal(res.status, 403); assert.equal(h.state.writes.length, 0);
  }
});
for (const lookup of ['Exact', 'public-id']) {
  test(`blog compatibility preserves authorized lookup: ${lookup}`, async () => {
    const h = harness({ tables: { posts: [{ id: 'slug-id', slug: 'Exact', status: 'public', media: [] }, { id: 'public-id', slug: null, status: 'public', media: [] }] } });
    const res = await h.load('src/app/api/public/blogs/[slug]/route.ts').GET(request('/api/public/blogs/x'), { params: Promise.resolve({ slug: lookup }) });
    assert.equal(res.status, 200); assert.equal((await res.json()).post.id, lookup === 'public-id' ? 'public-id' : 'slug-id');
  });
}
test('ID fallback and case folding do not bypass private/draft/archive/deletion guards', async () => {
  for (const status of ['private', 'draft', 'archived', 'deleted']) {
    for (const slug of [null, 'MiXeD']) {
      const h = harness({ tables: { posts: [{ id: 'id', slug, status, media: [{ url: 'private.jpg' }] }] } });
      const res = await h.load('src/app/api/public/blogs/[slug]/route.ts').GET(request('/api/public/blogs/x'), { params: Promise.resolve({ slug: slug ? 'mixed' : 'id' }) });
      assert.equal(res.status, 404); assert.ok(!(await res.text()).includes('private.jpg'));
    }
  }
});
test('LIKE wildcard characters are literal, not a way to select a different post', async () => {
  const h = harness({ tables: { posts: [{ id: 'id', slug: 'secret', status: 'public', media: [] }] } });
  for (const slug of ['%', '_', 'se%', 'se_ret', '*', 'se*', '.*', '^secret$']) {
    const res = await h.load('src/app/api/public/blogs/[slug]/route.ts').GET(request('/api/public/blogs/x'), { params: Promise.resolve({ slug }) });
    assert.equal(res.status, 404);
  }
});
test('literal wildcard characters and Unicode in actual slugs still work', async () => {
  for (const slug of ['100%_real', 'café', 'plus+dot.', 'star*literal', '[bracket](test)', 'slash\\literal']) {
    const h = harness({ tables: { posts: [{ id: 'id', slug, status: 'public', media: [] }] } });
    const res = await h.load('src/app/api/public/blogs/[slug]/route.ts').GET(request('/api/public/blogs/x'), { params: Promise.resolve({ slug }) });
    assert.equal(res.status, 200);
  }
});
test('case-sensitive slug lookup does not ambiguously match case variants', async () => {
  const h = harness({ tables: { posts: [{ id: 'a', slug: 'A', status: 'public' }, { id: 'b', slug: 'a', status: 'public' }] } });
  const res = await h.load('src/app/api/public/blogs/[slug]/route.ts').GET(request('/api/public/blogs/a'), { params: Promise.resolve({ slug: 'a' }) });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).post.id, 'b');
});
test('project pagination respects database order, limits and visibility on a large shuffled catalog', async () => {
  const home_projects = Array.from({ length: 1500 }, (_, i) => ({ id: `p-${String(i).padStart(4, '0')}`, idx: i, status: i % 10 === 0 ? 'private' : 'public', title: 'Synthetic', home_project_media: [], ...(i === 13 ? { deleted_at: 'date' } : {}) })).reverse();
  for (const [limit, offset] of [[1, 0], [6, 8], [50, 900]]) {
    const h = harness({ tables: { home_projects } });
    const res = await h.load('src/app/api/home/projects/route.ts').GET(request(`/api/home/projects?limit=${limit}&offset=${offset}`));
    const body = await res.json();
    const expected = home_projects.filter(p => p.status === 'public' && !p.deleted_at).sort((a,b) => a.idx-b.idx).slice(offset,offset+limit);
    assert.deepEqual(body.items.map(p => p.id), expected.map(p => p.id));
    assert.equal(h.state.queries.length, 1); assert.deepEqual(h.state.queries[0].bounds, [offset,offset+limit]); assert.equal(h.state.queries[0].limit, limit+1);
    assert.equal(body.count, null); assert.equal(body.nextOffset, offset+expected.length); assert.equal(body.hasMore, true);
  }
});
test('pagination last page, huge/invalid limits and offset handling remain bounded', async () => {
  const home_projects = [{ id: 'a', idx: 0, status: 'public', home_project_media: [] }];
  for (const query of ['limit=1000000', 'limit=NaN&offset=-1', 'limit=-1&offset=Infinity', 'limit=1&offset=200']) {
    const h = harness({ tables: { home_projects } });
    const res = await h.load('src/app/api/home/projects/route.ts').GET(request(`/api/home/projects?${query}`));
    const body = await res.json(), [start,end] = h.state.queries[0].bounds;
    assert.ok(end-start <= 50); assert.ok(start >= 0); assert.equal(body.hasMore,false);
  }
});
test('owner can enable and unban a promotion target in the same consistent grant', async () => {
  const { h, res } = await patch(owner, member({ id: 'target', enabled: false, is_banned: true }), { enabled: true, is_banned: false, is_owner: true });
  assert.equal(res.status, 200);
  const updated = h.state.tables.user_profiles.find(p => p.id === 'target');
  assert.equal(updated.enabled, true); assert.equal(updated.is_banned, false); assert.equal(updated.is_owner, true);
});
test('unknown or malformed target privileges cannot be managed by a nonowner administrator', async () => {
  for (const flags of [{ role: 'unknown-privilege' }, { is_owner: 'false' }, { is_whitelist_admin: 'false' }]) {
    const { h, res } = await patch(admin, member({ id: 'target', ...flags }), { is_banned: true });
    assert.equal(res.status, 403); assert.equal(h.state.writes.length, 0);
  }
});
test('ID fallback preserves private-reader grants without granting editorial or deleted access', async () => {
  for (const [status, deleted_at, expected] of [['private', null, 200], ['draft', null, 404], ['archived', null, 404], ['public', 'deleted', 404]]) {
    const actor = member({ can_view_private: true });
    const h = harness({ actor: actor.id, profile: actor, tables: { posts: [{ id: 'id', slug: null, status, deleted_at, media: [] }] } });
    const res = await h.load('src/app/api/public/blogs/[slug]/route.ts').GET(request('/api/public/blogs/id'), { params: Promise.resolve({ slug: 'id' }) });
    assert.equal(res.status, expected);
  }
});
test('legacy blog HTML cannot execute through the shared admin editor initialization', async () => {
  const h = harness({ tables: { posts: [{ id: 'p', slug: 'p', content: attacks.event + '<p>[MEDIA IMAGE: caption (media-id)]</p>' }], media: [] } });
  const post = await h.load('src/lib/admin/getAdminPost.ts').getAdminPostBySlug('p');
  assert.ok(!post.content.includes('onerror'));
  assert.ok(post.content.includes('[MEDIA IMAGE: caption (media-id)]'));
});
test('media caption updates cannot create executable HTML in the shared editor', () => {
  const { replaceHtmlPlaceholder } = harness().load('src/lib/content/placeholder.ts');
  const replacement = '[MEDIA IMAGE: <img src=x onerror=alert(1)> & $& (media-id)]';
  const html = replaceHtmlPlaceholder('<p>[MEDIA IMAGE: old (media-id)]</p>', /\[MEDIA[^\]]*\]/g, replacement);
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; $&'));
  assert.equal(loadHtml().sanitizeProjectHtml(html), html);
});
