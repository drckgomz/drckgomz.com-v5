/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sourceRoot = path.resolve(__dirname, '../..');
const tempRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'drckgomz-phase5-'));
function copyValidationInputs(target) {
  fs.cpSync(path.join(sourceRoot, 'drizzle'), path.join(target, 'drizzle'), { recursive: true });
  fs.mkdirSync(path.join(target, 'scripts/phase3f'), { recursive: true });
  fs.mkdirSync(path.join(target, 'scripts/phase5'), { recursive: true });
  for (const rel of [
    'scripts/phase3f/development-migration-manifest.json',
    'scripts/phase5/migration-manifest.json',
  ]) fs.copyFileSync(path.join(sourceRoot, rel), path.join(target, rel));
}

test('offline migration validator accepts the six reviewed migrations without a DB connection', async () => {
  const { validateMigrationArtifacts } = await import('../../scripts/phase5/validate-migrations.mjs');
  assert.deepEqual(validateMigrationArtifacts(sourceRoot), {
    target: {
      project: 'jolly-poetry-87664309', branch: 'br-nameless-dust-bewpmr4r',
      endpoint: 'ep-sparkling-sun-bedq0ozn', hostname: 'ep-sparkling-sun-bedq0ozn.c-9.us-east-2.aws.neon.tech',
      database: 'neondb', postgresMajor: '18',
    },
    migrationCount: 6,
    migrationHashes: [
      '201022ebf1346f754df936a2139075c63abde28eea6be065d24214f6a8e331bc',
      '0ae7871fc214b53788fbfb0ef6081eb2cd89fc20ff5e2d7ef93f7a6f1dc15bbc',
      '582506469c83811bd9c00f313a9d23f64441234953b53efdf248549fb128f0be',
      '42d90a2e9812f63638359a109a064878bfa1c06444c08c5acbca19698cb9f47f',
      'ef5ed1cd7b1acea20a0a25efb664cf1b1119ce141259b0ede082aa15f24c0377',
      '966d65b038eddfd1f12ceb47e17140e2c4252b848174429e218387070b6dbe14',
    ],
    nextMigration: '0005_session_digest_adapter_default',
  });
});

test('offline migration validator rejects journal drift, unexpected files, and modified migration bytes', async () => {
  const { validateMigrationArtifacts } = await import('../../scripts/phase5/validate-migrations.mjs');
  for (const mutate of [
    (root) => fs.appendFileSync(path.join(root, 'drizzle/meta/_journal.json'), ' '),
    (root) => fs.writeFileSync(path.join(root, 'drizzle/0005_unreviewed.sql'), 'SELECT 1;'),
    (root) => fs.appendFileSync(path.join(root, 'drizzle/0004_sour_catseye.sql'), '\n-- changed'),
    (root) => fs.appendFileSync(path.join(root, 'drizzle/0005_session_digest_adapter_default.sql'), '\n-- changed'),
  ]) {
    const root = tempRoot();
    try {
      copyValidationInputs(root);
      mutate(root);
      assert.throws(() => validateMigrationArtifacts(root));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});
