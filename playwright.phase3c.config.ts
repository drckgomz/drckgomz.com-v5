import { defineConfig } from '@playwright/test';
import base from './playwright.config';

process.env.BLOG_REVIEW_OUTPUT = '.artifacts/phase3c/browser';
export default defineConfig(base, {
  outputDir: '.artifacts/phase3c/playwright-results',
  reporter: [['list'], ['html', { outputFolder: '.artifacts/phase3c/playwright-report', open: 'never' }]],
});
