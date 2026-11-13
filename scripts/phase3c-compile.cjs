/* eslint-disable @typescript-eslint/no-require-imports */
// Compile in a repository-local staging directory that contains no .env files.
// App routes are not prerendered, and provider credentials are never inherited.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const stage = path.join(root, '.artifacts', process.argv.includes('--phase3d') ? 'phase3d' : 'phase3c', 'compile');
fs.mkdirSync(stage, { recursive: true });
for (const name of ['src', 'node_modules', 'public']) {
  const target = path.join(stage, name);
  if (!fs.existsSync(target)) fs.symlinkSync(path.join(root, name), target, 'dir');
}
for (const name of ['package.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.ts', 'postcss.config.mjs']) {
  fs.copyFileSync(path.join(root, name), path.join(stage, name));
}
const result = spawnSync(process.execPath, [require.resolve('next/dist/bin/next'), 'build', '--webpack', '--experimental-build-mode', 'compile'], {
  cwd: stage, stdio: 'inherit',
  env: { PATH: process.env.PATH, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', CI: '1' },
});
process.exitCode = result.status ?? 1;
