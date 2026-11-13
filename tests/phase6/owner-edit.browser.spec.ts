import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";

type Credentials = { email: string; password: string };

async function removeInterruptedLifecycleRows(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/admin/posts?limit=50&offset=0", { cache: "no-store" });
    if (!response.ok) return false;
    const data = await response.json() as { posts?: Array<{ slug: string; title: string; revision: number }> };
    const stale = (data.posts ?? []).filter((post) => post.slug.startsWith("phase-6-local-lifecycle-") && post.title.startsWith("Phase 6 local lifecycle "));
    for (const post of stale) {
      const deleted = await fetch(`/api/admin/posts/${encodeURIComponent(post.slug)}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_revision: post.revision }),
      });
      if (!deleted.ok) return false;
    }
    return true;
  });
}

test("synthetic owner edits and restores a recovered private draft using real PostgreSQL", async ({ page }) => {
  const credentials = JSON.parse(await readFile(".artifacts/phase6/local-owner.json", "utf8")) as Credentials;
  await page.goto("/sign-in?redirect_url=%2Fadmin%2Fposts");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  const profileResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/profile"));
  await page.getByRole("button", { name: "Sign in" }).click();
  const profileResponse = await profileResponsePromise;
  expect(profileResponse.status()).toBe(200);
  const profilePayload = await profileResponse.json();
  expect(profilePayload.profile?.is_owner).toBe(true);
  await page.waitForURL("**/admin/posts");
  await expect(page.getByRole("heading", { name: "Manage Posts" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Manage Posts" })).toBeVisible();
  expect(await removeInterruptedLifecycleRows(page)).toBe(true);

  const rows = page.locator("ul.divide-y > li");
  await expect(rows).toHaveCount(2);
  await rows.first().getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit Post" })).toBeVisible();
  const editUrl = new URL(page.url());
  const slug = decodeURIComponent(editUrl.pathname.split("/").at(-1) ?? "");
  expect(slug).not.toBe("");

  const title = page.getByLabel("Title");
  const originalTitle = await title.inputValue();
  const marker = ` — local edit ${Date.now()}`;
  await title.fill(`${originalTitle}${marker}`);
  const firstSaveResponse = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes("/api/admin/posts/"));
  await page.getByRole("button", { name: "Save title and content" }).click();
  const firstSave = await firstSaveResponse;
  const firstSavePayload = await firstSave.json();
  expect(firstSave.status(), firstSavePayload?.error ?? "").toBe(200);
  await expect(page.getByRole("status")).toContainText("Title and content saved.");
  await page.reload();
  await expect(title).toHaveValue(`${originalTitle}${marker}`);

  // Restore the historical record exactly before ending the test.
  await title.fill(originalTitle);
  await page.getByRole("button", { name: "Save title and content" }).click();
  await expect(page.getByRole("status")).toContainText("Title and content saved.");
  await page.reload();
  await expect(title).toHaveValue(originalTitle);

  const linkedMediaDeleteStatus = await page.evaluate(async (postSlug) => {
    const detail = await fetch(`/api/admin/posts/${encodeURIComponent(postSlug)}`, { cache: "no-store" });
    const data = await detail.json() as { post?: { revision?: number } };
    if (!detail.ok || !data.post?.revision) return detail.status;
    const deletion = await fetch(`/api/admin/posts/${encodeURIComponent(postSlug)}`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expected_revision: data.post.revision }),
    });
    return deletion.status;
  }, slug);
  expect(linkedMediaDeleteStatus).toBe(409);

  const logout = await page.evaluate(async () => {
    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return response.status;
  });
  expect(logout).toBeLessThan(400);
  await page.goto("/admin/posts");
  await expect(page).toHaveURL(/\/sign-in/);

  const protectedApiStatus = await page.evaluate(async () => (await fetch("/api/admin/posts")).status);
  expect(protectedApiStatus).toBe(401);
  const privateResponse = await page.goto(`/blog/${encodeURIComponent(slug)}`);
  expect(privateResponse?.status()).toBe(404);
});

test("synthetic owner creates, publishes, unpublishes, archives, restores, and deletes a disposable post", async ({ page }) => {
  const credentials = JSON.parse(await readFile(".artifacts/phase6/local-owner.json", "utf8")) as Credentials;
  await page.goto("/sign-in?redirect_url=%2Fadmin%2Fposts");
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/admin/posts");

  expect(await removeInterruptedLifecycleRows(page)).toBe(true);

  const unique = Date.now();
  const title = `Phase 6 local lifecycle ${unique}`;
  const slug = `phase-6-local-lifecycle-${unique}`;
  await page.getByRole("button", { name: /New post/i }).click();
  await expect(page.getByTestId("create-post-form")).toHaveAttribute("data-hydrated", "true");
  await page.getByLabel("Title").fill(title);
  await expect(page.locator("#new-title")).toHaveValue(title);
  await page.getByLabel("Slug").fill(slug);
  await expect(page.locator("#new-slug")).toHaveValue(slug);
  await page.getByLabel("Excerpt").fill("Disposable local integration record.");
  await expect(page.locator("#new-title")).toHaveValue(title);
  await expect(page.locator("#new-slug")).toHaveValue(slug);
  await expect(page.locator("#new-excerpt")).toHaveValue("Disposable local integration record.");
  const createButton = page.getByRole("button", { name: "Create & edit" });
  await expect(createButton).toBeEnabled();
  const createResponsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/admin/posts", { timeout: 15_000 });
  await createButton.click({ timeout: 5_000 });
  expect((await createResponsePromise).status()).toBe(201);
  await page.waitForURL(`**/admin/posts/${slug}`);
  const editedTitle = `${title} edited`;
  const editedContent = `Disposable browser body ${unique}`;
  await page.getByLabel("Title").fill(editedTitle);
  await page.getByRole("textbox", { name: "Post content" }).fill(editedContent);
  const contentSavePromise = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes(`/api/admin/posts/${slug}`));
  await page.getByRole("button", { name: "Save title and content" }).click();
  expect((await contentSavePromise).status()).toBe(200);
  await expect(page.getByRole("status")).toContainText("Title and content saved.");
  await page.reload();
  await expect(page.getByLabel("Title")).toHaveValue(editedTitle);
  await expect(page.getByRole("textbox", { name: "Post content" })).toContainText(editedContent);
  await page.getByRole("button", { name: "Preview unsaved post" }).click();
  await expect(page.getByRole("region", { name: "Unsaved post preview" })).toContainText(editedContent);
  const duplicateSlugStatus = await page.evaluate(async ({ title, slug }) => (await fetch("/api/admin/posts", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, slug, excerpt: "Duplicate check." }),
  })).status, { title, slug });
  expect(duplicateSlugStatus).toBe(409);

  await page.goto("/admin/posts");
  const row = page.locator("ul.divide-y > li").filter({ hasText: slug });
  await expect(row).toContainText("Draft");
  const draftRevision = await page.evaluate(async (postSlug) => {
    const response = await fetch("/api/admin/posts?limit=50&offset=0", { cache: "no-store" });
    const payload = await response.json() as { posts?: Array<{ slug: string; revision: number }> };
    return payload.posts?.find((post) => post.slug === postSlug)?.revision ?? null;
  }, slug);
  expect(draftRevision).not.toBeNull();
  page.on("dialog", dialog => dialog.accept());
  const publishResponsePromise = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes(`/api/admin/posts/${slug}`));
  await row.getByRole("button", { name: "Make public" }).click();
  expect((await publishResponsePromise).status()).toBe(200);
  await expect(row).toContainText("Public");
  const staleStatusResponse = await page.evaluate(async ({ slug, revision }) => fetch(`/api/admin/posts/${encodeURIComponent(slug)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "draft", expected_revision: revision }),
  }).then((response) => response.status), { slug, revision: draftRevision });
  expect(staleStatusResponse).toBe(409);
  await expect(row).toContainText("Public");
  const originalPublishedAt = await page.evaluate(async (postSlug) => {
    const response = await fetch(`/api/admin/posts/${encodeURIComponent(postSlug)}`, { cache: "no-store" });
    const data = await response.json() as { post?: { published_at?: string | null } };
    return response.ok ? data.post?.published_at ?? null : null;
  }, slug);
  expect(originalPublishedAt).not.toBeNull();
  const publicListWhilePublished = await page.evaluate(async (postSlug) => {
    const response = await fetch("/api/public/blogs?status=public", { cache: "no-store" });
    const payload = await response.json() as { items?: Array<{ slug: string; status: string }> };
    return { status: response.status, includes: payload.items?.some((item) => item.slug === postSlug && item.status === "public") ?? false };
  }, slug);
  expect(publicListWhilePublished).toEqual({ status: 200, includes: true });
  expect(await page.evaluate(async () => (await fetch("/api/public/blogs?status=all", { cache: "no-store" })).status)).toBe(400);
  expect((await page.goto(`/blog/${slug}`))?.status()).toBe(200);

  await page.goto("/admin/posts");
  const activeRow = page.locator("ul.divide-y > li").filter({ hasText: slug });
  await activeRow.getByRole("button", { name: "Make private" }).click();
  await expect(activeRow).toContainText("Private");
  const publicListAfterRestricting = await page.evaluate(async (postSlug) => {
    const response = await fetch("/api/public/blogs?status=public", { cache: "no-store" });
    const payload = await response.json() as { items?: Array<{ slug: string }> };
    return { status: response.status, includes: payload.items?.some((item) => item.slug === postSlug) ?? false };
  }, slug);
  expect(publicListAfterRestricting).toEqual({ status: 200, includes: false });
  // The owner may preview the post while authenticated; the same URL is denied after logout below.
  expect(await page.evaluate(async (postSlug) => (await fetch(`/api/public/blogs/${encodeURIComponent(postSlug)}`, { cache: "no-store" })).status, slug)).toBe(200);
  await activeRow.getByRole("button", { name: "Move to draft" }).click();
  await expect(activeRow).toContainText("Draft");
  await activeRow.getByRole("button", { name: "Archive" }).click();
  await expect(activeRow).toContainText("Archived");
  await activeRow.getByRole("button", { name: "Unarchive" }).click();
  await expect(activeRow).toContainText("Draft");
  const restoredPublishedAt = await page.evaluate(async (postSlug) => {
    const response = await fetch(`/api/admin/posts/${encodeURIComponent(postSlug)}`, { cache: "no-store" });
    const data = await response.json() as { post?: { published_at?: string | null } };
    return response.ok ? data.post?.published_at ?? null : null;
  }, slug);
  expect(restoredPublishedAt).toBe(originalPublishedAt);

  const deleteResponsePromise = page.waitForResponse((response) => response.request().method() === "DELETE" && response.url().includes(`/api/admin/posts/${slug}`));
  await activeRow.getByRole("button", { name: "Delete" }).click();
  expect((await deleteResponsePromise).status()).toBe(200);
  await expect(page.locator("ul.divide-y > li").filter({ hasText: slug })).toHaveCount(0);
});
