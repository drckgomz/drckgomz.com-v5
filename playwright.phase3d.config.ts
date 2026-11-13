import { defineConfig } from '@playwright/test';
import base from './playwright.config';
process.env.BLOG_REVIEW_OUTPUT = '.artifacts/phase3d/browser';
export default defineConfig(base, {
  outputDir: '.artifacts/phase3d/playwright-results',
  reporter: [['list'], ['html', { outputFolder: '.artifacts/phase3d/playwright-report', open: 'never' }]],
});
