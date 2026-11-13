import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';

const screenshotDir = process.env.BLOG_REVIEW_OUTPUT || '.artifacts/blog-review';

const sizes = { mobile: { width: 375, height: 812 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1440, height: 900 }, ultrawide: { width: 2560, height: 1440 } };
test.beforeEach(async ({ page }) => {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    // Third parties are synthetic stand-ins; no provider receives a request.
    if (url.hostname === 'www.youtube.com') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><title>Synthetic embed</title><body style="background:#183b40;color:white">Synthetic video frame</body></html>' });
    if (url.hostname === 'www.instagram.com') return route.fulfill({ contentType: 'text/javascript', body: 'window.instgrm={Embeds:{process(){}}};' });
    return route.abort('blockedbyclient');
  });
  await page.route('**/api/admin/posts/synthetic/media', route => route.fulfill({ json: { media: [] } }));
});

for (const [size, viewport] of Object.entries(sizes)) for (const theme of ['light', 'dark']) for (const scenario of ['long', 'media', 'mixed', 'error']) {
  test(`${size} ${theme} ${scenario}: responsive article and navigation`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/review?case=${scenario}&theme=${theme}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (scenario !== 'error') await expect(page.locator('.blog-content h2').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(overflow).toBe(false);
    for (const box of await page.locator('.blog-content img,.blog-content iframe,.blog-content video,.blog-content audio').all()) {
      const rect = await box.boundingBox();
      if (rect) { expect(rect.x).toBeGreaterThanOrEqual(-1); expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width + 1); }
    }
    const a11y = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(a11y.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(', ')}`)).toEqual([]);
    expect(errors).toEqual([]);
    await fs.mkdir(`${screenshotDir}/screenshots`, { recursive: true });
    await page.screenshot({ path: `${screenshotDir}/screenshots/${size}-${theme}-${scenario}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Journal', exact: true }).click();
    await expect(page).toHaveURL(/case=long/);
  });
}

test('embeds are opt-in; native interactions and hostile legacy markup stay safe', async ({ page }) => {
  const external: string[] = [];
  page.on('request', req => { if (req.url().includes('instagram.com')) external.push(req.url()); });
  await page.goto('/review?case=mixed');
  await expect(page.locator('.blog-content iframe')).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
  expect(external).toEqual([]);
  expect(await page.locator('.blog-content [onerror],.blog-content script,.blog-content [href^="javascript:"]').count()).toBe(0);
  expect(await page.locator('.blog-content iframe').count()).toBe(1);
  await page.getByText('Interactive notes', { exact: true }).click();
  await expect(page.getByText('Native disclosure remains keyboard accessible.')).toBeVisible();
  await page.getByRole('button', { name: 'Load Instagram embeds' }).click();
  await expect.poll(() => external.length).toBe(1);
});

for (const [size, viewport] of Object.entries(sizes)) test(`${size}: real editor preview/save/conflict/publish flow`, async ({ page }) => {
  await page.setViewportSize(viewport);
  let saves = 0;
  const payloads: Record<string, unknown>[] = [];
  await page.route('**/api/admin/posts/synthetic', async route => {
    payloads.push(route.request().postDataJSON()); saves++;
    if (saves === 2) return route.fulfill({ status: 409, json: { error: 'This post changed in another session. Reload before saving.' } });
    return route.fulfill({ json: { post: { slug: 'synthetic', updated_at: '2026-02-01T00:00:00.000Z' } } });
  });
  await page.goto('/review?case=admin&theme=dark');
  await page.getByLabel('Title', { exact: true }).fill('Edited synthetic draft');
  await expect(page.getByRole('status')).toContainText('Unsaved');
  await page.getByRole('button', { name: 'Preview unsaved post' }).click();
  await expect(page.getByRole('region', { name: 'Unsaved post preview' })).toContainText('Edited synthetic draft');
  expect(saves).toBe(0);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Changes saved');
  expect(payloads[0].expected_updated_at).toBe('2026-01-01T00:00:00.000Z');
  await page.getByLabel('Title', { exact: true }).fill('Conflict edit');
  await expect(page.getByRole('status')).toContainText('Unsaved changes');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('another session');
  expect(payloads[1].expected_updated_at).toBe('2026-02-01T00:00:00.000Z');
  await page.getByLabel('Status', { exact: true }).selectOption('public');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Save & publish' }).click();
  expect(saves).toBe(2);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Save & publish' }).click();
  await expect(page.getByRole('status')).toContainText('Published successfully');
  expect(payloads[2].status).toBe('public');
  const overflowing = await page.locator('body *').evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(node => `${node.tagName}.${node.className}`));
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), overflowing.join(', ')).toBe(false);
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(a11y.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, detail: n.failureSummary })) }))).toEqual([]);
  await page.screenshot({ path: `${screenshotDir}/screenshots/${size}-dark-admin.png`, fullPage: true });
});

test('create form validates locally and retains input on server failure', async ({ page }) => {
  await page.route('**/api/admin/posts', route => route.fulfill({ status: 409, json: { error: 'A post with this slug already exists.' } }));
  await page.goto('/review?case=create&theme=dark');
  await page.getByRole('button', { name: 'Create & edit' }).click();
  await expect(page.getByRole('alert')).toContainText('Title is required');
  await page.getByLabel('Title', { exact: true }).fill('Duplicate draft');
  await page.getByRole('button', { name: 'Create & edit' }).click();
  await expect(page.getByRole('alert')).toContainText('already exists');
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Duplicate draft');
});

test('320px, enlarged text and reduced motion keep the article usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/review?case=mixed');
  await expect(page.locator('.blog-content h2').first()).toBeVisible();
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.screenshot({ path: `${screenshotDir}/screenshots/mobile-large-text.png`, fullPage: true });
});

for (const [size, viewport] of Object.entries(sizes)) test(`${size}: light publishing theme`, async ({ page }) => {
  await page.setViewportSize(viewport);
  await page.goto('/review?case=admin&theme=light');
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(a11y.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  await page.screenshot({ path: `${screenshotDir}/screenshots/${size}-light-admin.png`, fullPage: true });
});

test('editor sanitizes rich paste and media failures preserve the editable post', async ({ page }) => {
  await page.route('**/api/admin/posts/synthetic/media', route => route.fulfill({ json: { media: [{ id: 'm1', type: 'image', url: '/fixture-image.svg', caption: 'Fixture caption', idx: 0 }] } }));
  await page.route('**/api/admin/media/m1', route => route.fulfill({ status: 500, body: 'Synthetic media service unavailable' }));
  await page.goto('/review?case=admin&theme=dark');
  const editor = page.getByRole('textbox', { name: 'Post content' });
  await editor.focus();
  await editor.evaluate(node => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/html', '<p style="text-align:center;position:fixed">Pasted format</p><img src="/fixture-image.svg" alt="Synthetic pasted image" onerror="window.pasteAttack=true"><script>window.pasteAttack=true</script>');
    node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }));
  });
  await expect(editor).toContainText('Pasted format');
  expect(await editor.locator('[onerror],script,[style*=position]').count()).toBe(0);
  await page.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(editor).toContainText('(m1)');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic media service unavailable');
  await expect(editor).toContainText('Pasted format');
});

test('all theme scopes accept explicit variants and nested light overrides dark', async ({ page }) => {
  await page.goto('/review?case=error&theme=dark');
  const results = await page.evaluate(() => ['public', 'blog', 'admin', 'terminal'].map(scope => {
    const outer = document.createElement('section'); outer.dataset.theme = 'dark'; outer.dataset.themeScope = scope;
    const inner = document.createElement('section'); inner.dataset.theme = 'light'; inner.dataset.themeScope = scope;
    outer.append(inner); document.body.append(outer);
    const result = { scope, dark: getComputedStyle(outer).getPropertyValue('--background'), light: getComputedStyle(inner).getPropertyValue('--background'), prompt: getComputedStyle(inner).getPropertyValue('--prompt-color') };
    outer.remove(); return result;
  }));
  for (const result of results) { expect(result.light).not.toBe(result.dark); expect(result.prompt.trim()).toBe('#7CFC9A'); }
});

for (const [name, viewport] of Object.entries({ tiny: { width: 320, height: 700 }, android: { width: 412, height: 915 }, landscape: { width: 1024, height: 768 }, laptop: { width: 1366, height: 768 }, qhd: { width: 2560, height: 1440 }, uhd: { width: 3840, height: 2160 } })) {
  test(`${name}: gallery embeds and reading at extended dimensions`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/review?case=gallery&theme=light');
    await expect(page.getByRole('region', { name: 'Post media gallery' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    expect(await page.locator('script[src="https://www.instagram.com/embed.js"]').count()).toBe(0);
    await page.getByRole('button', { name: 'Next media' }).click();
    await expect(page.locator('.blog-gallery iframe').first()).toHaveAttribute('src', /^https:\/\/www.youtube.com\/embed\//);
    await page.screenshot({ path: `${screenshotDir}/screenshots/${name}-light-gallery.png`, fullPage: true });
    await page.goto('/review?case=mixed&theme=dark');
    await expect(page.locator('.blog-content h2').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.screenshot({ path: `${screenshotDir}/screenshots/${name}-dark-reading.png`, fullPage: true });
  });
}

test('list navigation, revision-aware publish/unpublish, filtering and failure recovery', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  let failure = false;
  let state = { id: 'list-post', slug: 'list-post', title: 'Fixture list entry', status: 'draft', updated_at: '2026-01-01T00:00:00.000Z', media: [] };
  await page.route('**/api/admin/posts?*', route => {
    if (failure) return route.fulfill({ status: 500, json: { error: 'Synthetic list error' } });
    const offset = new URL(route.request().url()).searchParams.get('offset');
    return route.fulfill({ json: { posts: offset === '25' ? [] : [state], hasMore: offset !== '25' } });
  });
  await page.route('**/api/admin/posts/list-post', route => {
    const body = route.request().postDataJSON();
    expect(body.expected_updated_at).toBe(state.updated_at);
    state = { ...state, status: body.status, updated_at: '2026-02-01T00:00:00.000Z' };
    return route.fulfill({ json: { post: state } });
  });
  await page.goto('/review?case=manage&theme=dark');
  await expect(page.getByText('Fixture list entry', { exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Make public' }).click();
  await expect(page.getByRole('button', { name: 'Move to draft' })).toBeVisible();
  await page.getByRole('button', { name: 'Move to draft' }).click();
  await expect(page.getByRole('button', { name: 'Make public' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search title, slug or excerpt on this page' }).fill('no match');
  await expect(page.getByText('No posts found.')).toBeVisible();
  await page.getByRole('textbox', { name: 'Search title, slug or excerpt on this page' }).fill('');
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByText('Page 2', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Previous page', exact: true }).click();
  failure = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Synthetic list error');
  failure = false;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByText('Fixture list entry', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.screenshot({ path: `${screenshotDir}/screenshots/mobile-dark-manage.png`, fullPage: true });
});

test('keyboard media ordering reports failure and captions retain drafts without reorder writes', async ({ page }) => {
  const media = [
    { id: 'first', type: 'image', url: '/fixture-image.svg', caption: 'First caption', idx: 0 },
    { id: 'second', type: 'image', url: '/fixture-image.svg', caption: 'Second caption', idx: 1 },
  ];
  let orders = 0;
  await page.route('**/api/admin/posts/synthetic/media', route => route.fulfill({ json: { media } }));
  await page.route('**/api/admin/posts/synthetic/media/reorder', route => {
    orders++;
    expect(route.request().postDataJSON().order).toEqual(['second', 'first']);
    return route.fulfill({ status: 409, json: { error: 'Reload the media list.' } });
  });
  await page.route('**/api/admin/media/first', route => route.fulfill({ status: 500, json: { error: 'Synthetic failure' } }));
  await page.goto('/review?case=admin&theme=light');
  await page.getByRole('button', { name: 'First caption', exact: true }).click();
  await page.getByRole('textbox', { name: 'Caption for media 1' }).fill('Retained draft');
  await page.getByRole('textbox', { name: 'Caption for media 1' }).press('Enter');
  await expect(page.getByRole('alert')).toContainText('Caption was not saved');
  await expect(page.getByRole('textbox', { name: 'Caption for media 1' })).toHaveValue('Retained draft');
  expect(orders).toBe(0);
  await page.getByRole('textbox', { name: 'Caption for media 1' }).press('Escape');
  const move = page.getByRole('button', { name: 'Move media 1 down', exact: true });
  await move.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Media order was not saved');
  expect(orders).toBe(1);
});

test('unsupported image upload fails locally and leaves post input intact', async ({ page }) => {
  let uploads = 0;
  await page.route('**/api/admin/posts/synthetic/media/upload', route => { uploads++; return route.abort(); });
  await page.goto('/review?case=admin&theme=dark');
  await page.getByLabel('Title', { exact: true }).fill('Retained title');
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('up to 10 MiB');
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Retained title');
  expect(uploads).toBe(0);
});

test('project carousel never embeds an arbitrary URL and constrains recognized video frames', async ({ page }) => {
  await page.goto('/review?case=project-gallery');
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next', exact: false }).click();
  await expect(page.locator('iframe')).toHaveAttribute('src', 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
  await expect(page.locator('iframe')).toHaveAttribute('referrerpolicy', 'no-referrer');
});

test('late media hydration preserves a newly attached upload', async ({ page }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/admin/posts/synthetic/media', async route => {
    await pending;
    await route.fulfill({ json: { media: [{ id: 'old', type: 'image', url: '/fixture-image.svg', caption: 'Old snapshot' }] } });
  });
  await page.route('**/api/admin/posts/synthetic/media/upload', route => route.fulfill({ status: 201, json: { media: { id: 'new', type: 'image', url: '/fixture-image.svg', caption: 'New upload' } } }));
  await page.goto('/review?case=admin&theme=light');
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.alloc(24) });
  await expect(page.getByRole('button', { name: 'New upload', exact: true })).toBeVisible();
  release();
  await expect(page.getByRole('button', { name: 'New upload', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Old snapshot', exact: true })).toHaveCount(0);
});

test('editing and blurring a legacy slug preserves its URL identifier', async ({ page }) => {
  await page.goto('/review?case=admin&theme=light');
  const slug = page.getByLabel('Slug', { exact: true });
  await slug.fill('Legacy%25_雪');
  await page.getByLabel('Title', { exact: true }).focus();
  await expect(slug).toHaveValue('Legacy%25_雪');
});
