# Phase 3J.1 — Offline Better Auth Foundation

## Scope

This slice prepares Better Auth for open Apple and Google social registration while keeping all database operations offline. It does not connect to Neon, generate or apply a migration, switch the active production identity provider, or create accounts.

## Registration and access behavior

- The Better Auth sign-up page offers only social providers with a complete local client ID and client secret pair. Apple and Google are configured independently; a partially configured pair makes Better Auth configuration invalid.
- The same providers appear on Better Auth sign-in. Existing email/password sign-in remains available, but `disableSignUp` stays enabled for email/password.
- Both social provider configurations require verified provider email before a session is issued. This depends on the provider returning a verified-email claim and must be checked in development callback tests.
- New social identities receive an `app.user_profiles` row with a generated `member-<auth-id>` username and an enabled public-reader profile. The registration hook adds no `app.user_roles` or `app.user_capabilities` records.
- Private journal access reuses the existing owner-granted `private_blog.read` capability. It is the current single private-reader audience. Anonymous users, new users, disabled users, and banned users cannot read private posts. An owner-approved reader can; removing the capability revokes that access on subsequent authorization checks.
- The database partial unique index still permits at most one owner assignment. Public self-registration does not grant owner or administrator status. The separately approved first-owner bootstrap remains independent.
- Better Auth account linking is disabled, including implicit linking. Users who authenticate with Apple and Google using the same email will not be silently merged. A future, authenticated account-linking and recovery flow needs its own security review.
- Passkeys are intentionally not configured in this phase.

## Schema and migration impact

No new tables or schema changes are required for this foundation. It reuses the migrated `auth.user`, `app.user_profiles`, `app.user_roles`, and `app.user_capabilities` tables. The singleton owner constraint and current capability constraint remain unchanged. Consequently, there is no Phase 3J.1 Drizzle migration to apply.

The profile hook is an application behavior change and must be validated against the approved development branch before enabling Better Auth there. It uses `ON CONFLICT DO NOTHING` so a profile already present for that auth identity is not overwritten. A conflicting username would leave that new identity without a profile and therefore without app access; monitor and resolve such registration failures through a separately approved administrative process.

## Provider configuration required before enabling Better Auth

Set `AUTH_PROVIDER=better-auth`, existing `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` only in the intended local/development environment. Configure complete pairs as needed:

```text
BETTER_AUTH_GOOGLE_CLIENT_ID=
BETTER_AUTH_GOOGLE_CLIENT_SECRET=
BETTER_AUTH_APPLE_CLIENT_ID=
BETTER_AUTH_APPLE_CLIENT_SECRET=
```

Keep secret values in a Git-ignored environment file or the eventual hosting secret manager. Do not place values in source, logs, command arguments, screenshots, or tracked documentation. The sign-up page advertises only fully configured provider pairs.

Register the exact callback URLs with each identity provider:

- Google: `${BETTER_AUTH_URL}/api/auth/callback/google`
- Apple: `${BETTER_AUTH_URL}/api/auth/callback/apple`

Use the Better Auth URL configured for that environment, and verify provider-specific requirements in the provider consoles before setup. Apple typically requires a Services ID and a signed client-secret JWT; manage its signing key using the provider's secure credential process. No provider credentials were inspected or configured as part of this work.

## Cutover gates

Before setting `AUTH_PROVIDER=better-auth` on any shared environment:

1. Configure both provider pairs in a separate approved development environment and validate callback URLs.
2. Apply no schema migration for this slice; first verify the existing development migration ledger and schema are still at the approved Phase 3H state.
3. Exercise first social registration and verify exactly one enabled profile is created with no role or capability rows.
4. Verify both OAuth providers, email/password sign-in behavior, sign-out, session expiry, and disabled/banned account behavior.
5. Exercise anonymous, public-only, private-audience, administrator, and owner access using real requests against synthetic development data.
6. Verify provider identities cannot implicitly link based on matching email.
7. Test an owner grant and revocation of `private_blog.read`, audit logging for those operations, and the existing single-owner constraint.
8. Keep Clerk and the existing Supabase implementation available until route/UI and authorization parity passes the separately approved integration plan.

The current user-management API is still part of the Clerk/Supabase implementation. This slice does not add a Better Auth owner-facing capability-management endpoint or UI. Until a separately tested Drizzle-backed owner workflow exists, do not treat the existing management screen as the authority for granting private-audience access after an auth cutover. New users remain public-only by default.

## Offline checks

The Phase 3E auth-boundary suite now includes provider-pair validation, public-only registration defaults, explicit private-audience grants, and revocation/disabled-account behavior. These are deterministic policy/configuration tests; they do not verify OAuth provider callbacks or live database hook behavior.

For this work, `pnpm test:phase3e` passed (10 TypeScript tests and 17 Python tests), `pnpm test:security` passed (218 tests), `pnpm test:integration` passed (60 tests), `pnpm exec tsc --noEmit` passed, focused ESLint passed, and `git diff --check` passed. No browser suite, OAuth callback, database connection, or live hook execution was performed.
