import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

type Credentials = { email: string; password: string };

test("owner can review recovered private drafts and editor controls at mobile, tablet, and desktop widths", async ({ page }) => {
  const credentials = JSON.parse(await readFile(".artifacts/phase6/local-owner.json", "utf8")) as Credentials;
  await page.goto("/sign-in?redirect_url=%2Fadmin%2Fposts");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin/posts");

  for (const viewport of [
    { name: "iPhone", width: 390, height: 844 },
    { name: "Android", width: 360, height: 800 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    await test.step(viewport.name, async () => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/admin/posts");
      await expect(page.getByRole("heading", { name: "Manage Posts" })).toBeVisible();
      const posts = page.locator("ul.divide-y > li");
      await expect(posts).toHaveCount(2);
      await expect(page.getByRole("button", { name: /New post/i })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${viewport.name} post list overflows horizontally`).toBe(true);

      await posts.first().getByRole("button", { name: "Edit" }).click();
      await expect(page.getByRole("heading", { name: "Edit Post" })).toBeVisible();
      await expect(page.getByLabel("Title")).toBeVisible();
      await expect(page.getByRole("button", { name: "Preview unsaved post" })).toBeVisible();
      await page.getByRole("button", { name: "Preview unsaved post" }).click();
      await expect(page.getByRole("region", { name: "Unsaved post preview" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${viewport.name} editor overflows horizontally`).toBe(true);
    });
  }
});
