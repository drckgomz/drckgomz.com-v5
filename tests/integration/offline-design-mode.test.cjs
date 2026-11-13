/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const file = path.join(root, 'src/lib/offline-design-mode.ts');
const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  fileName: file,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const testModule = { exports: {} };
const sandbox = { module: testModule, exports: testModule.exports, process: { env: {} } };
new vm.Script(output).runInNewContext(sandbox);
const { isOfflineDesignMode, isOfflineDesignRouteAllowed } = testModule.exports;
const sampleSource = fs.readFileSync(path.join(root, 'src/lib/blog/offline-samples.ts'), 'utf8');

test('offline design is disabled by default and accepts only explicit development opt-in', () => {
  assert.equal(isOfflineDesignMode({ NODE_ENV: 'development' }), false);
  assert.equal(isOfflineDesignMode({ NODE_ENV: 'development', OFFLINE_DESIGN_MODE: '1' }), true);
});

test('malformed or non-development opt-ins fail closed', () => {
  for (const env of [
    { NODE_ENV: 'development', OFFLINE_DESIGN_MODE: 'true' },
    { NODE_ENV: 'development', OFFLINE_DESIGN_MODE: 'yes' },
    { NODE_ENV: 'production', OFFLINE_DESIGN_MODE: '1' },
    { NODE_ENV: 'test', OFFLINE_DESIGN_MODE: '1' },
  ]) assert.throws(() => isOfflineDesignMode(env), { name: 'OfflineDesignConfigurationError' });
});

test('offline allowlist admits public home, terminal shell, blog index, and known sample articles only', () => {
  assert.equal(isOfflineDesignRouteAllowed('/'), true);
  assert.equal(isOfflineDesignRouteAllowed('/terminal'), true);
  assert.equal(isOfflineDesignRouteAllowed('/blog'), true);
  assert.equal(isOfflineDesignRouteAllowed('/blog/offline-public-sample-one'), true);
  assert.equal(isOfflineDesignRouteAllowed('/blog/offline-public-sample-two'), true);
  for (const route of ['/admin', '/admin/users', '/blog/private-access', '/blog/one/two', '/private/journal', '/api/private/journal', '/api/admin/posts', '/api/public/blogs', '/api/auth/sign-in', '/sign-in', '/sign-up']) {
    assert.equal(isOfflineDesignRouteAllowed(route), false, `${route} must remain inaccessible`);
  }
});

test('offline homepage avoids server data loaders and provider initialization', () => {
  const homepage = fs.readFileSync(path.join(root, 'src/components/home/OfflineHomePage.tsx'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'src/app/page.tsx'), 'utf8');
  const layout = fs.readFileSync(path.join(root, 'src/app/layout.tsx'), 'utf8');
  const middleware = fs.readFileSync(path.join(root, 'src/middleware.ts'), 'utf8');
  const blogLayout = fs.readFileSync(path.join(root, 'src/app/(protected)/blog/layout.tsx'), 'utf8');
  assert.doesNotMatch(homepage, /supabase|ClerkProvider|BetterAuthSessionProvider|fetch\(/i);
  assert.match(page, /if \(isOfflineDesignMode[\s\S]*?return <OfflineHomePage \/>/);
  assert.match(layout, /getBackendConfiguration\(\)/);
  assert.doesNotMatch(middleware, /@clerk\//);
  assert.doesNotMatch(middleware, /createRouteMatcher\(\[[\s\S]*?"\/blog/);
  assert.doesNotMatch(blogLayout, /requireUserProfile\(\)/);
});

test('offline blog preserves the original heading and card presentation with clearly labeled local fixtures', () => {
  const blogPage = fs.readFileSync(path.join(root, 'src/app/(protected)/blog/page.tsx'), 'utf8');
  const grid = fs.readFileSync(path.join(root, 'src/components/blog/AllPostsGrid.tsx'), 'utf8');
  assert.match(blogPage, /Welcome to the Blog!/);
  assert.doesNotMatch(blogPage, /Journal|Offline preview|invented categories/i);
  assert.match(grid, /grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2/);
  assert.match(grid, /StatusBadge status=\{post\.status\}/);
  assert.match(grid, /Sign up or sign in to request access\./);
  assert.match(grid, /\/sign-up/);
  assert.match(grid, /\/sign-in/);
  assert.doesNotMatch(grid, /post\.category|post\.excerpt/);
});

test('offline article fixtures are explicitly labeled and use only a neutral local image', () => {
  assert.equal((sampleSource.match(/status: "public"/g) || []).length, 3); // union type plus two public records
  assert.match(sampleSource, /LOCAL SAMPLE — Public post/);
  assert.match(sampleSource, /LOCAL SAMPLE — Second public post/);
  assert.match(sampleSource, /<h2>/);
  assert.match(sampleSource, /<pre><code>/);
  assert.match(sampleSource, /<figcaption/);
  assert.match(sampleSource, /Embedded media fixture/);
  assert.match(sampleSource, /\/offline-blog-fixture\.svg/);
  assert.doesNotMatch(sampleSource, /https?:\/\//);
});
