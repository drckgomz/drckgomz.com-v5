import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("../../scripts/phase6/owner-role-transfer-review-only.sql", import.meta.url), "utf8");
const functionBody = sql.match(/CREATE FUNCTION app_private\.transfer_owner_from_legacy\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$/)?.[1] ?? "";

function syntheticState() {
  return {
    accounts: [
      { id: "source-owner", verified: true, enabled: true },
      { id: "target-member", verified: true, enabled: true },
    ],
    roles: [{ userId: "source-owner", role: "owner", grantedBy: null }],
    legacy: [{ id: 41, userId: "old-provider-id", email: "owner@example.test", isAdmin: true }],
    audit: [],
  };
}

async function transferFixture(state, { actor, targetId, sourceId, mappingConfirmed, failAudit = false }) {
  const before = structuredClone(state);
  try {
    if (!actor?.validLiveOwnerSession || !state.roles.some((row) => row.userId === actor.userId && row.role === "owner")) return "forbidden";
    if (!mappingConfirmed) return "mapping-not-confirmed";
    const target = state.accounts.find((row) => row.id === targetId);
    const source = state.legacy.find((row) => row.id === sourceId);
    if (!target || !target.verified || !target.enabled) return "target-ineligible";
    if (!source || source.email.toLowerCase() !== target.email?.toLowerCase()) return "identity-mapping-mismatch";
    if (state.legacy.filter((row) => row.email.toLowerCase() === source.email.toLowerCase()).length !== 1) return "identity-mapping-mismatch";

    const owner = state.roles.find((row) => row.userId === actor.userId && row.role === "owner");
    if (!owner) return "forbidden";
    owner.userId = target.id;
    owner.grantedBy = actor.userId;
    if (failAudit) throw new Error("synthetic audit insert failure");
    state.audit.push({ actor: actor.userId, subject: target.id, action: "owner_role_transferred", evidence: `legacy.users:${sourceId}` });
    return "transferred";
  } catch {
    Object.assign(state, before);
    return "rolled-back";
  }
}

test("review-only SQL is pinned, fixed-path SECURITY DEFINER, and grants execution without direct runtime writes", () => {
  assert.match(sql, /current_database\(\) <> 'drckgomz_phase5_test'/);
  assert.match(sql, /inet_server_port\(\) IS DISTINCT FROM 55441/);
  assert.match(sql, /current_setting\('server_version_num'\).*<> 18/);
  assert.match(sql, /SET search_path = pg_catalog/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /ALTER FUNCTION[\s\S]*?OWNER TO drckgomz_local_functions/);
  assert.match(sql, /REVOKE ALL ON FUNCTION .* FROM PUBLIC/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[\s\S]*?TO drckgomz_local_owner/);
  assert.doesNotMatch(sql, /GRANT\s+(?:INSERT|UPDATE|DELETE|ALL)[\s\S]{0,150}TO drckgomz_local_owner/i);
  assert.match(functionBody, /app_private\.current_owner_id\(\)/);
  assert.match(functionBody, /email_verified IS TRUE/);
  assert.match(functionBody, /profile\.enabled IS TRUE AND profile\.banned_at IS NULL/);
  assert.match(functionBody, /pg_advisory_xact_lock/);
  assert.match(functionBody, /UPDATE app\.user_roles/);
  assert.match(functionBody, /INSERT INTO app\.security_audit_events/);
  assert.match(functionBody, /current_owner_id\(\) IS DISTINCT FROM v_actor_user_id/);
  assert.doesNotMatch(functionBody, /FROM auth\.session|FOR UPDATE OF session_row|FOR SHARE/);
  assert.match(sql, /Required narrow row-lock privileges are missing/);
  assert.doesNotMatch(functionBody, /\bEXECUTE\b|legacy_row\.is_admin/i);
  assert.doesNotMatch(functionBody, /INSERT INTO app\.user_roles|DELETE FROM app\.user_roles/i);
});

test("synthetic successful transfer moves the existing singleton role and audits atomically", async () => {
  const state = syntheticState();
  state.accounts[1].email = "owner@example.test";
  const result = await transferFixture(state, {
    actor: { userId: "source-owner", validLiveOwnerSession: true },
    targetId: "target-member", sourceId: 41, mappingConfirmed: true,
  });
  assert.equal(result, "transferred");
  assert.equal(state.roles.filter((row) => row.role === "owner").length, 1);
  assert.equal(state.roles[0].userId, "target-member");
  assert.deepEqual(state.accounts.map((row) => row.id), ["source-owner", "target-member"]);
  assert.deepEqual(state.audit, [{ actor: "source-owner", subject: "target-member", action: "owner_role_transferred", evidence: "legacy.users:41" }]);
});

test("unconfirmed mapping is rejected even when the legacy row has is_admin=true", async () => {
  const state = syntheticState();
  state.accounts[1].email = "owner@example.test";
  const before = structuredClone(state);
  const result = await transferFixture(state, {
    actor: { userId: "source-owner", validLiveOwnerSession: true },
    targetId: "target-member", sourceId: 41, mappingConfirmed: false,
  });
  assert.equal(result, "mapping-not-confirmed");
  assert.deepEqual(state, before);
});

test("invalid session, unverified target, and mismatched legacy identity leave state unchanged", async (t) => {
  for (const scenario of [
    { name: "invalid session", actor: { userId: "source-owner", validLiveOwnerSession: false }, targetId: "target-member", sourceId: 41, mappingConfirmed: true },
    { name: "unverified account", actor: { userId: "source-owner", validLiveOwnerSession: true }, targetId: "target-member", sourceId: 41, mappingConfirmed: true, unverify: true },
    { name: "email mismatch", actor: { userId: "source-owner", validLiveOwnerSession: true }, targetId: "target-member", sourceId: 41, mappingConfirmed: true },
  ]) {
    await t.test(scenario.name, async () => {
      const state = syntheticState();
      if (scenario.name !== "email mismatch") state.accounts[1].email = "owner@example.test";
      if (scenario.unverify) state.accounts[1].verified = false;
      const before = structuredClone(state);
      const result = await transferFixture(state, scenario);
      assert.notEqual(result, "transferred");
      assert.deepEqual(state, before);
    });
  }
});

test("audit failure rolls back the synthetic role change and preserves both accounts", async () => {
  const state = syntheticState();
  state.accounts[1].email = "owner@example.test";
  const before = structuredClone(state);
  const result = await transferFixture(state, {
    actor: { userId: "source-owner", validLiveOwnerSession: true },
    targetId: "target-member", sourceId: 41, mappingConfirmed: true, failAudit: true,
  });
  assert.equal(result, "rolled-back");
  assert.deepEqual(state, before);
});
