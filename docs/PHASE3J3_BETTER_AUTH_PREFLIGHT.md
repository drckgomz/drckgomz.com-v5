# Phase 3J.3 — Better Auth Development Integration Preflight

## Status

Offline review only. Better Auth is not enabled, no provider credentials or environment files were read or changed, and no database was contacted. The active Clerk/Supabase path remains intact.

## Drizzle and migration compatibility

`src/lib/auth/better-auth.ts` explicitly maps Better Auth's `user`, `session`, `account`, and `verification` models to `authUsers`, `authSessions`, `authAccounts`, and `authVerifications` with `schemaName: "auth"`. Offline schema-contract tests compare every Drizzle column in those four tables to migration `0000_petite_loki.sql`. Migration `0001_bitter_tiger_shark.sql` adds only the reviewed home-project deletion markers; `0002_many_kingpin.sql` adds the partial singleton-owner index and positive revision/version constraints. No Phase 3J.3 schema change or migration is needed.

The `account` table has the expected Better Auth OAuth token columns. Token-at-rest encryption is now enabled (`account.encryptOAuthTokens`) using the Better Auth secret. Keep that secret stable and backed up through the approved secret manager; rotating it without a token re-encryption/reauthentication plan can make stored provider tokens unusable. New development data has no historical Better Auth tokens, but the setting should be active before first OAuth sign-in.

## First-owner bootstrap

Social registration's `databaseHooks.user.create.after` creates the `app.user_profiles` row. Review found that the prior bootstrap tried to insert this same profile again, which would fail on the primary key. The bootstrap now locks and requires that existing profile to be enabled and unbanned, verifies the Better Auth identity's email, takes the existing advisory lock, confirms zero owner assignments, requires separate approval and audit evidence, and inserts only the owner role plus its audit event. It is not exposed as an HTTP endpoint, and ordinary registrations receive no roles or capabilities. The database partial unique index remains the final singleton-owner enforcement.

The bootstrap is an exported server-side function, not an executable migration or self-service API. A later development run must use a separately reviewed one-shot operator invocation with an explicit owner identity and approval evidence. Do not invoke it until the development branch has an approved schema, verified OAuth account, and separate approval for owner creation.

## Apple and Google OAuth

- Provider configuration requires complete pairs: `BETTER_AUTH_GOOGLE_CLIENT_ID` + `BETTER_AUTH_GOOGLE_CLIENT_SECRET`; and `BETTER_AUTH_APPLE_CLIENT_ID` + `BETTER_AUTH_APPLE_CLIENT_SECRET`. Each provider is independent. Partial or whitespace-only values fail configuration.
- Both provider configurations require verified email before a session is issued. Verify the provider callback actually supplies a verified-email claim; this cannot be established offline.
- `BETTER_AUTH_URL` must be an origin only (scheme and host, no path, query, fragment, username, or password). The Better Auth base path is `/api/auth`.
- Expected provider callback URLs are `BETTER_AUTH_URL + /api/auth/callback/google` and `BETTER_AUTH_URL + /api/auth/callback/apple`. Confirm the generated URL and provider-specific requirements with each provider's official console during separately approved setup. Apple normally uses a Services ID and signed client-secret JWT.
- Implicit account linking is disabled, and account linking is disabled entirely. Same-email Apple and Google identities will not merge; define a user recovery/linking process before either identity can be treated as interchangeable.
- The sign-in redirect accepts local paths only, rejects external/protocol-relative/backslash/control/malformed encoded targets, and defaults to `/blog`. Trusted origins contain the configured app origin; `https://appleid.apple.com` is added only when Apple is configured, for Apple's `form_post` callback.
- Email/password sign-in remains available for existing accounts, but email/password sign-up remains disabled. Social self-registration is not gated on owner status and receives only a public-reader profile.

## Private content and media

Better Auth viewer resolution reads the current profile, roles, and `private_blog.read` capability from Drizzle. Blog list/detail paths derive allowed states from that viewer before returning post attachments; database-backed post reads scope status and deletion state before loading related media. Admin APIs and the owner dashboard perform fresh server-side authorization; the private-access transaction locks and rechecks active owner state, locks the target profile and auth identity, writes/revokes the existing capability, and records audit events. Better Auth cookie-session caching is disabled, so a committed revocation is seen on later authorization reads.

This protects application API and server-rendered disclosure. It does not make a public S3 object private: a known direct URL can remain accessible after a post is unpublished or an audience grant is revoked. The reviewed [private-media plan](infrastructure/PRIVATE_MEDIA_MIGRATION_PLAN.md) remains a production blocker for confidential media. Do not treat this auth preflight as approval to change AWS or media delivery.

## Exact development-only setup sequence

1. Confirm in Neon Console the development branch ID, endpoint ID, and database name against the previously authorized development target. Confirm production is not selected. Do not rely on a branch label alone.
2. Use only the dedicated, Git-ignored development environment file for Better Auth testing. Keep its database URL pinned to the verified development endpoint; do not copy values into logs or this document. Preserve the current default provider/environment file.
3. Use a development-only Better Auth secret of at least 32 characters and configure provider credentials only after creating/approving provider apps for the development callback URL. Do not reuse production OAuth secrets.
4. Before `AUTH_PROVIDER=better-auth`, validate the three existing Drizzle migration hashes and expected auth/app schema state with the already approved read-only procedure. No migration is expected for this phase.
5. Obtain separate approval for the first development database write needed by OAuth registration. Run one Google signup and one Apple signup, then verify each creates one auth user, provider account, and active public profile with zero roles/capabilities. Verify unverified-email callback denial and duplicate/same-email provider behavior.
6. Obtain separate approval for the owner bootstrap write. Bootstrap only the verified, intended owner after confirming there is no owner role; verify one owner row and the audit event.
7. Obtain separate approval for owner-dashboard write tests. Verify non-owner/list denials, grant/revoke, blocked and unverified target handling, audit entries, and a private journal read before/after revocation. Never test by making production or legacy media public.
8. Exercise sign-in/out, session expiry, return URLs, both providers, no implicit linking, private media/API behavior, and legacy Clerk fallback on the isolated development environment. Keep Clerk/Supabase as the active path until parity and rollback are reviewed.

The first live database write is OAuth account registration, and it requires separate explicit approval. Owner bootstrap and private grant/revoke writes each require distinct approvals. No live operation was performed in this phase.

## Offline validation

The tests assert Better Auth Drizzle table/migration parity, adapter model mapping, OAuth configuration and verified-email requirements, hostile redirect rejection, public-only registration defaults, private audience authorization, and the first-owner profile reuse contract. They are synthetic/offline contracts, not provider or database integration evidence.

Current validation: `pnpm test:phase3e` passed (20 TypeScript tests and 17 Python tests); `pnpm test:security` passed (218 tests); `pnpm test:integration` passed (60 tests); `pnpm exec tsc --noEmit`, focused ESLint on the changed implementation, and `git diff --check` passed. Full `pnpm lint` remains red at 101 errors and 5 warnings across the existing repository; the focused changed-file lint passed. The production build was not run: process inventory returned sandbox `EPERM`, so I could not confirm no concurrent Next build is using `.next`; I left that state untouched.
