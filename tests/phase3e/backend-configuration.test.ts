import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { BackendConfigurationError, parseBackendConfiguration, type BackendEnvironment } from "../../src/lib/backend-configuration";

test("the only runtime backend is Better Auth with Drizzle and disabled CMS writes", () => {
  assert.deepEqual(parseBackendConfiguration({}), {
    auth: "better-auth", blogReads: "drizzle", projectReads: "drizzle",
    privateMedia: "drizzle", cmsMutations: "disabled",
  });
});

const unsupportedConfigurations: Array<[string, BackendEnvironment]> = [
  ["Clerk auth selector", { AUTH_PROVIDER: "clerk" }],
  ["Supabase blog reader", { BLOG_READ_BACKEND: "supabase" }],
  ["Supabase project reader", { PROJECT_READ_BACKEND: "supabase" }],
  ["Supabase private media", { PRIVATE_MEDIA_BACKEND: "supabase" }],
  ["legacy CMS mutations", { CMS_MUTATION_BACKEND: "supabase" }],
  ["unsupported database mutation selector", { CMS_MUTATION_BACKEND: "neon" }],
  ["auth typo", { AUTH_PROVIDER: "better-auth " }],
  ["reader typo", { BLOG_READ_BACKEND: "driz zle" }],
];

for (const [name, env] of unsupportedConfigurations) {
  test(`fails closed for ${name}`, () => assert.throws(() => parseBackendConfiguration(env), BackendConfigurationError));
}

test("empty selectors preserve the sole supported contract", () => {
  assert.equal(parseBackendConfiguration({ AUTH_PROVIDER: "", BLOG_READ_BACKEND: "" }).auth, "better-auth");
});

test("legacy services are no longer imported into public runtime boundaries", () => {
  const files = [
    "src/middleware.ts", "src/lib/auth/viewer.ts", "src/lib/blog/read.ts",
    "src/lib/projects/public.ts", "src/components/auth/RootAuthProvider.tsx",
    "src/components/home/sections/hero/HeroSection.tsx",
    "src/app/api/private/journal-media/[mediaId]/route.ts",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /@clerk\//, `${file} still imports Clerk`);
    assert.doesNotMatch(source, /@supabase\//, `${file} still imports Supabase`);
  }
});

test("privileged CMS API handlers remain fail-closed while Neon mutation repositories are unavailable", () => {
  const adminGuard = readFileSync("src/lib/admin/requireAdminApi.ts", "utf8");
  assert.match(adminGuard, /cmsMutations === "disabled"/);
  assert.match(adminGuard, /CMS administration is unavailable/);
  assert.doesNotMatch(adminGuard, /supabaseAdmin/);
});
