import test from "node:test";
import assert from "node:assert/strict";
import { audienceChangeDenial, ownerAuthorizationDenial } from "../../src/lib/auth/private-audience-policy";
import { createPrivateAudienceHandlers, type PrivateAudienceDependencies, type PrivateAudienceUser } from "../../src/lib/auth/private-audience-api";

type FixtureAccount = { id: string; enabled: boolean; bannedAt: Date | null; emailVerified: boolean; roles: string[]; grant: boolean };

function fixture(actorId: string | null, ownerOverrides: Partial<FixtureAccount> = {}) {
  const accounts: FixtureAccount[] = [
    { id: "owner", enabled: true, bannedAt: null, emailVerified: true, roles: ["owner"], grant: false },
    { id: "admin", enabled: true, bannedAt: null, emailVerified: true, roles: ["content_admin"], grant: false },
    { id: "member", enabled: true, bannedAt: null, emailVerified: true, roles: [], grant: false },
    { id: "blocked", enabled: false, bannedAt: null, emailVerified: true, roles: [], grant: false },
    { id: "banned", enabled: true, bannedAt: new Date(), emailVerified: true, roles: [], grant: false },
    { id: "unverified", enabled: true, bannedAt: null, emailVerified: false, roles: [], grant: false },
  ];
  Object.assign(accounts[0], ownerOverrides);
  const memberDto = (account: FixtureAccount): PrivateAudienceUser => ({
    id: account.id,
    email: `${account.id}@example.invalid`,
    username: account.id,
    name: null,
    provisioned: true,
    emailVerified: account.emailVerified,
    enabled: account.enabled,
    banned: account.bannedAt !== null,
    isOwner: account.roles.includes("owner"),
    hasAdminAccess: account.roles.some((role) => ["owner", "content_admin"].includes(role)),
    canViewPrivate: account.grant,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  const authorize = (id: string) => {
    const owner = accounts.find((account) => account.id === id);
    return owner ? ownerAuthorizationDenial({ enabled: owner.enabled, bannedAt: owner.bannedAt, hasOwnerRole: owner.roles.includes("owner") }) : "forbidden";
  };
  const deps: PrivateAudienceDependencies = {
    getUserId: async () => actorId,
    list: async (actor, limit, offset) => {
      if (authorize(actor)) return { kind: "forbidden" };
      const page = accounts.slice(offset, offset + limit);
      return { kind: "ok", users: page.map(memberDto), total: accounts.length };
    },
    setGrant: async (actorIdValue, targetId, grant) => {
      if (authorize(actorIdValue)) return { kind: "forbidden" };
      const target = accounts.find((account) => account.id === targetId);
      const denial = audienceChangeDenial(actorIdValue, targetId, {
        exists: !!target,
        enabled: target?.enabled,
        bannedAt: target?.bannedAt,
        emailVerified: target?.emailVerified,
      }, grant);
      if (denial === "self-change") return { kind: "self-change" };
      if (denial === "not-found") return { kind: "not-found" };
      if (denial === "blocked") return { kind: "blocked" };
      if (!target) return { kind: "not-found" };
      const changed = target.grant !== grant;
      target.grant = grant;
      return { kind: "ok", changed };
    },
  };
  return { accounts, handlers: createPrivateAudienceHandlers(deps) };
}

const patchRequest = (body: unknown, headers: Record<string, string> = { origin: "https://site.invalid" }) => new Request("https://site.invalid/api/admin/private-audience", {
  method: "PATCH",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(body),
});

test("private audience policy requires an active account with the owner role", () => {
  assert.equal(ownerAuthorizationDenial({ enabled: true, bannedAt: null, hasOwnerRole: true }), null);
  assert.equal(ownerAuthorizationDenial({ enabled: true, bannedAt: null, hasOwnerRole: false }), "forbidden");
  assert.equal(ownerAuthorizationDenial({ enabled: false, bannedAt: null, hasOwnerRole: true }), "forbidden");
  assert.equal(ownerAuthorizationDenial({ enabled: true, bannedAt: new Date(), hasOwnerRole: true }), "forbidden");
  assert.equal(audienceChangeDenial("owner", "member", { exists: true, enabled: true, bannedAt: null, emailVerified: false }, true), "blocked");
});

test("private access list and grant API deny anonymous and non-owner administrators", async () => {
  const anonymous = fixture(null);
  assert.equal((await anonymous.handlers.GET(new Request("https://site.invalid/api/admin/private-audience"))).status, 401);
  assert.equal((await anonymous.handlers.PATCH(patchRequest({ userId: "member", grant: true }))).status, 401);
  const admin = fixture("admin");
  assert.equal((await admin.handlers.GET(new Request("https://site.invalid/api/admin/private-audience"))).status, 403);
  assert.equal((await admin.handlers.PATCH(patchRequest({ userId: "member", grant: true }))).status, 403);
  assert.equal(admin.accounts.find((account) => account.id === "member")?.grant, false);
});

test("owner can list a bounded user projection and pagination metadata", async () => {
  const { handlers } = fixture("owner");
  const response = await handlers.GET(new Request("https://site.invalid/api/admin/private-audience?limit=2&offset=0"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, 6);
  assert.equal(body.users.length, 2);
  assert.equal(body.nextOffset, 2);
  assert.equal("password" in body.users[0], false);
  assert.equal("role" in body.users[0], false);
  assert.equal((await handlers.GET(new Request("https://site.invalid/api/admin/private-audience?limit=101"))).status, 400);
});

test("owner grant and revoke are idempotent and affect the next authorization read", async () => {
  const { accounts, handlers } = fixture("owner");
  let response = await handlers.PATCH(patchRequest({ userId: "member", grant: true }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, canViewPrivate: true, changed: true });
  assert.equal(accounts.find((account) => account.id === "member")?.grant, true);
  response = await handlers.PATCH(patchRequest({ userId: "member", grant: true }));
  assert.equal((await response.json()).changed, false);
  response = await handlers.PATCH(patchRequest({ userId: "member", grant: false }));
  assert.equal((await response.json()).changed, true);
  assert.equal(accounts.find((account) => account.id === "member")?.grant, false);
});

test("owner cannot self-grant, manage blocked targets into access, or change account roles", async () => {
  const { accounts, handlers } = fixture("owner");
  assert.equal((await handlers.PATCH(patchRequest({ userId: "owner", grant: true }))).status, 403);
  assert.equal((await handlers.PATCH(patchRequest({ userId: "blocked", grant: true }))).status, 409);
  assert.equal((await handlers.PATCH(patchRequest({ userId: "banned", grant: true }))).status, 409);
  assert.equal((await handlers.PATCH(patchRequest({ userId: "unverified", grant: true }))).status, 409);
  assert.equal((await handlers.PATCH(patchRequest({ userId: "member", grant: true, role: "owner" }))).status, 400);
  assert.deepEqual(accounts.filter((account) => account.roles.includes("owner")).map((account) => account.id), ["owner"]);
  assert.equal(accounts.find((account) => account.id === "member")?.grant, false);
});

test("blocked owners and cross-origin writes are rejected; blocked grants may be revoked", async () => {
  const { accounts, handlers } = fixture("owner");
  const crossSite = await handlers.PATCH(patchRequest({ userId: "member", grant: true }, { origin: "https://attacker.invalid" }));
  assert.equal(crossSite.status, 403);
  const forgedFetch = await handlers.PATCH(patchRequest({ userId: "member", grant: true }, { origin: "https://site.invalid", "sec-fetch-site": "cross-site" }));
  assert.equal(forgedFetch.status, 403);
  accounts.find((account) => account.id === "blocked")!.grant = true;
  assert.equal((await handlers.PATCH(patchRequest({ userId: "blocked", grant: false }))).status, 200);
  const { handlers: bannedOwner } = fixture("owner", { bannedAt: new Date() });
  assert.equal((await bannedOwner.GET(new Request("https://site.invalid/api/admin/private-audience"))).status, 403);
});
