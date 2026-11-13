# Phase 3F Neon development preflight

**Status: STOPPED BEFORE DATABASE CONNECTION. SQL PREFLIGHT NOT RUN. NO MIGRATIONS OR IMPORTS RUN.** See the approved read-only endpoint check below. The owner reports a Neon branch named `development`, parent `production`, created with the schema-only option. A familiar branch name is not an attestation.

## Approved preflight identity check (2026-11-11)

The signed-in Neon Console showed project `jolly-poetry-87664309`, branch `br-nameless-dust-bewpmr4r` named `development`, and compute endpoint `ep-sparkling-sun-bedq0ozn` on that branch. The branch list labels it **Schema-only**. The same list displays `-` for the development branch Parent field, so parent `br-polished-shape-be2nmkl4` was not independently confirmed by the visible Console metadata.

The configured `DATABASE_URL` was parsed locally without displaying the value, username, hostname, or password. It is a valid Neon URL, but its endpoint identifier did **not** match `ep-sparkling-sun-bedq0ozn`. Therefore the required identity gate failed. No database connection was attempted; no SQL, catalog query, or count query was run. The configured endpoint is not established to be development, so it must not be used for this preflight. Production endpoint metadata was not consulted and the production database was never contacted.

**Outcome: STOP.** Before any connection, replace/fix the local development configuration using the development endpoint shown for branch `br-nameless-dust-bewpmr4r`, then request another narrowly scoped read-only preflight. Do not proceed with the current URL. The visible Parent `-` should also be reconciled with the claimed production parent before treating branch ancestry as verified.

## Follow-up identity and role gate (2026-11-11)

The owner supplied the development URL in `.env.neon.development.local`. It was read only from that file, parsed locally, and matched to endpoint `ep-sparkling-sun-bedq0ozn`. No inherited `DATABASE_URL` or `.env.local` value was used. The Neon Console connection dialog and branch Roles page showed only one available role, and it owns the development database. No separate read-only role is available in the current branch role list.

Per the owner's instruction, **no database connection was made** and no SQL/query or row count was run. The earlier endpoint mismatch is resolved, but the preflight remains stopped at the least-privilege gate. Do not use the owner role unless the owner gives separate explicit approval. The reviewed SQL now includes a 15-second transaction-local statement timeout, read-only transaction, schema/table/enum inventory, effective current-role privilege checks, and aggregate count query generation. Schema/data conflicts remain unknown.

## 1. Verify branch identity in Neon first

Before providing a connection URL or approving even a read-only connection, inspect the Neon Console using the existing account session. Record (in a private note, never Git/chat): project ID, branch ID, parent branch ID, exact branch name, endpoint ID/host, database, role, branch creation/source timestamp, and the Console's explicit schema-only indication. Confirm the branch has no production application traffic and is disposable. Capture or retain the Console's branch detail as evidence. If identity must be checked through the Neon API, use its read-only `GET` project/branch endpoints in the Console/API client; do not create or edit resources. The API defines a branch's `parent_id`; the name `development` does not establish its parent by itself. See [Neon branch API](https://api-docs.neon.tech/reference/createprojectbranch) for branch identity fields and branch/endpoint distinction.

The phrase “schema-only” must be confirmed in the branch's creation/details UI. Do not infer this property from a hostname, `current_database()`, or an empty-looking application. The current Neon branch API reference documents branch name and parent ID but does not establish this branch's selected UI option. If Console evidence is ambiguous, stop and clarify with Neon support before connecting.

## 2. Local connection configuration (do not share the URL)

`.env*` is ignored by the repository's `.gitignore` (`.env.local` was checked with `git check-ignore`; the file contents were not opened). A secret-free template is at [`.env.neon.development.example`](../.env.neon.development.example). After the branch evidence is verified, use a local editor to copy the template to `.env.local` and paste the development-only connection string from that branch's Neon Console. Keep the password out of terminal commands, shell history, screenshots, logs, issue reports, and chat. Do not use a production URL. Limit local file access to your account; do not commit the file.

The sample deliberately does not contain a real host or password. `DATABASE_URL` by itself cannot prove branch identity. Compare the URL's endpoint host and database against the private Console evidence before saving it. Use a least-privilege role for the read-only preflight. Keep the migration role separate from the eventual application runtime role. No secret has been read or configured by this phase.

## 3. Read-only database inspection (requires separate approval)

The first database connection has not been made. **The next boundary is explicit approval for one read-only connection to the verified development endpoint.** Once approved, use a read-only role and run `scripts/phase3f/neon-readonly-preflight.sql` interactively with `psql`, passing host/database/role fields from the verified Console entry (not a password-bearing URL), enabling password prompt, and using `-X -v ON_ERROR_STOP=1 -f scripts/phase3f/neon-readonly-preflight.sql`. For example, the later command shape is `psql "host=<verified-development-host> dbname=<verified-database> user=<read-only-role> sslmode=require" -W -X -v ON_ERROR_STOP=1 -f scripts/phase3f/neon-readonly-preflight.sql`; replace placeholders only in the local terminal after the approval gate. The password should be entered at the prompt or supplied through a protected local password manager file, never in the command. The script starts a read-only transaction and rolls it back. It reports database/role/version, existing non-system relation and enum names, whether Drizzle's migration ledger exists, and generates exact `COUNT(*)` SELECT statements without executing them. Execute those generated count queries only if their output remains aggregate counts; never copy record rows into logs. Match the connection host/role/database privately to the earlier Console evidence before interpreting any result. If the match fails, immediately stop and disconnect.

This is still a live database connection even though the SQL is read-only. It requires the owner's approval before execution. Do not use this preflight to inspect production. Do not run `drizzle-kit migrate`, `drizzle-kit push`, an import, or account/bootstrap code.

## 4. Migration conflict review

Reviewed local files: `drizzle.config.ts`, `drizzle/0000_petite_loki.sql`, `drizzle/0001_bitter_tiger_shark.sql`, both snapshots, and the migration journal. Generation is pinned to an unreachable loopback placeholder and does not read `DATABASE_URL`.

The first migration creates schemas `app`, `auth`, `legacy`, and `ops`; creates public enums `publication_state` and `content_visibility`; and creates objects including Better Auth's `auth.user`, `auth.session`, `auth.account`, and `auth.verification`, application content tables, legacy staging tables, and ops provenance tables. The second migration adds `deleted_at` and `deletion_date` to `app.home_projects`. It assumes these names are not already present. If the schema-only branch inherited schema from its parent, collisions are plausible and must be checked before applying anything. The generated DDL is not idempotent (`CREATE SCHEMA`, `CREATE TYPE`, `CREATE TABLE`, and `ALTER TABLE ADD COLUMN` are not guarded). Never manually mark migration history as applied to bypass collisions.

The migrations do not configure application/runtime grants or row-level security. Before app access, review owner/migration/runtime role ownership, grants for each schema, default privileges, and the public/private repository boundaries. Do not expose `auth`, `legacy`, or `ops` to public roles. Public content filtering is currently application repository logic; DB roles alone do not provide a row-level privacy boundary.

## 5. Existing schema and data conflict checks

No table, type, or record query has been run. A schema-only branch can contain existing tables even if it has no rows. The preflight lists object names and generates exact row-count SELECTs. Compare names to the migration DDL and identify any pre-existing Drizzle ledger; do not assume zero rows or a fresh target. Before schema approval, reconcile every collision by deciding whether the target is truly disposable and can be recreated through Neon Console (separately approved) or whether a reviewed forward migration is required. Never drop, truncate, rename, or overwrite existing objects as an automatic response.

Before a later import, exact counts, uniqueness, source-key mappings, slug conflicts, and FK/orphan checks must be reviewed. The current offline tools do not yet contain a database import writer and cannot report live target conflicts. Snapshot comparison also now reports duplicate IDs rather than silently collapsing them.

## 6. Approval gates and sequence

1. **Read-only connection approval (next gate):** approve connecting to the branch after privately verifying project/branch/parent/endpoint identity, schema-only setting, isolation, and role. No mutations.
2. **Schema application approval (separate):** review actual catalog preflight and exact SQL, confirm backup/restore or disposable-branch reset, role/grant plan, then explicitly approve applying migrations to the identified development branch. `drizzle-kit migrate` applies pending SQL migrations; it is a mutating operation, so do not run during preflight. See [Drizzle migration docs](https://orm.drizzle.team/docs/drizzle-kit-migrate).
3. **Data import approval (separate):** still blocked until the deterministic writer, source reconciliation, duplicate/orphan handling, private drafts, idempotency, report redaction, and rollback are implemented and reviewed. Do not import current or historical data as part of schema testing.
4. **Auth/account approval (separate):** keep public sign-up closed; do not create identities or bootstrap the owner until account recovery, verified enrollment, secure owner evidence, and actual Better Auth integration have been tested.

## 7. Remaining readiness items

- No branch identity, parent, schema-only option, contents, or permissions independently verified.
- No database connection or live table/record inventory performed.
- No importer/writer; import cannot be declared ready or successful.
- Current site still uses Clerk/Supabase by default and has incomplete Drizzle readers/writers. `pnpm dev` with Neon is not yet a supported full-site configuration.
- Better Auth closed-registration configuration exists, but owner bootstrap lacks a tested first-account enrollment path; do not switch `AUTH_PROVIDER` yet.
- Migration grants/RLS, actual branch collisions, and transaction behavior remain unverified.
