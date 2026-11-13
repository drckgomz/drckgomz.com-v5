import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { validateMigrationArtifacts } from "../phase5/validate-migrations.mjs";

const TARGET = Object.freeze({ host: "127.0.0.1", port: 55441, database: "drckgomz_phase5_test", role: "phase5_local", major: 18 });
const MIGRATION_TAG = "0005_session_digest_adapter_default";
const URL = `postgresql://${TARGET.role}@${TARGET.host}:${TARGET.port}/${TARGET.database}?sslmode=disable`;

async function main() {
  if (process.argv[2] !== "--apply-phase6-local-0005" || process.argv.length !== 3) {
    throw new Error("This runner only applies the reviewed migration to the pinned disposable local database.");
  }
  const artifacts = validateMigrationArtifacts(process.cwd());
  if (artifacts.migrationCount !== 6 || artifacts.nextMigration !== MIGRATION_TAG) throw new Error("Reviewed migration manifest mismatch.");
  const migrationPath = resolve("drizzle", `${MIGRATION_TAG}.sql`);
  const migrationSql = readFileSync(migrationPath, "utf8").trim();
  const migrationHash = createHash("sha256").update(readFileSync(migrationPath)).digest("hex");
  const manifest = JSON.parse(readFileSync(resolve("scripts/phase5/migration-manifest.json"), "utf8"));
  if (manifest.migrations[5]?.tag !== MIGRATION_TAG || manifest.migrations[5]?.sha256 !== migrationHash ||
      migrationSql !== `ALTER TABLE "auth"."session" ALTER COLUMN "token_sha256" SET DEFAULT '';`) {
    throw new Error("Migration content or checksum does not match the reviewed one-statement change.");
  }

  const client = new pg.Client({ connectionString: URL, connectionTimeoutMillis: 3000, application_name: "phase6-local-migration-0005" });
  let transaction = false;
  try {
    await client.connect();
    const identity = (await client.query(`select current_database() as database,current_user as role,
      current_setting('server_version_num')::int / 10000 as major,inet_server_addr()::text as address,
      inet_server_port() as port`)).rows[0];
    if (identity?.database !== TARGET.database || identity?.role !== TARGET.role || identity?.major !== TARGET.major ||
        identity?.address !== `${TARGET.host}/32` || identity?.port !== TARGET.port) throw new Error("Local database identity mismatch.");

    const expectedBefore = manifest.migrations.slice(0, 5).map((entry) => entry.sha256);
    const before = (await client.query("select hash from drizzle.__drizzle_migrations order by created_at asc")).rows.map((row) => row.hash);
    if (JSON.stringify(before) !== JSON.stringify(expectedBefore)) throw new Error("Expected exact five-migration baseline was not found.");
    const state = await client.query(`select column_default from information_schema.columns
      where table_schema='auth' and table_name='session' and column_name='token_sha256'`);
    if (state.rowCount !== 1 || state.rows[0].column_default !== null) throw new Error("Session digest default is already changed or the schema is unexpected.");
    const trigger = await client.query(`select count(*)::int as count from pg_catalog.pg_trigger t
      join pg_catalog.pg_class c on c.oid=t.tgrelid join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='auth' and c.relname='session' and t.tgname='auth_session_token_sha256_trg' and not t.tgisinternal`);
    if (trigger.rows[0]?.count !== 1) throw new Error("Required session digest trigger is missing.");

    await client.query("begin"); transaction = true;
    await client.query("set local statement_timeout='15s'");
    await client.query("set local lock_timeout='5s'");
    await client.query(migrationSql);
    await client.query("insert into drizzle.__drizzle_migrations (hash,created_at) values ($1,$2)", [migrationHash, Date.now()]);
    const after = (await client.query("select hash from drizzle.__drizzle_migrations order by created_at asc")).rows.map((row) => row.hash);
    if (JSON.stringify(after) !== JSON.stringify(manifest.migrations.map((entry) => entry.sha256))) throw new Error("Post-migration ledger verification failed.");
    const defaultAfter = await client.query(`select column_default from information_schema.columns
      where table_schema='auth' and table_name='session' and column_name='token_sha256'`);
    if (defaultAfter.rows[0]?.column_default !== "''::text") throw new Error("Post-migration session digest default verification failed.");
    await client.query("commit"); transaction = false;
    console.log("Applied Phase 6 migration 0005 to the pinned disposable PostgreSQL 18 database; all six migration hashes and the trigger-backed digest default verified.");
  } catch (error) {
    if (transaction) await client.query("rollback").catch(() => {});
    const message = error instanceof Error ? error.message : "Unknown failure.";
    console.error(`Phase 6 local migration stopped: ${message}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`Phase 6 local migration stopped: ${error instanceof Error ? error.message : "preflight failure"}`);
  process.exitCode = 1;
});
