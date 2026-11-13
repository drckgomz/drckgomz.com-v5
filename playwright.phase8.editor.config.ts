import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/phase8', testMatch: 'editor.browser.spec.ts', workers: 1, timeout: 60_000,
  outputDir: '.artifacts/phase8/overnight/editor-results', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4178', browserName: 'chromium', trace: 'off', video: 'off' },
  webServer: { command: 'node scripts/phase8/editor-review-server.cjs', url: 'http://127.0.0.1:4178', reuseExistingServer: false, timeout: 120_000 },
});
