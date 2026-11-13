/*
 * Smoke-test the real homepage in explicit offline design mode. The isolated
 * stage does not copy environment files and receives no provider credentials.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, '.artifacts', 'clerk-dev-smoke');
fs.mkdirSync(artifacts, { recursive: true });
const stage = fs.mkdtempSync(path.join(artifacts, 'run-'));
const appPort = 4319;

for (const name of ['node_modules', 'public']) {
  fs.symlinkSync(path.join(root, name), path.join(stage, name), 'dir');
}
// Turbopack route discovery does not reliably traverse a symlinked src tree.
// Copying source into the isolated stage also prevents Next from seeing root env files.
fs.cpSync(path.join(root, 'src'), path.join(stage, 'src'), { recursive: true, dereference: true });
for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'next-env.d.ts', 'next.config.ts', 'postcss.config.mjs']) {
  fs.copyFileSync(path.join(root, name), path.join(stage, name));
}

if (process.argv.includes('--compile-only')) {
  const nextCli = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  const result = spawnSync(process.execPath, [nextCli, 'build', '--webpack', '--experimental-build-mode', 'compile'], {
    cwd: stage,
    env: {
      PATH: process.env.PATH || '',
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      CI: '1',
    },
    stdio: 'inherit',
  });
  console.log(`offline-compile-exit=${result.status ?? 1}`);
  process.exit(result.status ?? 1);
}

function requestPath(pathname) {
  return new Promise((resolve, reject) => {
    const request = http.get({ hostname: '127.0.0.1', port: appPort, path: pathname, timeout: 15_000 }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.on('timeout', () => {
      const error = new Error('timeout');
      error.code = 'ETIMEDOUT';
      request.destroy(error);
    });
    request.on('error', reject);
  });
}

async function main() {
  const env = {
    PATH: process.env.PATH || '',
    NODE_ENV: 'development',
    NEXT_TELEMETRY_DISABLED: '1',
    PORT: String(appPort),
    OFFLINE_DESIGN_MODE: '1',
  };

  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const child = spawn(pnpm, ['run', 'dev', '--hostname', '127.0.0.1', '--port', String(appPort)], {
    cwd: stage,
    env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  });

  let childExit;
  let lastProbeError;
  child.once('exit', (code, signal) => { childExit = { code, signal }; });
  const deadline = Date.now() + 90_000;
  let status;
  while (Date.now() < deadline && childExit === undefined) {
    try {
      status = await requestPath('/');
      if (status === 200) break;
      if (status >= 400) break;
    } catch (error) {
      lastProbeError = error?.code || error?.name || 'unknown';
      // The server has not bound its loopback port yet; retry only this local probe.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (status === 200) {
    console.log('offline-homepage-status=200');
    const publicBlogPaths = ['/blog', '/blog/offline-public-sample-one', '/blog/offline-public-sample-two'];
    const publicStatuses = [];
    for (const pathname of publicBlogPaths) publicStatuses.push([pathname, await requestPath(pathname)]);
    const protectedPaths = ['/blog/not-a-sample', '/blog/private', '/admin', '/blog/private-access', '/api/admin/posts', '/api/private/journal', '/api/public/blogs', '/api/auth/sign-in', '/sign-in', '/sign-up'];
    const protectedStatuses = [];
    for (const pathname of protectedPaths) protectedStatuses.push([pathname, await requestPath(pathname)]);
    const leaked = [...publicStatuses.filter(([, code]) => code !== 200), ...protectedStatuses.filter(([, code]) => code !== 404)];
    for (const [pathname, code] of [...publicStatuses, ...protectedStatuses]) console.log(`offline-route-${pathname.replaceAll('/', '-') || 'root'}=${code}`);
    if (!leaked.length) await reviewBlogViewports();
    terminate(child);
    if (leaked.length) process.exitCode = 1;
    return;
  }

  console.error(`offline-homepage-status=${status ?? 'unavailable'} probe-error=${lastProbeError ?? 'none'}`);
  terminate(child);
  process.exitCode = childExit?.code || 1;
}

async function reviewBlogViewports() {
  let chromium;
  try { ({ chromium } = require('@playwright/test')); }
  catch { console.log('offline-blog-browser=unavailable-package'); return; }

  let browser;
  try { browser = await chromium.launch(); }
  catch (error) {
    console.log(`offline-blog-browser=unavailable-${error?.name || 'launch-error'}`);
    return;
  }

  try {
    const runArtifacts = path.join(artifacts, `blog-viewports-${Date.now()}`);
    fs.mkdirSync(runArtifacts, { recursive: true });
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      const page = await browser.newPage({ viewport });
      const externalRequests = [];
      page.on('request', (request) => {
        const requestUrl = new URL(request.url());
        if (!['127.0.0.1', 'localhost'].includes(requestUrl.hostname)) externalRequests.push(request.url());
      });
      await page.goto(`http://127.0.0.1:${appPort}/blog`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Welcome to the Blog!' }).waitFor();
      await page.getByRole('heading', { name: 'LOCAL SAMPLE — Public post' }).waitFor();
      const cardCount = await page.locator('a[aria-label^="Open blog post:"]').count();
      const noHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      if (cardCount !== 2 || !noHorizontalOverflow) throw new Error(`viewport-validation-failed-${viewport.width}`);
      if (!(await page.getByText('Sign up or sign in to request access.').isVisible())) throw new Error(`locked-card-message-missing-${viewport.width}`);
      if (!(await page.getByRole('button', { name: 'Sign in' }).isDisabled())) throw new Error(`offline-sign-in-not-disabled-${viewport.width}`);
      await page.screenshot({ path: path.join(runArtifacts, `blog-${viewport.width}.png`), fullPage: true });

      // Logo and explicit Home controls both return to the homepage.
      await page.getByRole('link', { name: 'drckgomz home' }).click();
      await page.waitForURL('**/');
      const menuButton = page.getByRole('button', { name: 'Open navigation menu' });
      if (await menuButton.isVisible()) {
        await menuButton.click();
        const mobileMenu = page.getByRole('dialog', { name: 'Main navigation' });
        await mobileMenu.waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        await mobileMenu.waitFor({ state: 'hidden' });
        if (await page.getByRole('button', { name: 'Open navigation menu' }).evaluate((el) => document.activeElement !== el)) {
          throw new Error(`mobile-menu-focus-not-restored-${viewport.width}`);
        }
        await page.getByRole('button', { name: 'Open navigation menu' }).click();
        await page.getByRole('dialog', { name: 'Main navigation' }).getByRole('link', { name: 'Journal' }).click();
      } else {
        await page.getByRole('link', { name: 'Journal' }).click();
      }
      await page.waitForURL('**/blog');
      await page.getByRole('link', { name: 'Home', exact: true }).click();
      await page.waitForURL('**/');

      // Re-enter the blog and exercise the public card by keyboard.
      if (await page.getByRole('button', { name: 'Open navigation menu' }).isVisible()) {
        await page.getByRole('button', { name: 'Open navigation menu' }).click();
        await page.getByRole('dialog', { name: 'Main navigation' }).getByRole('link', { name: 'Journal' }).click();
      } else {
        await page.getByRole('link', { name: 'Journal' }).click();
      }
      await page.waitForURL('**/blog');
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.keyboard.press('Tab');
      const logoFocused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'drckgomz home');
      if (!logoFocused) throw new Error(`keyboard-navigation-did-not-focus-logo-${viewport.width}`);
      await page.keyboard.press('Tab');
      if (!(await page.getByRole('link', { name: 'Home', exact: true }).evaluate((el) => document.activeElement === el))) {
        throw new Error(`keyboard-navigation-did-not-focus-home-${viewport.width}`);
      }
      await page.keyboard.press('Tab');
      const firstPublicCard = page.locator('a[aria-label^="Open blog post:"]').first();
      if (!(await firstPublicCard.evaluate((el) => document.activeElement === el))) {
        throw new Error(`keyboard-navigation-did-not-focus-first-card-${viewport.width}`);
      }
      await page.keyboard.press('Enter');
      await page.getByRole('heading', { name: 'LOCAL SAMPLE — Public post' }).waitFor();
      await page.screenshot({ path: path.join(runArtifacts, `article-${viewport.width}.png`), fullPage: true });
      await page.getByRole('link', { name: /Back to blog/i }).click();
      await page.waitForURL('**/blog');

      // Report is available as a dialog, but its external submission is disabled offline.
      const reportButton = page.getByRole('button', { name: 'Report a Bug' });
      await reportButton.scrollIntoViewIfNeeded();
      await reportButton.click();
      const reportDialog = page.getByRole('dialog', { name: 'Report a Bug' });
      await reportDialog.waitFor({ state: 'visible' });
      await reportDialog.getByText(/unavailable in offline preview/i).waitFor();
      if (!(await reportDialog.getByRole('button', { name: 'Submit report' }).isDisabled())) {
        throw new Error(`offline-report-submit-not-disabled-${viewport.width}`);
      }
      if (viewport.width === 390) await page.keyboard.press('Escape');
      else await reportDialog.getByRole('button', { name: 'Close' }).first().click();
      await reportDialog.waitFor({ state: 'hidden' });
      await page.getByRole('heading', { name: 'LOCAL SAMPLE — Public post' }).waitFor();
      if (externalRequests.length) throw new Error(`offline-external-request-detected-${viewport.width}`);
      console.log(`offline-blog-viewport-${viewport.width}=passed`);
      await page.close();
    }
    console.log(`offline-blog-screenshots=${path.relative(root, runArtifacts)}`);
  } catch (error) {
    console.error(`offline-blog-browser-failed=${error?.message || error?.name || 'unknown'}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

function terminate(child) {
  if (!child.pid) return;
  try {
    if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
    else child.kill('SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error(`offline-smoke-setup-failed=${error?.code || error?.name || 'unknown'}`);
  process.exitCode = 1;
});
