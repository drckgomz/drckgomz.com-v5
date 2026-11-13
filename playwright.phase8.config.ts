import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/phase8",
  testMatch: "access.browser.spec.ts",
  workers: 1,
  timeout: 60_000,
  outputDir: ".artifacts/phase8/playwright-results",
  reporter: "list",
  use: { baseURL: "http://localhost:3000", browserName: "chromium", trace: "off", screenshot: "off", video: "off" },
  webServer: {
    command: "node scripts/phase6/dev-local.mjs", url: "http://localhost:3000/sign-in",
    reuseExistingServer: true, timeout: 120_000,
  },
});
