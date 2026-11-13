# Phase 3J.5B — Read-Only Development Infrastructure Readiness

> **Superseded for database privilege design by Phase 3J.5C.** The shared `drckgomz_runtime` proposal below is historical evidence only; its direct private-content SELECT and capability mutation grants must not be provisioned. The two SQL files under `scripts/phase3j5b/` have been replaced with non-mutating superseded notices. See [Phase 3J.5C ADR](PHASE3J5C_DATABASE_PRIVILEGE_ISOLATION_ADR.md) and the review-only design sketches under `scripts/phase3j5c/`.

Status: repository and installed dependency review only. No Neon, AWS, Google, or Apple console/service was contacted. No environment file or credential was read or changed. No SQL was executed, no role/bucket/client was created, and Better Auth remains inactive.

## Neon target attestation before any connection

The local guard pins project `jolly-poetry-87664309`, branch `br-nameless-dust-bewpmr4r`, endpoint `ep-sparkling-sun-bedq0ozn`, exact hostname `ep-sparkling-sun-bedq0ozn.c-9.us-east-2.aws.neon.tech`, and database `neondb`. It detects local URL mistakes; it cannot authenticate those values as a Neon branch identity.

Immediately before each separately approved operation, verify in Neon Console:

1. Project name and immutable project ID match `drckgomz.com` / `jolly-poetry-87664309`.
2. The selected branch is `development`, ID `br-nameless-dust-bewpmr4r`; confirm its parent is production branch `br-polished-shape-be2nmkl4` and the selected branch is the intended development copy.
3. Endpoint ID `ep-sparkling-sun-bedq0ozn` is attached to that development branch. Match the endpoint shown by Console to the exact hostname pinned by the runtime guard. Stop if IDs or hostname differ or if the mapping is ambiguous.
4. Region is AWS `us-east-2`; database is `neondb`; server is PostgreSQL 18.x. Never rely on the database name, an environment label, or a connection URL alone to establish the branch.
5. The development branch contains the expected Phase 3H migration ledger and Phase 3I legacy staging state. Do not query or print content records during preflight.

Console attestation is needed again if an endpoint is recreated, branch is restored/renamed, or the connection file changes. Production remains out of scope.

## Database permission audit

Reviewed the actual `@better-auth/drizzle-adapter` 1.7.16 installed locally and the call sites under `src/lib/auth` and `src/lib/db/repositories`. The adapter implements generic `create`, `findOne/findMany/count`, `update/updateMany`, `delete/deleteMany`, and consume operations. The configured app uses only its core user, account, session, and verification models; no organization, admin, passkey, or two-factor plugins are enabled.

The Google/Apple sign-in path needs user/account/session reads and writes: new social identity and account creation; reads for lookup and account ownership; user/account updates for provider profile/token refresh; session create/read/refresh/delete for sign-in/out and revocation. Current config has email/password enabled with password sign-up disabled; therefore account `password` remains part of Better Auth's account model and must be considered during a later behavior review. `auth.verification` is mapped but no configured Google callback flow currently needs verification rows, so the proposed runtime role does not receive table privileges there. Do not grant access merely because a schema table exists. If a later email verification/reset or password flow requires it, add only the proven operations after tests.

The current role is shared by Better Auth, viewer/audience reads, and Drizzle public blog/project readers. Its required table access is summarized below and embodied only as review SQL in `scripts/phase3j5b/create-development-runtime-roles-review-only.sql`:

| Object | Runtime access proposed | Evidence / limitation |
| --- | --- | --- |
| `auth.user` | SELECT, INSERT, UPDATE | Better Auth identity creation, lookup, OAuth profile updates, and owner list. No DELETE grant; configured self-service user deletion is not enabled. |
| `auth.account` | SELECT, INSERT, UPDATE | OAuth account creation, lookup, and token refresh/update. No DELETE grant; implicit linking is disabled. Confirm account unlink behavior in live flow before enabling any grant. |
| `auth.session` | SELECT, INSERT, UPDATE, DELETE | Session create/read/refresh/sign-out/revocation. |
| `auth.verification` | No table grant initially | Not required by the configured social sign-in flow; add only if a later enabled flow demonstrably requires it. |
| `app.user_profiles` | Selected-column SELECT; INSERT only for id/username/enabled/first_name; UPDATE only `updated_at` for row locking | Public-only registration hook, viewer and owner dashboard. The timestamp grant exists because PostgreSQL requires UPDATE privilege on a column for `SELECT FOR UPDATE`; the app does not set it. |
| `app.user_roles` | SELECT of `user_id, role`; UPDATE only `granted_at` for row locking | Viewer and owner authorization checks. No runtime role insert/update/delete. The grant on timestamp remains a residual SQL capability. |
| `app.user_capabilities` | SELECT of `user_id, capability`; INSERT on `user_id, capability, granted_by`; DELETE | Owner audience listing and private access grant/revoke. These writes rely on application authorization; a stolen shared runtime credential could bypass that application check. |
| `app.security_audit_events` | INSERT on current actor/subject/action/evidence columns | Grant/revoke audit rows. No read/update/delete. |
| `app.posts`, `app.media`, `app.home_projects`, `app.home_project_media` | SELECT | Current Drizzle blog/private-media and public-project readers issue full row projections. Existing CMS writes remain on Clerk/Supabase. |
| `public.publication_state`, `public.content_visibility` | USAGE | Drizzle publication predicates use these enums, currently created in `public`; no `CREATE` is granted on `public`. |
| `app.home_sections`, `app.home_media`, `app.categories` | No runtime grant proposed | No current Drizzle runtime query was found for these tables. |
| `legacy.*`, `ops.*`, `drizzle.*` | No access | Staging, provenance and migration internals are not runtime data. |

### Security blockers in the shared role design

1. **Private-content row isolation is application-enforced.** No RLS policies currently constrain `app.posts` or `app.media`. Granting SELECT lets the application credential read all drafts and private posts if the process/credential is compromised. Public/private authorization is checked in server code, but the DB role is not a row-level privacy boundary. Before production, either keep database credentials exclusively in a trusted server and accept/document that boundary, or separately design/test RLS with transaction-scoped authenticated subject context. Do not add RLS policies as part of this offline task.
2. **Audience mutation shares the content runtime credential.** `app.user_capabilities` INSERT/DELETE are necessary for the current owner workflow. A leaked app credential can grant access without calling the owner API. The stronger design is a narrowly scoped mutation function or isolated privileged path with database enforcement, reviewed for actor identity and audit atomicity. Current code does not establish that DB-level boundary.
3. **Row locks require write-like privileges.** Profile/role row locks need column UPDATE grants. Those timestamp columns can be altered by direct SQL using the runtime identity. Refactor to a reviewed advisory-lock/lock-row design or retain and accept this limited residual ability before provisioning.
4. **Other database CONNECT may come from PUBLIC.** Granting `CONNECT` to `neondb` does not negate a default PUBLIC CONNECT grant on another database in the same branch. The read-only verifier now reports effective CONNECT across databases and schema/table rights, role attributes, and memberships. If either role can connect elsewhere, do not claim target-database-only access; resolving it may require a separate ACL decision. This proposal does not modify PUBLIC privileges.

Neon exposes role creation as a branch-specific operation, while PostgreSQL roles are cluster-scoped within that branch rather than database-scoped. [Neon's create-role API](https://neon.com/docs/reference/api/branches/create-project-branch-role) identifies project and branch in the operation path; [PostgreSQL 18](https://www.postgresql.org/docs/18/database-roles.html) confirms roles apply across databases in the cluster. The role SQL is branch-limited only when executed after fresh Console attestation against the development branch; PostgreSQL SQL itself does not verify project or branch IDs.

The one-shot `drckgomz_bootstrap` role is separate and gets only the bootstrap runner's identity/profile/owner-state reads, profile `updated_at` lock privilege, owner-role/audit inserts, read access to `subject_user_id`/`action` for its post-commit audit verification, and read-only `SELECT(id,hash)` on the Drizzle migration ledger (the runner orders by `id` while verifying hashes). It receives no auth account/session/verification or content access, no capability mutation, no migration write privilege, no `legacy`/`ops` access, and no role membership. Its DDL is in the same review-only SQL file. The owner runner checks its own role flags and that it has no memberships before its read-only preflight, but the separate verifier is required to inspect membership in both directions and effective rights after provisioning.

PostgreSQL's `PUBLIC` role makes access additive. The SQL does not alter shared PUBLIC grants or default privileges. Review both existing PUBLIC ACLs and effective access; do not infer least privilege from the statements in isolation.

### Review-only SQL artifacts

- `scripts/phase3j5b/create-development-runtime-roles-review-only.sql` proposes two no-password login roles and the listed grants. It refuses the wrong database/version or an already existing proposed role. It cannot verify project/branch/endpoint identity: Console attestation is mandatory. It contains no `ALTER DEFAULT PRIVILEGES`, role memberships, ownership, `CREATE`, migration privileges, writes on content tables, or PUBLIC changes. Passwords must be handled later by an approved interactive credential flow, not embedded in SQL or shell history.
- `scripts/phase3j5b/verify-development-runtime-roles-review-only.sql` contains only read-only queries, transaction-local timeout, and rollback. It reports database CONNECT access, roles and memberships, schema access, table DML, and row-lock column privileges. Do not run it without separate approval.

After separate role-creation approval and a successful SQL transaction, initialize each login password interactively with psql's `\password role_name` prompt; never put plaintext in SQL or a command argument. Execute the reviewed SQL with stop-on-error behavior. If the transaction aborts, make no repair in place. If role creation commits but credential setup fails, leave the login unused, report only sanitized status, and request separate approval for a read-only check and targeted role removal. Cleanup must revoke only these proposed roles' grants and drop only these roles after confirming they own no objects and have no sessions; do not use broad `DROP OWNED` or alter PUBLIC privileges.

## Google development OAuth procedure (future, separately approved)

1. Use a Google OAuth client dedicated to development. Do not alter an existing production client or add production origins to the development client.
2. If local `BETTER_AUTH_URL` is `http://localhost:3000`, register the exact redirect URI `http://localhost:3000/api/auth/callback/google`. For an HTTPS development host, register `https://<approved-dev-host>/api/auth/callback/google`. Scheme, host, port, path, and trailing slash must match exactly.
3. Configure only the development consent-screen audience/test users and request only the identity scopes required for sign-in. Do not add Google JavaScript, One Tap, analytics, or tracking scripts.
4. Store `BETTER_AUTH_GOOGLE_CLIENT_ID` and `BETTER_AUTH_GOOGLE_CLIENT_SECRET` only in an approved ignored local credential store. Never place values in command arguments, logs, docs, or tracked files. Keep `BETTER_AUTH_URL` set to the same origin used in the callback registration.
5. Before enabling a local process, run offline target/config validation; attest Neon mapping in Console; verify runtime-role effective permissions; and approve one OAuth/database write test. Test authorization URL generation, state/PKCE behavior as provided by the library, exact callback delivery, verified-email claim, user/account/profile rows, and zero role/capability rows. Do not log OAuth codes, tokens, provider payloads, emails, or full rows.
6. Log out and sign in again; confirm a session is created/refreshed and revoked on sign-out. Confirm a new account cannot read private journal content or private media.

The expected callback route is implemented at `/api/auth/[...all]` and Better Auth uses `/api/auth/callback/google`. No provider console values or state were verified in this phase.

## Apple web OAuth hostname requirements

Apple web OAuth remains blocked until an approved HTTPS development hostname is selected and controlled. `http://localhost:3000/api/auth/callback/apple` is not a valid Apple web callback setup. After separate approval, configure the domain/HTTPS certificate, Sign in with Apple capability on a primary App ID, associated Services ID, verified website domain, and exact Return URL `https://<approved-dev-host>/api/auth/callback/apple`. Use the Services ID as the Better Auth client ID. Generate a development-only ES256 client-secret JWT using Apple's key workflow, keep the `.p8` key outside this repo, and manage expiry/rotation securely. Do not add production domains or return URLs to the development configuration. Confirm the provider's current requirements in official Apple documentation before changing its console; no console was accessed.

## Private S3 configuration and cache review

The private media route sends `Cache-Control: private, no-store, max-age=0`, `CDN-Cache-Control: no-store`, cookie/auth `Vary`, `nosniff`, same-origin resource policy, a sandbox CSP, and no-referrer. Uploads set object `Cache-Control: private, no-store, max-age=0` and do not set a public ACL. Reads use the authorization-checked application route, not signed permanent public URLs. Revocation and unpublishing are checked on subsequent requests. No CloudFront behavior, S3 policy, bucket name, or AWS identity was inspected.

Before approving a private development upload, independently verify:

- A bucket distinct from the public portfolio bucket; Block Public Access enabled at account and bucket scope where compatible; Object Ownership `Bucket owner enforced`; no public ACL, bucket policy, access point, website endpoint, or alternate public origin.
- Encryption at rest enabled. SSE-S3 is the simpler initial configuration; if SSE-KMS is chosen, separately scope and test the KMS key policy and `kms:GenerateDataKey`/`kms:Decrypt` requirements for the application identity.
- TLS-only bucket policy, appropriate versioning/recovery decision, and lifecycle rules that do not archive active journal objects. No CloudFront distribution or cached public path may serve the private bucket/prefix. CloudFront must not cache the authorized proxy response.
- App identity limited to `s3:PutObject` and `s3:GetObject` on the exact private prefix; no `ListBucket`, `DeleteObject`, ACL, policy, or bucket administration. A cleanup/delete action requires separately approved operator rights. If the bucket enforces encryption headers, confirm the upload route supplies a compatible header before testing; currently it relies on bucket default encryption.
- Direct anonymous object request returns AccessDenied; authorized application route streams the bytes with private/no-store headers; anonymous, ordinary, blocked, revoked, draft, archived, deleted, and unpublished cases return no content. Inspect cache behavior through the exact local path and any proxy/CDN in use.

Legacy public S3 objects stay untouched and may remain accessible by their historical direct URLs. Hiding them from a private post does not revoke those URLs. Do not migrate or delete them during a synthetic integration test.

## Minimal separately approved live-test sequence and rollback

Each numbered write/test requires its own explicit approval. Keep the local Clerk/Supabase default unchanged except for an isolated, temporary process configured against development.

| Order | Test and expected outcome | Stop/rollback plan |
| --- | --- | --- |
| 0 | **Target/role preflight:** separately approve role DDL, Console-attest project/branch/parent/endpoint/region/database/version, then approve read-only role verification. Confirm no unexpected membership/effective grants and assess cross-database CONNECT. | Stop on mismatch or broader permission. If creation failed, the transaction should roll back; if any role committed, do not auto-repair. Removal needs separate approval and targeted verification. |
| 1 | **Google auth first:** separately approve development OAuth client configuration and local ignored values, then approve one synthetic Google sign-in. Expect verified Better Auth user, provider account, public enabled profile, session, zero roles/capabilities, and no private content. | Before DB write: stop local process and remove only temporary local feature selection by operator. After any row write: stop, record sanitized aggregate status, keep state for read-only diagnosis; delete/revoke account only through a separately approved, targeted cleanup. Revoke test OAuth grant/client only with separate provider-console approval. |
| 2 | **Session regression:** repeat Google sign-in; verify refresh/update; sign out and confirm session invalidation; retry protected route. | Stop process on cookie/session mismatch. Do not directly edit auth rows. Any session/account cleanup needs separate approval. |
| 3 | **First owner:** after confirming selected verified identity outside the app, separately approve and run the one-shot bootstrap. Expect one owner row and audit event. | If preflight fails, do not retry. If transaction commits but verification fails, stop and inspect read-only. Any owner revocation/recovery is a separate approved transaction; retain audit history. |
| 4 | **Audience grant/revoke:** create a second synthetic Google account with separate approval; owner grants private read; verify access; revoke; verify the next request fails with the same session. | Revoke via the owner UI if healthy. If inconsistent, stop and use read-only diagnosis; direct SQL cleanup requires approval. Audit events remain. |
| 5 | **Private media:** after bucket/IAM verification and separate upload approval, upload one synthetic image; verify direct S3 denial, authorized route access/no-store headers, and subsequent denial after revoke/unpublish. | Do not auto-delete the object or metadata on partial failure. Retain it for diagnosis; cleanup needs separate object-delete/database-write approval. No broad runtime delete grant. |
| 6 | **Apple later:** only after HTTPS hostname and Apple Services ID/callback setup are approved; repeat the Google checks for one synthetic account. | Disable temporary local provider configuration through the operator's credential manager; revoke Apple consent/client credentials only after separate approval. Do not rotate or expose `.p8` keys in the repo. |

For every failure, stop the sequence, suppress provider/DB payloads, perform only the already approved read-only verification, and request separate approval before any cleanup or retry. Do not delete the Neon branch containing the verified legacy staging import.

## Offline checks and remaining blockers

Offline validation passed for this review: `pnpm test:phase3e` (47 TypeScript tests and 17 Python tests), `pnpm test:security` (224), `pnpm test:integration` (60), `pnpm exec tsc --noEmit`, focused ESLint, runner syntax check, and `git diff --check`. Review SQL was validated by static contract tests only; no SQL parser/server execution was performed. No live Better Auth adapter permission test or OAuth callback ran.

Remaining blockers: role/ACL review including `PUBLIC` database CONNECT; private-content RLS/application-credential risk; capability writes available to shared runtime identity; no approved Apple HTTPS hostname; no verified private development bucket or IAM policy; OAuth provider configuration not checked; no live Better Auth adapter permission test. Nothing here authorizes external changes or cutover.
