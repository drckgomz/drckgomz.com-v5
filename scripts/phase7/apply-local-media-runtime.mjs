import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const TARGET = Object.freeze({ host: "127.0.0.1", port: 55441, database: "drckgomz_phase5_test", role: "phase5_local", major: 18 });

async function main() {
  if (process.env.NODE_ENV === "production" || process.argv[2] !== "--apply-local-media-runtime" || process.argv.length !== 3) {
    throw new Error("This runner only applies the media policies to the pinned disposable development database.");
  }
  const sqlText = (await readFile(resolve("scripts/phase7/local-media-runtime.sql"), "utf8")).trim();
  if (!sqlText.startsWith("-- Development-only media writes") || !sqlText.includes("Phase 7 local media target identity mismatch") ||
      !sqlText.includes("CREATE POLICY phase7_media_owner_insert") || !sqlText.endsWith("COMMIT;")) {
    throw new Error("The local media policy artifact differs from the reviewed execution shape.");
  }
  const client = new pg.Client({
    connectionString: `postgresql://${TARGET.role}@${TARGET.host}:${TARGET.port}/${TARGET.database}?sslmode=disable`,
    connectionTimeoutMillis: 3000,
    application_name: "phase7-local-media-policy",
  });
  try {
    await client.connect();
    const identity = (await client.query(`select current_database() as database,current_user as role,
      current_setting('server_version_num')::int / 10000 as major,inet_server_addr()::text as address,inet_server_port() as port`)).rows[0];
    if (identity?.database !== TARGET.database || identity?.role !== TARGET.role || identity?.major !== TARGET.major ||
        identity?.address !== `${TARGET.host}/32` || identity?.port !== TARGET.port) throw new Error("Local database identity mismatch.");
    const applied = await client.query("select count(*)::int as count from pg_catalog.pg_policies where schemaname='app' and policyname like 'phase7_media_owner_%'");
    if (applied.rows[0]?.count !== 0) throw new Error("Phase 7 media policies already exist; inspect local database state before proceeding.");
    const state = await client.query(`select count(*)::int as count from pg_catalog.pg_roles
      where rolname='drckgomz_local_owner' and rolcanlogin and not rolsuper and not rolbypassrls and not rolinherit`);
    if (state.rows[0]?.count !== 1) throw new Error("Expected least-privilege local owner role was not found.");
    await client.query(sqlText);
    const after = await client.query(`select count(*)::int as count from pg_catalog.pg_policies
      where schemaname='app' and tablename='media' and policyname like 'phase7_media_owner_%'`);
    if (after.rows[0]?.count !== 3) throw new Error("Post-apply media policy verification failed.");
    console.log("Applied three owner-scoped media policies to the pinned disposable PostgreSQL 18 database.");
  } finally { await client.end().catch(() => {}); }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "preflight-or-application-failed";
  console.error(`Phase 7 local media policy stopped: ${message}`);
  process.exitCode = 1;
});
