/* eslint-disable @typescript-eslint/no-require-imports */
// A status-aware gallery: never relabel older screenshots as fresh verification.
const fs = require('node:fs/promises');
async function main() {
  const source = '.artifacts/blog-review/screenshots';
  const files = (await fs.readdir(source)).filter(name => /^[a-z0-9-]+\.png$/.test(name)).sort();
  const target = '.artifacts/phase3b-gallery';
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(`${target}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Phase 3B review status</title><style>body{font:16px system-ui;background:#151515;color:#fafafa;margin:2rem}aside{border:2px solid #ffc66d;padding:1rem}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}a{color:inherit}img{width:100%;height:360px;object-fit:contain;object-position:top;background:#222}figure{margin:0;padding:1rem;border:1px solid #888}</style><h1>Phase 3B review</h1><aside><strong>Browser verification blocked.</strong><p>No new Phase 3B screenshots were captured. Loopback server failed with EPERM and elevated access was not requested. These ${files.length} images are historical Phase 3 captures. They do not verify changed carousel/list/theme code.</p></aside><h2>Historical reference images</h2><main>${files.map(name => `<figure><a href="../blog-review/screenshots/${name}"><img loading="lazy" src="../blog-review/screenshots/${name}" alt="Historical ${name.replace('.png','').replaceAll('-',' ')}"><figcaption>Historical: ${name}</figcaption></a></figure>`).join('')}</main></html>`);
  console.log(`Status-aware gallery: ${target}/index.html; ${files.length} historical references, 0 new captures.`);
}
main().catch(() => { console.error('Historical gallery source unavailable; no screenshots generated.'); process.exitCode = 1; });
