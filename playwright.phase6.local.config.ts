import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/phase6",
  testMatch: "*.browser.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  outputDir: ".artifacts/phase6/playwright-results",
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    browserName: "chromium",
    serviceWorkers: "block",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "node scripts/phase6/dev-local.mjs",
    url: "http://localhost:3000/sign-in",
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
