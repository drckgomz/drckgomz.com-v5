/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs/promises');
async function main() {
  const dir = '.artifacts/blog-review';
  const files = (await fs.readdir(`${dir}/screenshots`)).filter(f => /^[a-z0-9-]+\.png$/.test(f)).sort();
  await fs.writeFile(`${dir}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Blog review gallery</title><style>body{font:16px system-ui;background:#151515;color:#f5f5f5;margin:2rem}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}a{color:inherit}img{width:100%;height:400px;object-fit:contain;object-position:top;background:#222}figure{margin:0;padding:1rem;border:1px solid #777}</style><h1>Synthetic blog review</h1><p>${files.length} screenshots. Fixture component tests, not production or real-device certification. See Playwright report for assertions.</p><main>${files.map(f => `<figure><a href="screenshots/${f}"><img loading="lazy" src="screenshots/${f}" alt="${f.replace('.png','').replaceAll('-',' ')}"><figcaption>${f}</figcaption></a></figure>`).join('')}</main></html>`);
  console.log(`Gallery: ${dir}/index.html (${files.length} screenshots)`);
}
main().catch(() => { console.error('Gallery generation failed'); process.exitCode = 1; });
