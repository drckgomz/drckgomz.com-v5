import { test, expect } from "@playwright/test";

test("home and public blog remain stable for 30 seconds without document reload loops", async ({ page }) => {
  const documents: string[] = [];
  const blogRequests: string[] = [];
  const sessionStatuses: number[] = [];
  page.on("request", request => {
    if (request.isNavigationRequest() && request.resourceType() === "document") documents.push(new URL(request.url()).pathname);
    if (request.url().includes("/api/public/blogs")) blogRequests.push(request.url());
  });
  page.on("response", response => {
    if (response.url().includes("/api/auth/get-session")) sessionStatuses.push(response.status());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.goto("/"))?.status()).toBe(200);
  await page.waitForTimeout(30_000);
  expect(documents).toEqual(["/"]);
  expect(sessionStatuses.every(status => status === 200)).toBe(true);

  documents.length = 0;
  const response = await page.goto("/blog");
  expect(response?.status()).toBe(200);
  await expect.poll(() => blogRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);
  expect(new URL(blogRequests.at(-1)!).searchParams.get("status")).toBe("public");
  const componentRequestCount = blogRequests.length;
  expect(componentRequestCount).toBe(1);
  const listingResponse = await page.evaluate(async () => {
    const result = await fetch("/api/public/blogs?status=public", { cache: "no-store" });
    return { status: result.status, data: await result.json() };
  });
  expect(listingResponse.status).toBe(200);
  expect(Array.isArray(listingResponse.data.items)).toBe(true);
  expect(listingResponse.data.items.every((post: { status: string }) => post.status === "public")).toBe(true);
  if (listingResponse.data.items.length === 0) {
    await expect(page.getByRole("status")).toContainText("Only published public posts appear here");
  }
  expect(await page.evaluate(async () => (await fetch("/api/public/blogs?status=all")).status)).toBe(400);
  const boundedRequestCount = blogRequests.length;
  await page.waitForTimeout(30_000);
  expect(documents).toEqual(["/blog"]);
  expect(blogRequests.length).toBe(boundedRequestCount);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("heading", { name: /Welcome to the Blog/ })).toBeVisible();
  await page.waitForTimeout(2_000);
  expect(documents.slice(-1)).toEqual(["/blog"]);
});

test("503 session and 500 blog responses show a stable error with only an explicit retry", async ({ page }) => {
  let sessionCalls = 0;
  let blogCalls = 0;
  const documents: string[] = [];
  page.on("request", request => {
    if (request.isNavigationRequest() && request.resourceType() === "document") documents.push(new URL(request.url()).pathname);
  });
  await page.route("**/api/auth/get-session", route => {
    sessionCalls++;
    return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporary" }) });
  });
  await page.route("**/api/public/blogs?status=public", route => {
    blogCalls++;
    return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Public posts are temporarily unavailable." }) });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  expect((await page.goto("/blog"))?.status()).toBe(200);
  const blogError = page.locator("div[role='alert']").filter({ hasText: "Public posts are temporarily unavailable." }).first();
  await expect(blogError).toBeVisible();
  const initialBlogCalls = blogCalls;
  expect(initialBlogCalls).toBe(1);
  await page.waitForTimeout(5_000);
  expect(documents).toEqual(["/blog"]);
  expect(blogCalls).toBe(initialBlogCalls);
  expect(sessionCalls).toBeLessThanOrEqual(2);

  await page.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => blogCalls).toBe(initialBlogCalls + 1);
  await expect(blogError).toBeVisible();
  await page.waitForTimeout(2_000);
  expect(blogCalls).toBe(initialBlogCalls + 1);
  expect(documents).toEqual(["/blog"]);
});
