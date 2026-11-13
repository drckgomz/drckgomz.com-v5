/* eslint-disable @typescript-eslint/no-require-imports */
const { build } = require('esbuild');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
async function main() {
  const root = process.cwd();
  const out = path.join(root, '.artifacts/phase8/overnight/editor-fixture');
  await fs.mkdir(out, { recursive: true });
  await build({ entryPoints: [path.join(root, 'tests/phase8/fixtures/editor.tsx')], outfile: path.join(out, 'fixture.js'), bundle: true, platform: 'browser', jsx: 'automatic', alias: { 'next/navigation': path.join(root, 'tests/browser/fixtures/navigation.ts') }, define: { 'process.env': '{}', 'process.env.NODE_ENV': '"development"' } });
  const css = await postcss([tailwind({ base: root })]).process(await fs.readFile('src/app/globals.css', 'utf8'), { from: path.join(root, 'src/app/globals.css') });
  await fs.writeFile(path.join(out, 'fixture.css'), css.css);
  http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (pathname === '/fixture.js' || pathname === '/fixture.css') {
      res.setHeader('Content-Type', pathname.endsWith('.js') ? 'text/javascript' : 'text/css');
      res.end(await fs.readFile(path.join(out, pathname.slice(1)))); return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"><title>Synthetic editor contract</title></head><body data-theme="dark"><div id="root"></div><script src="/fixture.js"></script></body></html>');
  }).listen(4178, '127.0.0.1', () => console.log('Synthetic editor contract fixture: http://127.0.0.1:4178'));
}
main().catch(() => { console.error('Editor fixture could not start.'); process.exitCode = 1; });
