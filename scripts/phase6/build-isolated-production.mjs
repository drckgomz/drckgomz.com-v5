import { mkdir, copyFile, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const stage = resolve(root, ".artifacts/phase6", `production-build-${Date.now()}`);
await mkdir(stage, { recursive: true });
for (const name of ["src", "node_modules", "public"]) {
  await symlink(resolve(root, name), resolve(stage, name), "dir");
}
for (const name of ["package.json", "tsconfig.json", "next-env.d.ts", "next.config.ts", "postcss.config.mjs"]) {
  if (existsSync(resolve(root, name))) await copyFile(resolve(root, name), resolve(stage, name));
}

const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  NODE_ENV: "production",
  CI: "1",
  NEXT_TELEMETRY_DISABLED: "1",
  // This stage contains no dotenv files and receives no provider values.
  DATABASE_URL: "",
  NEON_AUTH_DATABASE_URL: "",
  NEON_CONTENT_DATABASE_URL: "",
  NEON_OWNER_DATABASE_URL: "",
  NEON_TARGET: "",
  NEON_PROJECT_ID: "",
  NEON_BRANCH_ID: "",
  NEON_ENDPOINT_ID: "",
  LOCAL_PG_INTEGRATION: "",
  SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  CLERK_SECRET_KEY: "",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
  BETTER_AUTH_GOOGLE_CLIENT_ID: "",
  BETTER_AUTH_GOOGLE_CLIENT_SECRET: "",
  BETTER_AUTH_APPLE_CLIENT_ID: "",
  BETTER_AUTH_APPLE_CLIENT_SECRET: "",
  AWS_ACCESS_KEY_ID: "",
  AWS_SECRET_ACCESS_KEY: "",
};

const result = spawnSync(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), "build", "--webpack"], {
  cwd: stage,
  env,
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
