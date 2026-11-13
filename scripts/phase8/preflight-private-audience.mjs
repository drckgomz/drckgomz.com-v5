import pg from "pg";
import { validateMigrationArtifacts } from "../phase5/validate-migrations.mjs";

// Read-only only. No apply mode, environment loading, or inherited database URL.
const target = { host: "127.0.0.1", port: 55441, database: "drckgomz_phase5_test", user: "phase5_local" };
const manifest = validateMigrationArtifacts(process.cwd());
const client = new pg.Client({ ...target, connectionTimeoutMillis: 2500, application_name: "phase8-read-only-preflight" });
try {
  await client.connect();
  await client.query("begin read only");
  await client.query("set local statement_timeout='5s'");
  const identity = (await client.query(`select current_database() as database,current_user as role,
    inet_server_addr()::text as address,inet_server_port() as port,current_setting('server_version_num')::int /10000 as major`)).rows[0];
  if (identity.database !== target.database || identity.role !== target.user || identity.address !== "127.0.0.1/32" || identity.port !== target.port || identity.major !== 18) throw new Error("identity");
  const ledger = (await client.query("select hash from drizzle.__drizzle_migrations order by created_at")).rows.map(row => row.hash);
  if (JSON.stringify(ledger) !== JSON.stringify(manifest.migrationHashes)) throw new Error("ledger");
  const state = (await client.query(`select
    (select count(*)::int from app.user_roles where role='owner') as owners,
    (select count(*)::int from app.posts) as posts,
    (select count(*)::int from app.posts where publication_state='draft' and visibility='private') as private_drafts,
    (select count(*)::int from pg_catalog.pg_roles where rolname in ('drckgomz_local_functions','drckgomz_local_owner')
      and not rolsuper and not rolbypassrls and not rolinherit and not rolcreatedb and not rolcreaterole and not rolreplication
      and rolcanlogin=(rolname='drckgomz_local_owner')) as safe_roles,
    (select count(*)::int from pg_catalog.pg_class where oid in ('app.user_profiles'::regclass,'app.user_roles'::regclass,
      'app.user_capabilities'::regclass,'app.security_audit_events'::regclass,'auth.session'::regclass,'auth.user'::regclass)
      and (relrowsecurity or relforcerowsecurity)) as unexpected_rls,
    to_regprocedure('app_private.current_owner_id()') is not null as owner_function,
    to_regprocedure('app_private.phase8_assert_active_owner(text)') is null
      and to_regprocedure('app_private.list_private_audience_users(text,integer,integer)') is null
      and to_regprocedure('app_private.set_private_journal_access(text,text,boolean)') is null as functions_absent,
    exists(select 1 from pg_catalog.pg_indexes where schemaname='app' and indexname='app_user_roles_single_owner_uq') as owner_index`)).rows[0];
  if (state.owners !== 1 || state.posts !== 3 || state.private_drafts !== 3 || state.safe_roles !== 2 || state.unexpected_rls !== 0 || !state.owner_function || !state.functions_absent || !state.owner_index) throw new Error("preconditions");
  await client.query("rollback");
  console.log("Local target, six migration hashes, role/RLS/function preconditions and three private drafts verified. Prepared audience SQL has NOT been applied.");
} catch {
  await client.query("rollback").catch(() => {});
  console.error("Private-audience read-only preflight failed; no migration applied. Inspect local identity, migration ledger and function/role state.");
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
