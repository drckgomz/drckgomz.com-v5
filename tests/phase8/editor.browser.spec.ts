import { test, expect } from '@playwright/test';
for (const width of [390, 768, 1440]) {
  test(`rich editing and safe embeds at ${width}px (component fixture)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const external: string[] = [];
    await page.route('**/*', route => {
      if (!route.request().url().startsWith('http://127.0.0.1:4178')) { external.push('external-request'); return route.abort(); }
      return route.continue();
    });
    await page.goto('/');
    const editor = page.getByRole('textbox', { name: 'Post content', exact: true });
    await editor.click(); await page.keyboard.press('ControlOrMeta+a');
    await page.getByRole('button', { name: 'Heading 2', exact: true }).click();
    await expect(editor.locator('h2')).toHaveText('Alpha beta');
    await editor.click(); await page.keyboard.press('ControlOrMeta+a');
    await page.getByRole('button', { name: 'Bold', exact: true }).click();
    await expect(editor.locator('b,strong')).toHaveText('Alpha beta');
    await page.getByRole('button', { name: 'Embed video', exact: true }).click();
    await page.getByLabel('URL', { exact: true }).fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Insert', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('safe URL');
    await page.getByLabel('URL', { exact: true }).fill('https://youtu.be/dQw4w9WgXcQ');
    await page.getByRole('button', { name: 'Insert', exact: true }).click();
    await expect(editor.locator('iframe')).toHaveCount(0);
    await expect(editor.locator('[data-editor-video]')).toContainText('YouTube video embed');
    await expect(page.getByLabel('Serialized HTML')).toHaveValue(/https:\/\/www.youtube-nocookie.com\/embed\/dQw4w9WgXcQ/);
    expect(external).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.artifacts/phase8/overnight/editor-${width}.png`, fullPage: true });
  });
}
test('title-only saves use source rather than preview; dirty navigation can be cancelled', async ({ page }) => {
  await page.route('**/api/admin/posts/synthetic-overnight/media', route => route.fulfill({ json: { media: [] } }));
  let body: Record<string, unknown> = {};
  await page.route('**/api/admin/posts/synthetic-overnight', async route => {
    body = route.request().postDataJSON();
    await route.fulfill({ json: { post: { revision: 2, editor_content: '<p>Original raw source</p>' } } });
  });
  await page.goto('/?form=1');
  await expect(page.getByRole('textbox', { name: 'Post content' })).toContainText('Original raw source');
  await page.getByLabel('Title', { exact: true }).fill('Synthetic changed title');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('link', { name: 'Navigate away' }).click();
  await expect(page).toHaveURL(/form=1/);
  await page.getByRole('button', { name: 'Save post', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Post changes saved');
  expect(body).toEqual({ expected_revision: 1, title: 'Synthetic changed title' });
});
test('recovered content has no formatting toolbar and cannot become an accidental content edit', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: { media: [] } }));
  await page.goto('/?form=1&legacy=1');
  await expect(page.getByRole('textbox', { name: 'Post content' })).toHaveAttribute('contenteditable', 'false');
  await expect(page.getByRole('toolbar')).toHaveCount(0);
  await expect(page.getByText(/Recovered source content is protected/)).toBeVisible();
});

for (const width of [390,768,1440]) {
  test(`configuration forms validate and refresh at ${width}px (mock persistence)`,async({page})=>{
    await page.setViewportSize({width,height:1000});let item: Record<string,unknown>|null=null;
    await page.route('**/api/admin/cms/homepage*',async route=>{
      if(route.request().method()==='PUT'){const input=route.request().postDataJSON();expect(input.expected_revision).toBe(1);expect(input.publication).toBe('draft');item={id:'homepage',data:input.data,revision:2};return route.fulfill({json:{kind:'ok'}});}
      return route.fulfill({json:{kind:'ok',items:[item]}});
    });
    await page.goto('/?resource=homepage');await page.getByLabel('Homepage title',{exact:true}).fill('Synthetic saved homepage');await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Changes saved.');expect(((item as Record<string,unknown>|null)?.data as Record<string,unknown>)?.title).toBe('Synthetic saved homepage');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`.artifacts/phase8/overnight/configuration-${width}.png`,fullPage:true});
  });
}
test('project form create/refresh and protected owner controls (mock backend)',async({page})=>{
  let item:Record<string,unknown>|null=null;
  await page.route('**/api/admin/cms/projects*',async route=>{if(route.request().method()==='PUT'){const input=route.request().postDataJSON();expect(input.operation).toBe('create');item={...input.data,id:'projects',revision:1};return route.fulfill({json:{kind:'ok'}});}return route.fulfill({json:{kind:'ok',items:[item]}});});
  await page.goto('/?resource=projects');await page.getByLabel('Project title',{exact:true}).fill('Synthetic portfolio');await page.getByLabel('Slug',{exact:true}).fill('synthetic-portfolio');await page.getByRole('button',{name:'Create project',exact:true}).click();await expect(page.getByRole('status')).toHaveText('Changes saved.');await expect(page.getByRole('button',{name:'Save changes',exact:true})).toBeVisible();
  await page.goto('/?resource=users&protected=1');await expect(page.getByRole('checkbox',{name:'Content administrator',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Save changes',exact:true})).toBeDisabled();
});


test('post metadata editing saves only changed fields and retains dirty changes on conflict', async ({ page }) => {
  await page.route('**/api/admin/posts/synthetic-overnight/media', route => route.fulfill({ json: { media: [] } }));
  let conflict = true;
  let body: Record<string, unknown> = {};
  await page.route('**/api/admin/posts/synthetic-overnight', async route => {
    body = route.request().postDataJSON();
    if (conflict) return route.fulfill({ status: 409, json: { error: 'Reload before saving.' } });
    return route.fulfill({ json: { post: { revision: 2, excerpt: body.excerpt, date: body.date, editor_content: '<p>Original raw source</p>' } } });
  });
  await page.goto('/?form=1&metadata=1');
  await page.getByLabel('Excerpt', { exact: true }).fill('Synthetic summary');
  await page.getByLabel('Display date', { exact: true }).fill('2026-11-13');
  await page.getByRole('button', { name: 'Save post', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Reload before saving');
  await expect(page.getByRole('status')).toContainText('Unsaved changes');
  await expect(page.getByLabel('Excerpt', { exact: true })).toHaveValue('Synthetic summary');
  conflict = false;
  await page.getByRole('button', { name: 'Save post', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Post changes saved');
  expect(body).toEqual({ expected_revision: 1, excerpt: 'Synthetic summary', date: '2026-11-13' });
  await page.goto('/?form=1');
  await expect(page.getByLabel('Excerpt', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Display date', { exact: true })).toBeDisabled();
});

test('existing project gallery can be reordered and featured through the revision-aware form', async ({ page }) => {
  let item: Record<string, unknown> | null = null;
  await page.route('**/api/admin/cms/projects*', async route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      expect(body.operation).toBe('update'); expect(body.expected_revision).toBe(1);
      expect(body.data.media_ids).toEqual(['image-b', 'image-a']); expect(body.data.featured_media_id).toBe('image-a');
      item = { ...body.data, id: 'projects', revision: 2 };
      return route.fulfill({ json: { kind: 'ok' } });
    }
    return route.fulfill({ json: { kind: 'ok', items: [item] } });
  });
  await page.goto('/?resource=projects&gallery=1');
  await page.getByRole('button', { name: 'Move image 2 up', exact: true }).click();
  await page.getByLabel('Featured project image', { exact: true }).selectOption('image-a');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Changes saved.');
  await expect(page.getByLabel('Featured project image', { exact: true })).toHaveValue('image-a');
});
