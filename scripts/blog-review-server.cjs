/* eslint-disable @typescript-eslint/no-require-imports */
// Deliberately independent of Next and all environment/provider loaders.
const { build } = require('esbuild');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const out = path.resolve(root, process.env.BLOG_REVIEW_OUTPUT || '.artifacts/blog-review');
async function start() {
  await fs.mkdir(out, { recursive: true });
  await build({ entryPoints: [path.join(root, 'tests/browser/fixtures/blog.tsx')], outfile: path.join(out, 'review.js'), bundle: true, platform: 'browser', jsx: 'automatic', alias: { 'next/navigation': path.join(root, 'tests/browser/fixtures/navigation.ts') }, define: { 'process.env': '{}', 'process.env.NODE_ENV': '"development"' } });
  const css = await postcss([tailwind({ base: root })]).process(await fs.readFile(path.join(root, 'src/app/globals.css'), 'utf8'), { from: path.join(root, 'src/app/globals.css') });
  await fs.writeFile(path.join(out, 'review.css'), css.css + '\n' + await fs.readFile(require.resolve('react-responsive-carousel/lib/styles/carousel.min.css'), 'utf8') + '\n' + await fs.readFile(path.join(root, 'tests/browser/fixtures/review.css'), 'utf8'));
  if (process.argv.includes("--build-only")) { console.log("Synthetic component bundle/CSS compiled without starting a server."); return; }
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Synthetic blog review</title><link rel="stylesheet" href="/review.css"></head><body><div id="root"></div><script src="/review.js"></script></body></html>';
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (['/review.js', '/review.css'].includes(url.pathname)) {
      res.setHeader('Content-Type', url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css');
      res.end(await fs.readFile(path.join(out, url.pathname.slice(1)))); return;
    }
    if (url.pathname === '/fixture-image.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#305b68"/><circle cx="1100" cy="250" r="150" fill="#f0d09d"/><path d="M0 900L600 250L1200 900Z" fill="#173c3d"/></svg>'); return; }
    if (url.pathname.startsWith('/api/')) { res.writeHead(501, { 'Content-Type': 'application/json' }); res.end('{"error":"Fixture requests must be mocked by the test."}'); return; }
    res.setHeader('Content-Type', 'text/html'); res.end(html);
  });
  server.listen(4173, '127.0.0.1', () => console.log('Synthetic review: http://127.0.0.1:4173/review'));
}
start().catch(() => { console.error('Fixture build/start failed; no environment values were loaded.'); process.exitCode = 1; });
