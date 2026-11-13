import { expect, test } from "@playwright/test";
import pg from "pg";

async function expirePendingResetForSyntheticUser(email: string) {
  const connection = new pg.Client({
    connectionString: "postgresql://phase5_local@127.0.0.1:55441/drckgomz_phase5_test?sslmode=disable",
    connectionTimeoutMillis: 2500,
    application_name: "phase6-auth-expiration-test",
  });
  try {
    await connection.connect();
    await connection.query("begin");
    await connection.query("set local statement_timeout = '5s'");
    const identity = await connection.query(`select current_database() as database, current_user as role,
      current_setting('server_version_num')::int / 10000 as major, inet_server_addr()::text as address`);
    const row = identity.rows[0];
    if (row?.database !== "drckgomz_phase5_test" || row?.role !== "phase5_local" || row?.major !== 18 || row?.address !== "127.0.0.1/32") {
      throw new Error("Refusing expiry test against a non-pinned local target.");
    }
    const updated = await connection.query(`update auth.verification verification_row
      set expires_at = now() - interval '1 second'
      where verification_row.identifier like 'reset-password:%'
        and verification_row.value = (select id from auth."user" where email = $1)
        and verification_row.expires_at > now()`, [email]);
    if (updated.rowCount !== 1) throw new Error("Expected exactly one pending synthetic reset token.");
    await connection.query("commit");
  } catch (error) {
    await connection.query("rollback").catch(() => {});
    throw error;
  } finally { await connection.end().catch(() => {}); }
}

test("member registration, verification, password reset, persistence, and owner boundary work against local PostgreSQL", async ({ page }) => {
  const email = `phase6-auth-${Date.now()}@example.test`;
  const initialPassword = "LocalMember!2026";
  const accountPassword = "AccountMember!2027";
  const nextPassword = "NewLocalMember!2027";

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sign-up");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel("Display name").fill("Local Browser Member");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(initialPassword);
  await page.getByLabel("Confirm password").fill(initialPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("check the local email inbox");

  await page.goto("/dev/mailbox");
  await expect(page.getByText(email).first()).toBeVisible();
  const publicInboxPayload = await page.request.get("/api/dev/mailbox").then((response) => response.json());
  expect(JSON.stringify(publicInboxPayload).includes("token")).toBe(false);
  await page.getByRole("button", { name: "Verify email" }).first().click();
  await expect(page.getByRole("status")).toContainText("Email verified");
  const verifiedSession = await page.request.get("/api/auth/get-session");
  expect(verifiedSession.status()).toBe(200);
  expect((await verifiedSession.json()).user?.email).toBe(email);

  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByText("Email verification: Verified")).toBeVisible();
  await page.getByLabel("Display name").fill("Updated Browser Member");
  const profileSavePromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/profile" && response.request().method() === "PUT");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const profileSave = await profileSavePromise;
  const profileSaveError = await profileSave.json().then((value) => typeof value?.error === "string" ? value.error : "no safe error detail");
  expect(profileSave.status(), `self-profile save response: ${profileSaveError}`).toBe(200);
  await expect(page.getByRole("status")).toContainText("Profile saved.");
  await page.getByLabel("Current password").fill(initialPassword);
  await page.getByLabel("New password", { exact: true }).fill(accountPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.locator("p[role=status]").filter({ hasText: "Password changed." }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
  await expect(page.getByLabel("Display name")).toHaveValue("Updated Browser Member");

  await page.evaluate(async () => fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
  await page.goto("/sign-in");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(accountPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/blog");
  expect((await page.request.get("/api/auth/get-session")).status()).toBe(200);
  expect((await page.request.get("/api/auth/get-session")).url()).toContain("get-session");

  const accountResponse = await page.request.get("/admin/posts", { maxRedirects: 0 });
  expect([301, 302, 303, 307, 308]).toContain(accountResponse.status());
  expect(["/sign-in?redirect_url=%2Fadmin", "/blog"]).toContain(accountResponse.headers().location);

  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account is eligible");
  await page.goto("/dev/mailbox");
  const resetCard = page.locator("li").filter({ hasText: "Password reset" }).filter({ hasText: email }).first();
  await resetCard.getByRole("button", { name: "Open reset form" }).click();
  await page.getByLabel("New password", { exact: true }).fill(nextPassword);
  await page.getByLabel("Confirm new password").fill(nextPassword);
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.locator("p[role=status]").filter({ hasText: /existing sessions were revoked/i }).first()).toBeVisible();

  await page.getByLabel("New password", { exact: true }).fill("YetAnotherValid!2028");
  await page.getByLabel("Confirm new password").fill("YetAnotherValid!2028");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("expired, or already used");
  const resetRevokedSession = await page.evaluate(async () => {
    const response = await fetch("/api/auth/get-session", { cache: "no-store" });
    return response.json();
  });
  expect(resetRevokedSession?.user ?? null).toBeNull();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(accountPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Sign-in failed");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(nextPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/blog");
  await page.reload();
  const persisted = await page.request.get("/api/auth/get-session");
  expect(persisted.status()).toBe(200);
  expect((await persisted.json()).user?.email).toBe(email);

  // Expire a second pending token only for this synthetic test account, after
  // re-verifying the same pinned disposable PG target in the helper above.
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account is eligible");
  await expirePendingResetForSyntheticUser(email);
  await page.goto("/dev/mailbox");
  const expiredCard = page.locator("li").filter({ hasText: "Password reset" }).filter({ hasText: email }).first();
  await expiredCard.getByRole("button", { name: "Open reset form" }).click();
  await page.getByLabel("New password", { exact: true }).fill("ExpiredAttempt!2028");
  await page.getByLabel("Confirm new password").fill("ExpiredAttempt!2028");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("expired, or already used");

  await page.evaluate(async () => fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
  const signedOut = await page.evaluate(async () => {
    const response = await fetch("/api/auth/get-session", { cache: "no-store" });
    return { status: response.status, payload: await response.json() };
  });
  expect(signedOut.status).toBe(200);
  expect(signedOut.payload?.user ?? null).toBeNull();
  await page.goto("/admin/posts");
  await expect(page).toHaveURL(/\/sign-in/);
});
