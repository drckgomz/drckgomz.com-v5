import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseProfileUpdateInput } from "../../src/lib/profile/profile-input.ts";

test("profile update accepts the supported own-profile fields and normalizes values", () => {
  assert.deepEqual(parseProfileUpdateInput({
    display_name: "  Derick Gomez ", first_name: " Derick ", last_name: " Gomez ", avatar_color: "#aabbcc",
  }), { display_name: "Derick Gomez", first_name: "Derick", last_name: "Gomez", avatar_color: "#AABBCC" });
});

test("profile update rejects malformed, oversized, control-character, and extra privilege inputs", () => {
  for (const input of [null, [], {},
    { display_name: " ", first_name: "A", last_name: "B", avatar_color: "#112233" },
    { display_name: "A".repeat(81), first_name: "A", last_name: "B", avatar_color: "#112233" },
    { display_name: "Name\nInjected", first_name: "A", last_name: "B", avatar_color: "#112233" },
    { display_name: "Name", first_name: "A", last_name: "B", avatar_color: "red" },
    { display_name: "Name", first_name: "A", last_name: "B", avatar_color: "#112233", user_id: "another-user", role: "owner" },
  ]) assert.equal(parseProfileUpdateInput(input), null);
});

test("profile API exposes authenticated GET and same-origin PUT only; database function is self-bound", async () => {
  const route = await readFile(new URL("../../src/app/api/profile/route.ts", import.meta.url), "utf8");
  const sql = await readFile(new URL("../../scripts/phase6/local-profile-settings.sql", import.meta.url), "utf8");
  assert.match(route, /export async function PUT\(request: Request\)/);
  assert.match(route, /origin !== requestOrigin/);
  assert.match(route, /getCurrentSessionTokenDigest/);
  assert.match(route, /getContentDatabase/);
  assert.match(route, /app_private\.update_current_profile/);
  assert.doesNotMatch(route, /(?:body|input)\.(?:user_id|userId|role|is_owner)/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path = pg_catalog/);
  assert.match(sql, /s\.token_sha256=pg_catalog\.lower\(p_token_sha256_hex\)/);
  assert.match(sql, /s\.expires_at > pg_catalog\.statement_timestamp\(\)/);
  assert.match(sql, /p\.enabled IS TRUE/);
  assert.match(sql, /p\.banned_at IS NULL/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION[\s\S]*TO drckgomz_local_content/);
  assert.match(sql, /GRANT SELECT \(version\) ON app\.user_profiles TO drckgomz_local_functions/);
  assert.match(sql, /GRANT UPDATE \(name, updated_at\) ON auth\."user" TO drckgomz_local_functions/);
  assert.match(sql, /GRANT UPDATE \(first_name, last_name, avatar_color, updated_at, version\) ON app\.user_profiles TO drckgomz_local_functions/);
  assert.doesNotMatch(sql, /GRANT UPDATE .*TO drckgomz_local_(?:auth|content)/);
  assert.match(sql, /current_database\(\) <> 'drckgomz_phase5_test'/);
});
