import { randomBytes, randomUUID } from "node:crypto";
import { chmod, mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";
import { hashPassword } from "better-auth/crypto";
import { validateMigrationArtifacts } from "../phase5/validate-migrations.mjs";

const target = Object.freeze({ host: "127.0.0.1", port: 55441, database: "drckgomz_phase5_test", role: "phase5_local", versionMajor: 18 });
const credentialsPath = resolve(".artifacts/phase6/local-owner.json");
const connectionString = `postgresql://${target.role}@${target.host}:${target.port}/${target.database}?sslmode=disable`;

function assertInvocation() {
  if (process.argv[2] !== "--initialize-local-owner" || process.argv.length !== 3 ||
      process.env.NODE_ENV !== "development" || process.env.LOCAL_PG_TARGET !== "phase6-local") {
    throw new Error("Use the one-shot local owner bootstrap command with the pinned development target.");
  }
}

async function main() {
  assertInvocation();
  const manifest = validateMigrationArtifacts(process.cwd());
  if (manifest.migrationCount !== 6) throw new Error("Expected local migration history is unavailable.");

  await mkdir(resolve(".artifacts/phase6"), { recursive: true, mode: 0o700 });
  await chmod(resolve(".artifacts/phase6"), 0o700);
  const email = "phase6-owner@local.test";
  const password = randomBytes(36).toString("base64url");
  const secret = randomBytes(48).toString("base64url");
  const userId = randomUUID();
  const accountId = randomUUID();
  const now = new Date();
  const credentialFile = JSON.stringify({ email, password, secret, createdAt: now.toISOString() }, null, 2);
  let credentialWritten = false;
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 3000, application_name: "phase6-local-owner-bootstrap" });

  try {
    await writeFile(credentialsPath, credentialFile, { flag: "wx", mode: 0o600 });
    credentialWritten = true;
    await client.connect();
    const identity = await client.query(`select current_database() as database, current_user as role,
      current_setting('server_version_num')::int / 10000 as major, inet_server_addr()::text as address`);
    const current = identity.rows[0];
    // PostgreSQL's inet::text representation includes the host mask (/32).
    const serverAddressIsPinnedLoopback = current?.address === `${target.host}/32`;
    const identityMatches = {
      database: current?.database === target.database,
      bootstrapRole: current?.role === target.role,
      postgresMajor: current?.major === target.versionMajor,
      loopbackAddress: serverAddressIsPinnedLoopback,
    };
    if (Object.values(identityMatches).some((matched) => !matched)) {
      throw new Error(`Disposable PostgreSQL identity check failed (${Object.entries(identityMatches).filter(([, matched]) => !matched).map(([field]) => field).join(",")}).`);
    }

    const stored = await client.query("select hash from drizzle.__drizzle_migrations order by created_at asc, id asc");
    const expectedHashes = manifest.migrationHashes;
    if (stored.rowCount !== expectedHashes.length || stored.rows.some((row, index) => row.hash !== expectedHashes[index])) {
      throw new Error("Applied migration history does not match the reviewed local manifest.");
    }
    const counts = await client.query(`select
      (select count(*)::int from auth."user") as users,
      (select count(*)::int from auth.account) as accounts,
      (select count(*)::int from app.user_profiles) as profiles,
      (select count(*)::int from app.user_roles where role='owner') as owners`);
    const count = counts.rows[0];
    if (count.users !== 0 || count.accounts !== 0 || count.profiles !== 0 || count.owners !== 0) {
      throw new Error("Local auth/profile tables are not empty; owner bootstrap stopped.");
    }
    const requiredRoles = await client.query(`select count(*)::int as count from pg_catalog.pg_roles
      where (rolname,rolcanlogin,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls) in (
        ('drckgomz_local_auth',true,false,false,false,false,false,false),
        ('drckgomz_local_content',true,false,false,false,false,false,false),
        ('drckgomz_local_owner',true,false,false,false,false,false,false))`);
    if (requiredRoles.rows[0]?.count !== 3) throw new Error("Local runtime-role state does not match the reviewed setup.");
    const functions = await client.query(`select count(*)::int as count from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='app_private' and p.proname in ('current_active_user','current_owner_id','current_viewer_profile','can_read_blog_row')`);
    if (functions.rows[0]?.count !== 4) throw new Error("Owner-verifying RLS helpers are unavailable.");

    const passwordHash = await hashPassword(password);
    await client.query("begin");
    await client.query(`insert into auth."user" (id,name,email,email_verified,created_at,updated_at)
      values ($1,$2,$3,true,$4,$4)`, [userId, "Phase 6 Synthetic Owner", email, now]);
    await client.query(`insert into auth.account (id,account_id,provider_id,user_id,password,created_at,updated_at)
      values ($1,$2,'credential',$2,$3,$4,$4)`, [accountId, userId, passwordHash, now]);
    await client.query(`insert into app.user_profiles (id,username,first_name,enabled,created_at,updated_at)
      values ($1,'phase6-local-owner','Phase 6',true,$2,$2)`, [userId, now]);
    await client.query(`insert into app.user_roles (user_id,role,granted_by,granted_at)
      values ($1,'owner',null,$2)`, [userId, now]);
    await client.query("commit");
    console.log("Synthetic local owner initialized. Credentials are stored in the ignored mode-0600 .artifacts/phase6/local-owner.json file.");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    if (credentialWritten) await unlink(credentialsPath).catch(() => {});
    const message = error instanceof Error ? error.message : "Unknown local bootstrap failure.";
    console.error(`Local owner bootstrap stopped: ${message}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch(() => {
  console.error("Local owner bootstrap stopped before account creation.");
  process.exitCode = 1;
});
