import { test, expect } from "@playwright/test";

test("a disposable verified member updates only their own profile and sees the saved name", async ({ page }) => {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `profile-${unique}@example.test`;
  const password = "LocalProfile!2026";
  const displayName = `Profile Member ${unique}`;

  await page.goto("/sign-up");
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("check the local email inbox");

  await page.goto("/dev/mailbox");
  const mailboxEntry = page.locator("li").filter({ hasText: email });
  await expect(mailboxEntry).toBeVisible();
  await mailboxEntry.getByRole("button", { name: "Verify email" }).click();
  await expect(page.getByRole("status")).toContainText("Email verified");

  await page.goto("/sign-in?redirect_url=%2Faccount");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/account");

  const profileSnapshot = await page.evaluate(async () => {
    const response = await fetch("/api/profile", { cache: "no-store" });
    const payload = await response.json() as { profile?: { is_owner?: boolean; is_whitelist_admin?: boolean; can_view_private?: boolean } };
    return { status: response.status, profile: payload.profile };
  });
  expect(profileSnapshot.status).toBe(200);
  expect(profileSnapshot.profile?.is_owner).toBe(false);
  expect(profileSnapshot.profile?.is_whitelist_admin).toBe(false);
  expect(profileSnapshot.profile?.can_view_private).toBe(false);
  expect(await page.evaluate(async () => (await fetch("/api/admin/posts", { cache: "no-store" })).status)).toBe(403);

  await page.getByLabel("First name").fill("Taylor");
  await page.getByLabel("Last name").fill("Reader");
  await page.getByLabel("Display name").fill(displayName);
  await page.getByRole("button", { name: "Emerald" }).click();
  const saveResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/profile" && response.request().method() === "PUT");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const response = await saveResponse;
  expect(response.status()).toBe(200);
  await expect(page.getByRole("status")).toContainText("Profile saved.");
  await expect(page.getByTestId("profile-avatar-preview")).toHaveCSS("background-color", "rgb(46, 204, 113)");
  await page.reload();
  await expect(page.getByLabel("First name")).toHaveValue("Taylor");
  await expect(page.getByLabel("Last name")).toHaveValue("Reader");
  await expect(page.getByLabel("Display name")).toHaveValue(displayName);
  await expect(page.getByLabel("Custom color (hex)")).toHaveValue("#2ECC71");
  await expect(page.getByTestId("account-avatar")).toHaveCSS("background-color", "rgb(46, 204, 113)");

  await page.goto("/blog");
  await expect(page.getByRole("heading", { name: `Welcome to the Blog, ${displayName}!` })).toBeVisible();

  const crossAccountAttempt = await page.evaluate(async () => {
    const result = await fetch("/api/profile", {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_name: "Changed", first_name: "X", last_name: "Y", avatar_color: "#112233", user_id: "another-account", role: "owner", is_owner: true }),
    });
    return result.status;
  });
  expect(crossAccountAttempt).toBe(400);

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await page.waitForURL("**/terminal");
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/account");
  await expect(page.getByLabel("First name")).toHaveValue("Taylor");
  await expect(page.getByLabel("Last name")).toHaveValue("Reader");
  await expect(page.getByLabel("Display name")).toHaveValue(displayName);
  await expect(page.getByLabel("Custom color (hex)")).toHaveValue("#2ECC71");
  await expect(page.getByTestId("account-avatar")).toHaveCSS("background-color", "rgb(46, 204, 113)");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await page.waitForURL("**/terminal");
});
