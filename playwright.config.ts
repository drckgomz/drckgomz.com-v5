import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', testMatch: '*.spec.ts', fullyParallel: false, workers: 2,
  outputDir: '.artifacts/playwright-results',
  reporter: [['list'], ['html', { outputFolder: '.artifacts/playwright-report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', serviceWorkers: 'block', trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/blog-review-server.cjs', url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 120000 },
});
