import { readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";
import { resolve } from "node:path";
import pg from "pg";
import { validateMigrationArtifacts } from "../phase5/validate-migrations.mjs";

const credentialsPath = resolve(".artifacts/phase6/local-owner.json");
const target = { host: "127.0.0.1", port: 55441, database: "drckgomz_phase5_test" };
const appPort = 3000;

async function assertPortAvailable() {
  await new Promise((resolvePromise, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
        reject(new Error(`Port ${appPort} is already in use. Stop the existing local website process, then run pnpm dev again.`));
      } else reject(new Error(`Cannot verify localhost:${appPort} availability; refusing to let Next choose another port.`));
    });
    server.listen(appPort, "127.0.0.1", () => server.close((error) => error ? reject(error) : resolvePromise()));
  });
}

async function verifyDatabase() {
  const client = new pg.Client({
    connectionString: `postgresql://drckgomz_local_auth@${target.host}:${target.port}/${target.database}?sslmode=disable`,
    connectionTimeoutMillis: 2500,
    application_name: "drckgomz-local-dev-preflight",
  });
  try {
    await client.connect();
    const identity = await client.query(`select current_database() as database, current_user as role,
      current_setting('server_version_num')::int / 10000 as major, inet_server_addr()::text as address`);
    const row = identity.rows[0];
    if (row?.database !== target.database || row?.role !== "drckgomz_local_auth" || row?.major !== 18 || row?.address !== `${target.host}/32`) {
      throw new Error("The PostgreSQL response did not match the pinned disposable Phase 6 target.");
    }
    // The auth runtime role deliberately cannot read the migration ledger.
    // Validate checked-in migration artifacts offline; do not widen this role.
    validateMigrationArtifacts(process.cwd());
  } catch (error) {
    if (error instanceof Error && error.message.includes("pinned disposable")) throw error;
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code.replace(/[^A-Z0-9_]/g, "").slice(0, 16) : "unclassified";
    throw new Error(`Pinned local PostgreSQL preflight failed (${code}). Verify the approved PostgreSQL 18.6 service and Phase 6 runtime-role setup; no remote database fallback is available.`);
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Phase 6 local runtime is development-only.");
  const file = await stat(credentialsPath);
  if ((file.mode & 0o077) !== 0 || !file.isFile()) throw new Error("Local owner credential file must be a regular mode-0600 file.");
  const credentials = JSON.parse(await readFile(credentialsPath, "utf8"));
  if (credentials.email !== "phase6-owner@local.test" || typeof credentials.password !== "string" || credentials.password.length < 40 ||
      typeof credentials.secret !== "string" || credentials.secret.length < 48) {
    throw new Error("Local owner credential artifact is invalid.");
  }
  await assertPortAvailable();
  await verifyDatabase();

  const localEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    NODE_ENV: "development",
    LOCAL_PG_INTEGRATION: "1",
    LOCAL_PG_TARGET: "phase6-local",
    LOCAL_PG_AUTH_DATABASE_URL: `postgresql://drckgomz_local_auth@${target.host}:${target.port}/${target.database}?sslmode=disable`,
    LOCAL_PG_CONTENT_DATABASE_URL: `postgresql://drckgomz_local_content@${target.host}:${target.port}/${target.database}?sslmode=disable`,
    LOCAL_PG_OWNER_DATABASE_URL: `postgresql://drckgomz_local_owner@${target.host}:${target.port}/${target.database}?sslmode=disable`,
    BETTER_AUTH_URL: "http://localhost:3000",
    BETTER_AUTH_SECRET: credentials.secret,
    AUTH_PROVIDER: "better-auth",
    BLOG_READ_BACKEND: "drizzle",
    PROJECT_READ_BACKEND: "drizzle",
    PRIVATE_MEDIA_BACKEND: "drizzle",
    CMS_MUTATION_BACKEND: "disabled",
    OFFLINE_DESIGN_MODE: "",
    NEXT_TELEMETRY_DISABLED: "1",
    LOCAL_MAILBOX_PATH: resolve(".artifacts/phase6/local-mailbox.json"),
    // Prevent Next's dotenv loader from exposing unrelated provider credentials
    // to this process even if it loads a local env file internally.
    DATABASE_URL: "",
    NEON_AUTH_DATABASE_URL: "",
    NEON_CONTENT_DATABASE_URL: "",
    NEON_OWNER_DATABASE_URL: "",
    NEON_TARGET: "",
    NEON_PROJECT_ID: "",
    NEON_BRANCH_ID: "",
    NEON_ENDPOINT_ID: "",
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
    NEXT_PUBLIC_API_BASE: "",
    NEXT_PUBLIC_API_BASE_URL: "",
    NEXT_PUBLIC_S3_MEDIA_BASE: "",
    S3_PRIVATE_JOURNAL_BUCKET: "",
    S3_PRIVATE_JOURNAL_PREFIX: "",
    AWS_REGION: "",
    AWS_ACCESS_KEY_ID: "",
    AWS_SECRET_ACCESS_KEY: "",
  };
  const processRef = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: process.cwd(),
    env: localEnv,
    stdio: "inherit",
  });
  console.log(`Starting isolated local website at http://localhost:${appPort} (database target verified: PostgreSQL 18, ${target.database}, loopback only).`);
  processRef.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unable to start the isolated Phase 6 local runtime.");
  process.exitCode = 1;
});
