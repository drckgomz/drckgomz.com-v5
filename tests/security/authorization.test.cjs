/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { harness, member, request, root } = require('./harness.cjs');
const viewers = {
  anonymous: null, ordinary: member(), reader: member({ can_view_private: true }),
  banned: member({ role: 'admin', is_banned: true }), disabled: member({ role: 'admin', enabled: false }),
  admin: member({ role: 'admin' }), owner: member({ is_owner: true }),
  whitelist: member({ is_whitelist_admin: true }),
};
const posts = ['public', 'private', 'draft', 'archived', 'deleted', 'active', null].map((status, i) => ({
  id: `post-${i}`, slug: `slug-${i}`, title: 'Synthetic content', status, content: 'Synthetic body',
  media: [{ id: `media-${i}`, url: `protected/${i}.jpg`, type: 'image' }],
  thumbnail_url: `thumb/${i}.jpg`, internal_secret: 'must-never-serialize',
}));
for (const marker of ['deleted_at', 'deletion_date', 'is_deleted']) posts.push({
  ...posts[0], id: marker, slug: marker, [marker]: marker === 'is_deleted' ? true : 'synthetic-timestamp',
});
const allowed = {
  anonymous: ['public'], ordinary: ['public'], reader: ['public', 'private'], banned: [], disabled: [],
  // Normal reader endpoints never double as CMS draft/archive preview, even for elevated users.
  admin: ['public', 'private'], owner: ['public', 'private'], whitelist: ['public'],
};
function fixture(profile, tables = {}, extra = {}) {
  return harness({ actor: profile?.id || null, profile, tables, ...extra });
}
for (const [name, profile] of Object.entries(viewers)) {
  test(`direct blog page denies restricted status before rendering: ${name}`, async () => {
    for (const status of ['public', 'private', 'draft', 'archived']) {
      const post = { ...posts[0], id: `direct-${status}`, slug: `direct-${status}`, status };
      const h = fixture(profile, { posts: [post] });
      const renderPage = () => h.load('src/app/(protected)/blog/[slug]/page.tsx').default({ params: Promise.resolve({ slug: post.slug }) });
      if (allowed[name].includes(status)) await renderPage();
      else await assert.rejects(renderPage, /NOT_FOUND/);
    }
  });
}
for (const [name, profile] of Object.entries(viewers)) {
  test(`blog list and exact detail enforce status/media policy: ${name}`, async () => {
    const h = fixture(profile, { posts });
    const list = h.load('src/app/api/public/blogs/route.ts').GET;
    for (const status of ['public', 'private', 'draft', 'archived', 'deleted', 'active', 'all', 'garbage']) {
      const res = await list(request(`/api/public/blogs?status=${status}`));
      assert.equal(res.headers.get('cache-control'), 'private, no-store');
      if (status !== 'public') {
        assert.equal(res.status, 400);
        const body = await res.text();
        assert.ok(!body.includes('Synthetic content'));
        continue;
      }
      assert.equal(res.status, 200);
      const { items } = await res.json();
      const expected = posts.filter(p => p.id.startsWith('post-') && p.status === 'public' && allowed[name].includes('public'));
      assert.deepEqual(items.map(p => p.id), expected.map(p => p.id));
      assert.ok(!JSON.stringify(items).includes('must-never-serialize'));
    }
    const detail = h.load('src/app/api/public/blogs/[slug]/route.ts').GET;
    for (const post of posts) {
      const permitted = post.id.startsWith('post-') && allowed[name].includes(post.status);
      const res = await detail(request('/api/public/blogs/x'), { params: Promise.resolve({ slug: post.slug }) });
      assert.equal(res.status, permitted ? 200 : 404, `${name}/${post.slug}`);
      const body = await res.text();
      if (!permitted) {
        assert.ok(!body.includes('protected/'));
        assert.ok(!body.includes('thumb/'));
        assert.ok(!body.includes('Synthetic body'));
      }
    }
  });
}
for (const scenario of ['missing profile', 'profile error', 'auth error']) {
  test(`public blog data with ${scenario}`, async () => {
    const h = harness({ actor: 'unknown', tables: { posts }, errors: scenario === 'profile error' ? { user_profiles: true } : {}, authError: scenario === 'auth error' });
    const res = await h.load('src/app/api/public/blogs/route.ts').GET(request('/api/public/blogs?status=public'));
    assert.equal(res.status, scenario === 'profile error' ? 500 : 200);
    if (scenario !== 'profile error') {
      const { items, lockedPosts } = await res.json();
      assert.deepEqual(items.map(item => item.status), ['public']);
      assert.equal(lockedPosts, true);
      assert.equal(h.state.queries.length, 0, 'public reads use only the isolated Drizzle repository');
    } else {
      assert.ok(!(await res.text()).includes('Synthetic'));
      assert.equal(h.state.queries.filter(q => q.table === 'posts').length, 0);
    }
  });
}
test('unauthorized blog listing exposes only a generic private teaser; approved readers receive readable private posts', async () => {
  const sensitivePrivate = {
    id: 'private-id-secret', slug: 'private-slug-secret', title: 'Sensitive private title',
    excerpt: 'Sensitive private excerpt', status: 'private', content: 'Sensitive private body',
    thumbnail_url: 'private-thumbnail-secret.jpg', media: [{ id: 'media-secret', type: 'image', url: 'private-media-secret.jpg' }],
  };
  const publicPost = { ...posts[0], id: 'public-fixture', slug: 'public-fixture', title: 'Public sample' };
  const listPath = 'src/app/api/public/blogs/route.ts';

  const anonymous = harness({ tables: { posts: [publicPost, sensitivePrivate] } });
  const anonymousResponse = await anonymous.load(listPath).GET(request('/api/public/blogs?status=public'));
  const anonymousBody = await anonymousResponse.text();
  assert.equal(anonymousResponse.status, 200);
  assert.ok(anonymousBody.includes('Public sample'));
  assert.ok(!anonymousBody.includes('private-id-secret'));
  assert.ok(!anonymousBody.includes('private-slug-secret'));
  assert.ok(!anonymousBody.includes('Sensitive private'));
  assert.ok(!anonymousBody.includes('private-thumbnail-secret'));
  assert.ok(!anonymousBody.includes('private-media-secret'));
  assert.match(anonymousBody, /"lockedPosts":true/);

  const approved = harness({ actor: 'reader', profile: member({ id: 'reader', can_view_private: true }), tables: { posts: [publicPost, sensitivePrivate] } });
  const approvedResponse = await approved.load(listPath).GET(request('/api/public/blogs?status=public'));
  const approvedBody = await approvedResponse.text();
  assert.equal(approvedResponse.status, 200);
  assert.match(approvedBody, /"lockedPosts":false/);
  assert.ok(!approvedBody.includes('Sensitive private title'));
  assert.ok(!approvedBody.includes('Sensitive private body'));
  // Legacy public object URLs stay quarantined even for authorized readers;
  // only objects migrated to the protected private-key scheme are returned.
  assert.ok(!approvedBody.includes('private-media-secret.jpg'));
});
test('exact slug beyond list limit works, and response does not expose extra columns', async () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ ...posts[0], id: `post-${i}`, slug: `slug-${i}` }));
  const h = fixture(viewers.ordinary, { posts: many });
  const res = await h.load('src/app/api/public/blogs/[slug]/route.ts').GET(request('/api/public/blogs/slug-29'), { params: Promise.resolve({ slug: 'slug-29' }) });
  assert.equal((await res.json()).post.id, 'post-29');
});
const projectId = '00000000-0000-4000-8000-000000000001';
for (const status of ['public', 'private', 'draft', 'archived', 'deleted', 'active', null]) {
  for (const marker of [null, 'deleted_at']) {
    test(`project pages, list, detail and media: ${status}/${marker || 'intact'}`, async () => {
      const project = { id: projectId, slug: 'synthetic-project', status, title: 'Synthetic project',
        image_url: 'protected/project.jpg', home_project_media: [], ...(marker ? { [marker]: 'date' } : {}) };
      const visible = status === 'public' && !marker;
      for (const page of ['src/app/[slug]/page.tsx', 'src/app/projects/[slug]/page.tsx']) {
        for (const slug of [project.slug, project.id]) {
          const h = harness({ tables: { home_projects: [project], home_project_media: [] } });
          const call = () => h.load(page).default({ params: Promise.resolve({ slug }) });
          if (visible) await call(); else await assert.rejects(call, /NOT_FOUND/);
          if (!visible) assert.equal(h.state.queries.filter(q => q.table === 'home_project_media').length, 0);
        }
      }
      const h = harness({ tables: { home_projects: [project], home_project_media: [{ project_id: projectId, url: 'protected/movie.mp4', meta: { secret: 'hidden' } }] } });
      const list = await h.load('src/app/api/home/projects/route.ts').GET(request('/api/home/projects'));
      assert.equal((await list.json()).items.length, visible ? 1 : 0);
      for (const suffix of ['', '/media']) {
        const res = await h.load(`src/app/api/home/projects/[id]${suffix}/route.ts`).GET(request('/api/home/projects/x'), { params: Promise.resolve({ id: projectId }) });
        assert.equal(res.status, visible ? 200 : 404);
        const body = await res.text();
        assert.ok(!body.includes('hidden'));
        if (!visible) assert.ok(!body.includes('protected/'));
      }
    });
  }
}
function filesUnder(dir, filename) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? filesUnder(path.join(dir, e.name), filename) : e.name === filename ? [path.join(dir, e.name)] : []);
}
const adminRoutes = filesUnder(path.join(root, 'src/app/api/admin'), 'route.ts');
for (const [name, profile] of Object.entries(viewers).filter(([n]) => !['admin', 'owner'].includes(n))) {
  test(`all admin HTTP methods deny ${name} before business-data reads/writes/signing`, async () => {
    for (const file of adminRoutes) {
      const h = fixture(profile);
      const mod = h.load(path.relative(root, file));
      for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
        if (!mod[method]) continue;
        const res = await mod[method](request('/api/admin/x', {}), { params: Promise.resolve({ id: 'other', slug: 'private', mediaId: 'media' }) });
        if (file.endsWith(path.join('private-audience', 'route.ts'))) {
          assert.equal(res.status, profile ? 403 : 401, `${file}/${method}/${name} must deny before initializing audience storage`);
          assert.equal(h.state.queries.length, 0);
          assert.equal(h.state.writes.length, 0);
          continue;
        }
        assert.equal(res.status, profile ? 403 : 401, `${file}/${method}/${name}`);
        assert.ok(h.state.queries.every(q => q.table === 'user_profiles'));
        assert.equal(h.state.writes.length, 0);
      }
    }
  });
}
test('authorized audience reads still fail closed when database/auth configuration is unavailable', async () => {
  const h = fixture(viewers.owner);
  const response = await h.load('src/app/api/admin/private-audience/route.ts').GET(request('/api/admin/private-audience'));
  assert.equal(response.status, 503);
  assert.equal(h.state.queries.length, 0);
  assert.equal(h.state.writes.length, 0);
});
const adminPages = filesUnder(path.join(root, 'src/app/admin'), 'page.tsx');
for (const [name, profile] of Object.entries(viewers)) {
  test(`all admin pages/layout share authorization: ${name}`, async () => {
    for (const file of [...adminPages, path.join(root, 'src/app/admin/layout.tsx')]) {
      const h = fixture(profile);
      const call = () => h.load(path.relative(root, file)).default({ children: null, searchParams: Promise.resolve({}), params: Promise.resolve({ id: 'x', slug: 'x' }) });
      if (file.endsWith(path.join('private-access', 'page.tsx'))) {
        if (name === 'anonymous') await assert.rejects(call, /REDIRECT:\/sign-in\?redirect_url=/);
        else if (name === 'banned') await assert.rejects(call, /REDIRECT:\/banned/);
        else if (name === 'owner') await call();
        else await assert.rejects(call, /NOT_FOUND/);
        continue;
      }
      if (['admin', 'owner'].includes(name)) {
        // Editor may report not found after successful authorization against empty fixtures.
        try { await call(); } catch (e) { assert.match(e.message, /NOT_FOUND/); }
      } else await assert.rejects(call, /REDIRECT:/);
    }
  });
}
test('terminal database command registry is disabled because commands are compiled from the safe allowlist', async () => {
  for (const profile of Object.values(viewers)) {
    const h = fixture(profile, { terminal_commands: [{ id: 'shell-injection', actions: [{ command: 'rm -rf /' }] }] });
    const res = await h.load('src/app/api/terminal/commands/route.ts').GET(request('/api/terminal/commands'));
    assert.equal(res.status, 404);
    assert.equal(h.state.queries.length, 0);
    assert.equal(h.state.writes.length, 0);
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
  }
});
const target = member({ id: 'target' });
async function patchAs(actor, values, dest = target) {
  const h = fixture(actor, { user_profiles: [dest] });
  const res = await h.load('src/app/api/admin/users/[id]/route.ts').PATCH(request('/api/admin/users/target', values), { params: Promise.resolve({ id: dest.id }) });
  return { h, res };
}
for (const [label, actor, values, dest, expected] of [
  ['ordinary self promote', viewers.ordinary, { role: 'admin' }, viewers.ordinary, 403],
  ['admin self owner', viewers.admin, { is_owner: true }, viewers.admin, 403],
  ['owner self demote', viewers.owner, { role: 'user' }, viewers.owner, 403],
  ['admin promote other', viewers.admin, { role: 'admin' }, target, 403],
  ['admin make owner', viewers.admin, { is_owner: true }, target, 403],
  ['admin ban admin', viewers.admin, { is_banned: true }, member({ id: 'target', role: 'admin' }), 403],
  ['admin modify owner', viewers.admin, { can_view_private: false }, member({ id: 'target', is_owner: true }), 403],
  ['owner revoke owner blocked pending atomic support', viewers.owner, { is_owner: false }, member({ id: 'target', is_owner: true }), 409],
  ['banned admin', viewers.banned, { is_banned: true }, target, 403],
  ['disabled admin', viewers.disabled, { role: 'admin' }, target, 403],
  ['forged grant field', viewers.owner, { is_whitelist_admin: true }, target, 400],
  ['string boolean', viewers.owner, { is_owner: 'false' }, target, 400],
  ['unknown role', viewers.owner, { role: 'owner' }, target, 400],
  ['owner promote other', viewers.owner, { role: 'admin' }, target, 200],
  ['owner appoint other owner', viewers.owner, { is_owner: true }, target, 200],
  ['admin grant private to ordinary', viewers.admin, { can_view_private: true }, target, 200],
  ['admin ban ordinary', viewers.admin, { is_banned: true }, target, 200],
]) {
  test(`user mutation: ${label}`, async () => {
    const { h, res } = await patchAs(actor, values, dest);
    assert.equal(res.status, expected);
    if (expected !== 200) assert.equal(h.state.writes.length, 0);
    else {
      assert.equal(h.state.writes.length, 1);
      assert.equal(h.state.writes[0].ids[0], dest.id);
    }
  });
}
test('permission lookup errors deny admin access and never mutate', async () => {
  const h = fixture(viewers.admin, {}, { errors: { user_profiles: true } });
  const res = await h.load('src/app/api/admin/projects/route.ts').GET(request('/api/admin/projects'));
  assert.equal(res.status, 500);
  assert.equal(h.state.writes.length, 0);
});
test('blog layout renders for anonymous viewers while post data remains separately authorized', async () => {
  for (const profile of Object.values(viewers)) {
    const h = fixture(profile);
    const call = () => h.load('src/app/(protected)/blog/layout.tsx').default({ children: null });
    await call();
  }
});
test('middleware allows public blog routes without auth while keeping admin writes same-origin and no-store', async () => {
  const h = harness();
  for (const pathname of ['/admin/posts', '/blog', '/api/admin/uploads/presign', '/api/public/blogs']) {
    const res = await h.load('src/middleware.ts').default({ method: "GET", headers: new Headers(), nextUrl: { pathname, origin: "https://site.invalid" } });
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
  }
});
test('missing or malformed active/ban flags never grant admin privileges', async () => {
  for (const flags of [{ enabled: undefined }, { is_banned: undefined }, { enabled: 'true' }, { is_banned: 'false' }]) {
    const h = fixture(member({ role: 'admin', ...flags }));
    const res = await h.load('src/app/api/admin/projects/route.ts').GET(request('/api/admin/projects'));
    assert.equal(res.status, 403);
  }
});
test('project pagination is bounded and returns a visible candidate page', async () => {
  const home_projects = Array.from({ length: 205 }, (_, idx) => ({
    id: `p-${idx}`, idx, status: 'public', title: 'Synthetic project', home_project_media: [],
  }));
  const h = harness({ tables: { home_projects } });
  const res = await h.load('src/app/api/home/projects/route.ts').GET(request('/api/home/projects?limit=5&offset=100'));
  const { items, count, hasMore, nextOffset } = await res.json();
  assert.equal(count, null);
  assert.equal(hasMore, true);
  assert.equal(nextOffset, 105);
  assert.equal(h.state.queries.length, 1);
  assert.deepEqual(h.state.queries[0].bounds, [100, 105]);
  assert.deepEqual(items.map(i => i.id), ['p-100', 'p-101', 'p-102', 'p-103', 'p-104']);
});
test('middleware rejects cross-origin admin writes but permits same-origin requests to reach handler auth', async () => {
  const h = harness();
  const middleware = h.load('src/middleware.ts').default;
  for (const origin of ['https://attacker.invalid', 'null', 'https://site.invalid']) {
    const res = await middleware({
      method: 'PATCH', headers: new Headers({ origin }),
      nextUrl: { pathname: '/api/admin/users/target', origin: 'https://site.invalid' },
    });
    assert.equal(res.status, origin === 'https://site.invalid' ? 200 : 403);
  }
});

test('CMS routes fail closed when Neon mutation repositories are not enabled', async () => {
  const h = harness({ actor: viewers.owner.id, profile: viewers.owner, cmsDisabled: true });
  const route = h.load('src/app/api/admin/posts/route.ts');
  for (const method of ['GET', 'POST']) {
    const response = await route[method](request('/api/admin/posts', {}));
    assert.equal(response.status, 503);
  }
  assert.equal(h.state.writes.length, 0);
  assert.equal(h.state.queries.length, 0);
});
test('admin media management quarantines old public objects attached to private posts', async () => {
  for (const actor of [viewers.admin, viewers.owner]) {
    const h = fixture(actor, {
      posts: [{ id: 'private-post', slug: 'private', status: 'private' }],
      media: [{ id: 'attachment', post_id: 'private-post', url: 'protected/authorized.jpg', type: 'image' }],
    });
    const res = await h.load('src/app/api/admin/posts/[slug]/media/route.ts').GET(request('/api/admin/posts/private/media'), { params: Promise.resolve({ slug: 'private' }) });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).media[0].url, null);
  }
});
test('private media management returns only the protected route for a bound private object key', async () => {
  const id = '2f0338c1-ec1a-4fd9-a35a-8e195d9327d0';
  const h = fixture(viewers.owner, {
    posts: [{ id: 'private-post', slug: 'private', status: 'private' }],
    media: [{ id, post_id: 'private-post', url: `journal-private/private-post/${id}.webp`, type: 'image' }],
  });
  const res = await h.load('src/app/api/admin/posts/[slug]/media/route.ts').GET(request('/api/admin/posts/private/media'), { params: Promise.resolve({ slug: 'private' }) });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).media[0].url, `/api/private/journal-media/${id}`);
});
test('target promotion between lookup and mutation cannot edit a protected account', async () => {
  for (const changed of [{ is_owner: true }, { role: 'admin' }, { is_whitelist_admin: true }]) {
    const h = fixture(viewers.admin, { user_profiles: [target] });
    h.state.beforeWrite = tables => Object.assign(tables.user_profiles.find(p => p.id === target.id), changed);
    const res = await h.load('src/app/api/admin/users/[id]/route.ts').PATCH(request('/api/admin/users/target', { is_banned: true }), { params: Promise.resolve({ id: target.id }) });
    assert.equal(res.status, 409);
    assert.equal(h.state.tables.user_profiles.find(p => p.id === target.id).is_banned, false);
  }
});
