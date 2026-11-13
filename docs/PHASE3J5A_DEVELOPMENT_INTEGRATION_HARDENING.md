# Phase 3J.5A — Offline Development Integration Hardening

Status: offline implementation only. No environment file was read or changed; no Neon, AWS, Apple, Google, or other external service was contacted. Better Auth remains inactive on the working Clerk/Supabase path.

## Runtime database target guard

`src/lib/db/client.ts` now calls the exact-target parser before creating **or returning** the cached Drizzle client. It checks the expected project, branch, endpoint, database, exact endpoint hostname, database role, PostgreSQL URL scheme, standard port, encrypted TLS mode (`require` or `verify-full`), and a narrow URL query allowlist. It rejects incomplete target metadata, owner-role URLs, production branch IDs, host lookalikes, unrecognized TLS settings, URL fragments, and unexpected connection options. Errors do not include the URL or credential values. A cached client cannot be reused under a different expected role.

Pinned development target (from previously user-verified metadata): project `jolly-poetry-87664309`, branch `br-nameless-dust-bewpmr4r`, endpoint `ep-sparkling-sun-bedq0ozn`, hostname `ep-sparkling-sun-bedq0ozn.c-9.us-east-2.aws.neon.tech`, database `neondb`. These constants prevent accidental target drift; they do **not** cryptographically attest Neon branch identity. Before a live operation, the operator must freshly verify project, branch, endpoint, parent, and database in Neon Console. Production branch `br-polished-shape-be2nmkl4` is not an allowed runtime target.

Better Auth remains disabled unless its configuration contains all target IDs and passes the same exact target check. There is no `.env.local`, inherited `DATABASE_URL`, or production fallback in the target parser. Existing Clerk/Supabase routes remain the default.

## Database role design (proposal only; no role created)

Keep migration/owner credentials out of application runtime. The proposed `drckgomz_runtime` login is non-owner, non-superuser, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS`, and has no privileged role memberships. It receives `CONNECT` to `neondb`, `USAGE` on `auth`, `app`, and `public` (the publication enums are currently in `public`), and no schema `CREATE`, ownership, `legacy`/`ops` access, or migration-ledger access.

| Objects | Minimum expected application operations |
| --- | --- |
| `auth.user` | Better Auth user lookup and lifecycle: `SELECT`, `INSERT`, `UPDATE`, `DELETE`; column-level `UPDATE(updated_at)` is needed for `SELECT ... FOR UPDATE` in current owner workflows. |
| `auth.account` | Better Auth OAuth account lookup and lifecycle: `SELECT`, `INSERT`, `UPDATE`, `DELETE`. This contains OAuth token fields; database access and query logging must remain restricted. |
| `auth.session`, `auth.verification` | Better Auth session and verification lifecycle: `SELECT`, `INSERT`, `UPDATE`, `DELETE`. |
| `app.user_profiles` | `SELECT`, `INSERT` for public-only registration provisioning; column-level `UPDATE(updated_at)` for row locking. No profile or role escalation updates. |
| `app.user_roles` | `SELECT` only, plus column-level `UPDATE(granted_at)` solely because current code uses `SELECT ... FOR UPDATE` to serialize owner checks. No role insert/update/delete for ordinary runtime. |
| `app.user_capabilities` | `SELECT`, `INSERT`, `DELETE` for owner-approved private access grants/revocations. This path always performs server-side owner and target checks. |
| `app.security_audit_events` | `INSERT` only for the current grant/revoke workflow. No update/delete. |
| `app.posts`, `app.media`, `app.home_projects`, `app.home_project_media`, `app.home_sections`, `app.home_media` | `SELECT` only for the currently prepared public/private readers. Existing Clerk/Supabase CMS writes remain on their current path. |

The column-level timestamp grants are a PostgreSQL row-locking accommodation, not an application update feature. `SELECT FOR UPDATE/SHARE` requires `UPDATE` privilege on at least one column; current policy stores lock rows in profiles and roles. Prefer refactoring to an advisory-lock or a dedicated lock row in a future schema-reviewed change if even timestamp-column update permission is too broad. Verify adapter behavior against this matrix before provisioning. Do not grant database-wide defaults or permissions on future tables implicitly.

Use a separate, one-shot `drckgomz_bootstrap` role for first-owner bootstrap. It should have only `CONNECT`, `USAGE` on `auth`/`app`/`drizzle`, read access to the selected verified identity/profile/owner state and the Drizzle ledger `id`/`hash` columns (the runner orders by `id` while checking migration hashes), insert on `app.user_roles` and `app.security_audit_events`, and the minimum timestamp-column update privilege required for the existing profile row lock. It must not be a member of `drckgomz_runtime`, the migration role, or any elevated role. Disable/revoke this login after the approved single use. The prepared runner expects this role and is dry-run-first; it was not executed.

The role proposal must be converted into reviewed, development-only DDL and independently verified effective privileges before Better Auth testing. No role or grant SQL is included as executable here.

## First-owner bootstrap runner

Prepared: `scripts/phase3j5a/bootstrap-first-owner-development.mjs`. It reads only `.env.neon.bootstrap.development.local`, requires Git ignore status, requires the pinned exact host/database and `drckgomz_bootstrap` role, and verifies the three reviewed Drizzle migration hashes. The default/no-apply mode is a local dry run and makes no connection. Apply mode requires all pinned project/branch/endpoint/database flags, `--console-identity-verified`, `--confirm-owner-bootstrap`, a selected Better Auth user ID, and an approval reference. Its database preflight is read-only and checks database/role/version, role restrictions and memberships, migration hashes, an active verified profile, and zero existing owners before calling the serialized first-owner transaction. The script suppresses raw database errors and does not log selected user IDs or credentials.

Do not execute it as part of this phase. Before a future use, separately approve (a) any credential/role provisioning, (b) the read-only identity preflight if not already authorized, and (c) the irreversible owner assignment. The runner cannot prove Console branch identity by itself.

## Provider callback review

Better Auth's current callbacks are:

- Google: `${BETTER_AUTH_URL}/api/auth/callback/google` (for a local-only origin `http://localhost:3000`, this is `http://localhost:3000/api/auth/callback/google`). Register the exact URI, including scheme, host, port, and path, with a development-only Web OAuth client.
- Apple: `${BETTER_AUTH_URL}/api/auth/callback/apple`. Apple web sign-in requires an approved HTTPS development hostname; `localhost` over HTTP is not suitable. Configure the matching Services ID, associated primary App ID, verified domain, and exact Return URL `https://<approved-dev-host>/api/auth/callback/apple`. Keep the Apple signing key outside the repository and create/store only the development client secret through an approved credential flow.

Provider-console settings and credentials were not inspected. The application requires complete provider credential pairs, requires verified provider email, disables implicit account linking, and only adds Apple's `https://appleid.apple.com` origin to Better Auth's trusted origin list when Apple is configured. Validate state/nonce, callback errors, email verification, duplicate identities, and redirects during a later isolated provider test. No production callback or origin should be added to a development client.

## Private S3 development requirements

No AWS resources or credentials were accessed. Before storage testing, provision and verify a distinct private development journal bucket through a separately approved AWS operation. Require Block Public Access, no public bucket policy/ACL or website hosting, server-side encryption, and no CloudFront/public alternate origin serving that bucket or private prefix. Use a narrowly scoped development identity with only `s3:GetObject` and `s3:PutObject` on the private journal prefix; do not add `ListBucket`, delete, ACL, policy, or bucket-management actions to the application identity. Confirm lifecycle rules will not archive active journal objects. Set only `S3_PRIVATE_JOURNAL_BUCKET`, `S3_PRIVATE_JOURNAL_PREFIX`, and `AWS_REGION` in an ignored local configuration after approval. The configured private bucket must differ from `S3_BUCKET`; current upload configuration fails closed otherwise. Existing legacy public URLs cannot be revoked by application authorization and remain quarantined from private-post responses until storage migration is separately designed and approved.

## Offline verification

The target-parser regression suite uses synthetic URLs and exercises wrong project, production branch, wrong endpoint, production selector, missing configuration, wrong and lookalike hosts, wrong database, owner role, weak/missing TLS, and unexpected query options. It also asserts that failures do not echo URL/password values and that the database guard runs before cached-client reuse. The owner-runner contract test checks the explicit ignored-file path, target/approval gates, read-only preflight, and restricted bootstrap entry point.

No connection, migration, account registration, owner bootstrap, role grant, S3 operation, OAuth console setup, or browser test occurred.

## Remaining approvals before live development integration

Approve each operation separately:

1. Provision and verify the least-privilege runtime and one-shot bootstrap database roles on the isolated development branch only.
2. Configure ignored local development credentials and provider settings; independently attest the Neon branch/endpoint in Console.
3. Approve a read-only Neon preflight using the restricted runtime role.
4. Approve local Better Auth activation and synthetic OAuth account/session writes.
5. Approve the one-time first-owner bootstrap for the independently verified selected account.
6. Separately approve owner audience grant/revocation tests and synthetic content/media row writes.
7. Provision and verify private S3 development configuration and approve a synthetic object upload/read test.

Clerk/Supabase remains the existing application path until feature parity, route behavior, security boundaries, and rollback are verified in a controlled development integration. No production activation is authorized by this document.
