import { readFile, stat } from "node:fs/promises";
import { test, expect } from "@playwright/test";

const routes = ["/admin", "/admin/posts", "/admin/posts/new", "/admin/posts/phase8-missing", "/admin/projects", "/admin/projects/new", "/admin/projects/phase8-missing", "/admin/users", "/admin/private-access", "/admin/terminal/commands", "/admin/terminal/commands/phase8-missing", "/admin/home", "/admin/bugs", "/admin/media", "/admin/appearance", "/admin/navigation", "/admin/settings"];
for (const width of [390, 768, 1440]) {
  test(`anonymous admin navigation is denied at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/sign-in/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect((await page.request.get("/api/admin/posts")).status()).toBe(401);
    expect((await page.request.get("/api/admin/cms/settings")).status()).toBe(401);
    expect((await page.request.put("/api/admin/cms/users", {headers:{origin:"http://localhost:3000"},data:{}})).status()).toBe(401);
    expect((await page.request.get("/api/admin/media/unknown/metadata")).status()).toBe(401);
    expect((await page.request.get("/api/admin/private-audience")).status()).toBe(401);
    expect((await page.request.patch("/api/admin/private-audience", { headers: { origin: "http://localhost:3000" }, data: { userId: "phase8-not-a-user", grant: true } })).status()).toBe(401);
    expect((await page.request.post("/api/admin/posts", { headers: { origin: "http://localhost:3000" }, data: { title: "Unauthorized", slug: "phase8-unauthorized" } })).status()).toBe(401);
    expect((await page.request.patch("/api/admin/posts/phase8-missing", { headers: { origin: "http://localhost:3000" }, data: { title: "Unauthorized", expected_revision: 1 } })).status()).toBe(401);
    expect((await page.request.delete("/api/admin/posts/phase8-missing", { headers: { origin: "http://localhost:3000" }, data: { expected_revision: 1 } })).status()).toBe(401);
  });
}

test("former synthetic owner cannot regain admin access", async ({ page }) => {
  const credentials = JSON.parse(await readFile(".artifacts/phase6/local-owner.json", "utf8"));
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/blog/);
  const profile = await (await page.request.get("/api/profile")).json();
  expect(profile.profile.is_owner).toBe(false);
  for (const route of routes) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/blog/);
  }
  expect((await page.request.get("/api/admin/posts")).status()).toBe(403);
  expect((await page.request.get("/api/admin/cms/settings")).status()).toBe(403);
  expect((await page.request.put("/api/admin/cms/users",{headers:{origin:"http://localhost:3000"},data:{}})).status()).toBe(403);
  expect((await page.request.get("/api/admin/private-audience")).status()).toBe(403);
  expect((await page.request.post("/api/admin/posts", { headers: { origin: "http://localhost:3000" }, data: { title: "Unauthorized", slug: "phase8-unauthorized" } })).status()).toBe(403);
});

test.describe("recovered owner", () => {
  test.use({ storageState: process.env.PHASE8_OWNER_STORAGE_STATE });
  for (const width of [390, 768, 1440]) {
    test(`owner shell and routes at ${width}px`, async ({ page }) => {
      const credentialPath = process.env.PHASE8_OWNER_CREDENTIALS;
      const storagePath = process.env.PHASE8_OWNER_STORAGE_STATE;
      test.skip(!credentialPath && !storagePath, "Approved owner credential artifact or local Playwright storage-state file required. No session harvesting or role changes.");
      const info = await stat(storagePath || credentialPath!);
      expect(info.isFile() && (info.mode & 0o077) === 0, "Owner fixture must be a private regular file").toBe(true);
      await page.setViewportSize({ width, height: 900 });
      if (!storagePath) {
        const credentials = JSON.parse(await readFile(credentialPath!, "utf8"));
        await page.goto("/sign-in?redirect_url=%2Fadmin");
        await page.getByLabel("Email", { exact: true }).fill(credentials.email);
        await page.getByLabel("Password", { exact: true }).fill(credentials.password);
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await expect(page).toHaveURL(/\/admin$/);
      } else await page.goto("/admin");
      expect((await (await page.request.get("/api/profile")).json()).profile.is_owner).toBe(true);
      const errors: string[] = [];
      page.on("pageerror", () => errors.push("pageerror"));
      page.on("console", message => {
        // HTTP 503s are expected on explicitly blocked legacy APIs, not runtime JS failures.
        if (message.type() === "error" && !/Failed to load resource: the server responded with a status of (401|403|503)/.test(message.text())) errors.push("consoleerror");
      });
      const postsResponse = await page.request.get("/api/admin/posts?limit=50");
      expect(postsResponse.status()).toBe(200);
      const postPayload = await postsResponse.json();
      const detailRoutes = postPayload.posts.map((post: { slug: string }) => `/admin/posts/${encodeURIComponent(post.slug)}`);
      for (const route of [...routes.filter(r => !r.includes("phase8-missing")), ...detailRoutes]) {
        const response = await page.goto(route);
        expect(response?.status(), route).toBe(200);
        await expect(page.getByRole("navigation", { name: "Breadcrumb", exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Administration could not load" })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
        if (width < 768) {
          const toggle = page.getByRole("button", { name: /Admin navigation/ });
          await toggle.click();
          await expect(toggle).toHaveAttribute("aria-expanded", "true");
          await page.getByRole("navigation", { name: "Mobile administration", exact: true }).getByRole("link", { name: "Posts", exact: true }).focus();
          await page.keyboard.press("Escape");
          await expect(toggle).toHaveAttribute("aria-expanded", "false");
          await expect(toggle).toBeFocused();
        }
      }
      await page.goto("/admin/appearance");
      const preview = page.getByRole("region", { name: "Theme preview" });
      const dark = await preview.evaluate(element => getComputedStyle(element).backgroundColor);
      await page.getByLabel("Preview theme", { exact: true }).selectOption("light");
      expect(await preview.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(dark);
      await page.goto("/admin/media");
      await page.getByRole("button", { name: "List view", exact: true }).click();
      await expect(page.getByRole("button", { name: "List view", exact: true })).toHaveAttribute("aria-pressed", "true");
      await page.getByLabel("Search media", { exact: true }).fill("phase8-no-such-media-result");
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page.getByText("No media matches this search and filter.")).toBeVisible();
      for (const [route, empty] of [["/admin/projects", "No projects found."], ["/admin/users", "No users match your current filters."], ["/admin/terminal/commands", "No commands found."]]) {
        await page.goto(route);
        await expect(page.getByRole("alert")).toBeVisible();
        await expect(page.getByText(empty, { exact: true })).toHaveCount(0);
      }
      expect(errors).toEqual([]);
    });
  }
});
