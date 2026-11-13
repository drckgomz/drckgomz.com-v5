/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const code = buildSync({ entryPoints: ['src/lib/db/config.ts'], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text;
const moduleResult = { exports: {} };
vm.runInNewContext(code, { module: moduleResult, exports: moduleResult.exports, URL });
const { parseAuthConfiguration } = moduleResult.exports;
const local = {
  NODE_ENV: 'development', LOCAL_PG_INTEGRATION: '1', LOCAL_PG_TARGET: 'phase6-local',
  LOCAL_PG_AUTH_DATABASE_URL: 'postgresql://drckgomz_local_auth@127.0.0.1:55441/drckgomz_phase5_test?sslmode=disable',
  BETTER_AUTH_URL: 'http://localhost:3000', BETTER_AUTH_SECRET: 'x'.repeat(48),
  BETTER_AUTH_GOOGLE_CLIENT_ID: '', BETTER_AUTH_GOOGLE_CLIENT_SECRET: '',
  BETTER_AUTH_APPLE_CLIENT_ID: '', BETTER_AUTH_APPLE_CLIENT_SECRET: '',
};
test('isolated launcher cleared OAuth variables allow local authentication', () => {
  assert.equal(parseAuthConfiguration(local).localDevelopment, true);
});
test('local authentication still rejects provider credentials, wrong target, production, and weak secrets', () => {
  for (const change of [
    { BETTER_AUTH_GOOGLE_CLIENT_ID: 'unexpected' },
    { BETTER_AUTH_APPLE_CLIENT_SECRET: 'unexpected' },
    { LOCAL_PG_AUTH_DATABASE_URL: local.LOCAL_PG_AUTH_DATABASE_URL.replace('55441', '5432') },
    { NODE_ENV: 'production' }, { BETTER_AUTH_SECRET: 'short' },
  ]) assert.throws(() => parseAuthConfiguration({ ...local, ...change }));
});
