/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const provider = fs.readFileSync(path.join(root, 'src/components/auth/RootAuthProvider.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/layout.tsx'), 'utf8');
const smokeRunner = fs.readFileSync(path.join(root, 'scripts/clerk-dev-smoke.cjs'), 'utf8');

test('Better Auth is the only root provider and offline mode mounts no auth SDK', () => {
  assert.match(provider, /^"use client";/);
  assert.match(provider, /BetterAuthSessionProvider/);
  assert.doesNotMatch(provider, /Clerk|Supabase/);
  assert.match(layout, /getBackendConfiguration\(\)/);
  assert.match(layout, /<RootAuthProvider offlineDesignMode=\{offlineDesignMode\}>/);
});

test('homepage smoke runner uses explicit offline mode without provider credentials', () => {
  assert.match(smokeRunner, /'pnpm-lock\.yaml', 'pnpm-workspace\.yaml'/);
  assert.match(smokeRunner, /spawn\(pnpm, \['run', 'dev'/);
  assert.match(smokeRunner, /OFFLINE_DESIGN_MODE: '1'/);
  assert.doesNotMatch(smokeRunner, /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY|CLERK_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_URL/);
  assert.doesNotMatch(smokeRunner, /copyFileSync\([^\n]*\.env/);
});
