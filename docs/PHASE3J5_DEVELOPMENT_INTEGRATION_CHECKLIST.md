# Phase 3J.5 — Development Integration Readiness

Status: offline preparation only. No environment file, Neon, AWS, Apple, or Google console was accessed. Better Auth remains inactive; no user, object, or database row was created.

## Findings and blockers

1. **Apple development requires an HTTPS host.** The Better Auth callback is exact, but Apple does not accept `http://localhost`. No approved HTTPS development host is identified in this repository, so Apple console setup cannot be completed until one is chosen and verified.
2. **Runtime target guard is now implemented locally.** `getDatabase()` validates the exact development project, branch, endpoint, database, TLS mode, hostname, and expected restricted role before returning or reusing its pool. This is a local configuration guard, not proof of Neon branch identity; an operator must still attest the Console mapping immediately before any approved connection. Better Auth is deliberately fail-closed to the approved development target until a separately reviewed production-target design exists.
3. **No least-privilege Better Auth runtime role is established.** The migration runner is designed for the owner role. The created `drckgomz_inspector` is read-only/catalog-oriented and cannot serve Better Auth writes. Prepare and separately approve a runtime role with only the DML it needs; keep migrations on a distinct operator role. Do not use the owner role as the app runtime identity.
4. **Private S3 provider configuration is unverified.** Phase 3J.4 requires a separate private journal bucket. No bucket name, policy, CDN behavior, or local AWS identity has been verified. Until this is prepared, blog image upload should fail closed. Legacy public object URLs remain independently accessible even when hidden from private-post pages.
5. **Owner bootstrap has no dedicated operator runner.** `bootstrapFirstOwner()` is server-side and not an HTTP endpoint, but it accepts a caller-supplied `separatelyApproved` boolean and evidence string. Before using it, prepare an exact-target, one-shot operator procedure that independently confirms the selected verified identity and reports no secret/user data. The bootstrap approval must be separate from OAuth registration approval.
6. **This is not a full Clerk/Supabase cutover.** Better Auth viewer/session and Drizzle blog/project readers coexist with existing Supabase-backed CMS and other site data. Keep the legacy provider active on the existing site until parity is proven. A separate local test process may select Better Auth without changing production or shared configuration.

One offline code correction was made during this readiness pass: when Apple is configured, Better Auth now trusts the exact `https://appleid.apple.com` origin needed by its web `form_post` callback. Google-only configuration still trusts only the application origin. An adapter contract test covers this narrow allowlist.

## Ordered development checklist

### A. Lock down and attest the development target

1. In Neon Console, freshly verify project ID `jolly-poetry-87664309`, branch ID `br-nameless-dust-bewpmr4r`, endpoint ID `ep-sparkling-sun-bedq0ozn`, and database `neondb`. Confirm the branch's parent is the known production branch `br-polished-shape-be2nmkl4`, while the selected connection endpoint is the development endpoint. Production is off-limits.
2. Treat the branch as already containing the three reviewed Drizzle migrations and the 25 Phase 3I legacy staging rows. Do not expect empty staging. Check the three expected migration hashes and confirm the application/auth tables are at the expected pre-registration state through a separately approved read-only preflight; do not query personal records.
3. Do not treat a Neon connection string or environment target labels as proof of branch identity. The application checks exact local target values, while the operator must attest the branch-to-endpoint mapping in Neon Console immediately before the separately approved operation.
4. Prepare a non-owner runtime role separately from the migration role using the permission matrix in [Phase 3J.5A hardening](PHASE3J5A_DEVELOPMENT_INTEGRATION_HARDENING.md). The existing inspector role is not suitable for runtime writes. Role DDL/grants require separate approval.

### B. Prepare isolated local configuration without activating it

5. Use only Git-ignored local files. Do not overwrite `.env.local` or read values into shell output. The required variable names are:

   - Database/provider selection: `DATABASE_URL`, `AUTH_PROVIDER`, `BLOG_READ_BACKEND`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`.
   - Google: `BETTER_AUTH_GOOGLE_CLIENT_ID`, `BETTER_AUTH_GOOGLE_CLIENT_SECRET`.
   - Apple: `BETTER_AUTH_APPLE_CLIENT_ID`, `BETTER_AUTH_APPLE_CLIENT_SECRET`.
   - Private journal storage: `S3_PRIVATE_JOURNAL_BUCKET`, `S3_PRIVATE_JOURNAL_PREFIX`, `AWS_REGION`; AWS credentials must come from the approved local provider chain, not a tracked file.

   `BETTER_AUTH_SECRET` must be at least 32 characters. Provider values must be complete pairs. `BETTER_AUTH_URL` is an origin only, without a path. Keep the Better Auth secret stable for encrypted OAuth token storage.

6. The application requires Node `>=22.12`, which supports `--env-file`. A future local launch can load the explicit Neon development file plus a second ignored Better Auth file without printing values:

   ```sh
   node --env-file=.env.neon.development.local --env-file=.env.better-auth.development.local node_modules/next/dist/bin/next dev
   ```

   Prepare both files only after approvals. The second file should contain only local Better Auth/storage settings and the approved runtime DB URL/role choice; do not copy secrets into a command or tracked template. This command is a preparation reference only and was not run.

7. Keep `AUTH_PROVIDER` at the existing Clerk path until the approved local test window. To test Better Auth blog reads locally, `BLOG_READ_BACKEND=drizzle` is also required. The imported legacy content remains in `legacy.*`; it is not automatically public application content. Use only synthetic application rows for lifecycle/media tests. Do not set project readers to Drizzle unless those development fixtures are intentionally prepared.

### C. Configure provider consoles after separate authorization

8. **Google web OAuth client**: register the exact Authorized redirect URI `http://localhost:3000/api/auth/callback/google` for a localhost-only Google test when `BETTER_AUTH_URL=http://localhost:3000`. Google requires exact scheme, host, port, path, and trailing-slash match. For an approved HTTPS development origin, use `https://<approved-dev-host>/api/auth/callback/google`. Use a Web application client, configure its consent screen and test users as required, and do not add production origins/redirects to a development-only client. This application uses Better Auth's server redirect flow; do not introduce Google JavaScript/One Tap origins or scripts as part of this setup.
9. **Apple web OAuth**: first select an approved HTTPS development hostname; `http://localhost:3000/api/auth/callback/apple` will not work for Apple web sign-in. Register/verify that hostname with Apple. Enable Sign in with Apple on a primary App ID, create a Services ID associated with it, and configure the Services ID Website URLs/domain plus the exact Return URL `https://<approved-dev-host>/api/auth/callback/apple`. The Services ID is the client ID. Apple client secret must be an ES256-signed JWT for that Services ID, signed with the Apple private key; Apple rejects a JWT expiry beyond 15,777,000 seconds (six months). Store only the resulting development client secret in the ignored local credential mechanism, never the `.p8` private key in the repository. Plan to rotate the JWT before expiry.
10. The current UI redirect after OAuth defaults to `/blog`; this is separate from the provider callback URL. The app requires verified email for both providers and disables implicit/account linking. Apple can supply a private relay email; preserve the first verified identity and do not assume matching Apple/Google email addresses will link. Verify email claims and return/callback flow during the approved provider test.

### D. Verify private storage before media testing

11. Provision a dedicated private development journal bucket only through a separately approved AWS change. Verify the bucket is distinct from the public portfolio bucket, Block Public Access is enabled, no public bucket policy/ACL/website hosting exists, encryption is enabled, and no CloudFront behavior or alternate origin directly serves the private prefix.
12. Confirm runtime identity policy is limited to `s3:GetObject` and `s3:PutObject` on the private prefix. No public-read ACL, `s3:ListBucket`, delete, bucket-policy, or bucket-management permission is needed by the current routes. Confirm lifecycle settings will not archive active journal objects. Do not use a live AWS identity until its target and policy are verified and approved.
13. Configure only `S3_PRIVATE_JOURNAL_BUCKET`, `S3_PRIVATE_JOURNAL_PREFIX` (default `journal-private`), and `AWS_REGION` in the ignored development config. New blog uploads fail closed if the private bucket is absent or matches `S3_BUCKET`.

### E. Test in isolated stages, each behind approval

14. **Read-only preflight approval**: attest Neon project/branch/endpoint/database again; check migration hashes, role identity/permissions, expected legacy staging aggregate counts (25 imported, 3 bug reports excluded), and no unplanned auth/application rows. No user/content data should be printed.
15. **OAuth registration write approval**: enable Better Auth only in the local process. Register one synthetic Google user and, after the HTTPS Apple hostname exists, one synthetic Apple user. Expected: one verified `auth.user`, one provider `auth.account`, one enabled public profile per registration; zero role and capability grants. Verify unverified-email callback rejection, callback errors, duplicate sign-in, disabled email/password sign-up, and no implicit same-email linking.
16. **Session check**: test sign-in, cookie attributes (`HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS), session persistence, sign-out/session invalidation, expiry behavior, and return path `/blog`. Better Auth cookie cache is disabled; authorization must re-read profile/roles/capabilities.
17. **First-owner write approval**: only after an operator has independently verified the intended identity ID/email and the development target, run the future reviewed one-shot bootstrap procedure. Expected: exactly one `owner` role, an `initial_owner_bootstrapped` audit event, and the partial unique owner constraint remains active. Ordinary accounts remain roleless. Do not use imported legacy admin flags.
18. **Private-audience write approval**: owner lists users; non-owner/anonymous requests get 404/403; grant `private_blog.read` to one active, verified synthetic user; verify private post/API/media reads. Revoke, keep the same signed-in session, and verify the next request is denied. Block/disable that user and verify denial. Audit rows should record grant/revoke.
19. **Synthetic post/media write approvals**: create a private synthetic Drizzle post/media row and upload one synthetic image to the private bucket only after separate approvals. Verify a direct bucket URL is denied, malformed/enumerated IDs reveal no media, authorized proxy response has `private, no-store` and `CDN-Cache-Control: no-store`, and no private object key becomes a public S3 URL. Unpublish, retry the same proxy URL, and expect 404. Publish public only in the disposable test data; anonymous proxy reads then work while the post is public.
20. **Compatibility check**: verify public portfolio projects still use their existing path, the current Clerk/Supabase path is unchanged in the normal local launch, and Better Auth test routes/pages do not expose the staged legacy records. Do not migrate historical media or expose a legacy object.

## Expected results and rollback

- OAuth registration creates public-only users; no automatic admin, owner, or private capability.
- Existing login session does not preserve revoked access. Private proxy URLs are application routes, never permanent object URLs, and are not shared-cacheable.
- Incomplete provider pairs and missing Better Auth/database config fail closed. Apple local OAuth cannot proceed until an HTTPS host is approved.
- If local UI/auth checks fail before writes, stop the process and remove only the temporary local feature-flag/provider configuration; the normal Clerk launch remains the default.
- If any database write has begun, do not retry or manually delete partial data. Capture sanitized counts/status, stop, and use a separately approved disposable Neon development child branch/restore plan. Do not discard the branch containing the verified Phase 3I staging import without explicit approval.
- If storage testing has begun, stop and retain the private object and metadata state for diagnosis. Cleanup or bucket changes need separate approval; never attempt deletion through a broad runtime role.

## Separate approval boundaries

Separate explicit approval is required for: creating/granting a runtime database role; any live Neon connection beyond an approved read-only check; OAuth account registration/session writes; first-owner bootstrap; audience grant/revoke; synthetic post/media row writes; any S3 bucket/policy/IAM operation; object upload/removal; and any switch of shared or production `AUTH_PROVIDER`/backend flags. This checklist authorizes none of them.

## Local findings and validation

- Better Auth core tables are explicitly mapped to the existing `auth` Drizzle schema; registration hook creates an enabled profile with no role/capability. Email/password sign-up is disabled; sessions expire after seven days with cookie cache off; OAuth account linking is disabled and OAuth tokens are encrypted with `BETTER_AUTH_SECRET`.
- Current Better Auth API route is `/api/auth/[...all]`, with provider callback paths `/api/auth/callback/google` and `/api/auth/callback/apple`.
- Development-target facts used above: project `jolly-poetry-87664309`, branch `br-nameless-dust-bewpmr4r`, endpoint `ep-sparkling-sun-bedq0ozn`, database `neondb`; production branch `br-polished-shape-be2nmkl4` is excluded.
- Offline checks passed: `pnpm test:phase3e` (20 TypeScript and 17 Python tests), `pnpm exec tsc --noEmit`, focused ESLint, and `git diff --check`. Git ignore rules were checked by pathname only for both development env-file names; no environment file was opened. No live service or browser test was run.

Phase 3J.5A supersedes the earlier validation counts above for the runtime target guard and migration endpoint comparison. See [Phase 3J.5A hardening](PHASE3J5A_DEVELOPMENT_INTEGRATION_HARDENING.md) for the current command results and remaining approval gates.

Phase 3J.5B's permission audit, review-only SQL, OAuth callback plan, S3 checks, approval sequence, and rollback checklist are in [PHASE3J5B_READINESS.md](PHASE3J5B_READINESS.md). No SQL or external configuration was applied.

## Public provider references

- [Better Auth Google provider](https://better-auth.com/docs/authentication/google) documents its callback path and exact redirect registration.
- [Google OAuth web-server documentation](https://developers.google.com/identity/protocols/oauth2/web-server) requires the redirect URI to exactly match the registered URI.
- [Better Auth Apple provider](https://better-auth.com/docs/authentication/apple) documents its callback path, Services ID, HTTPS development limitation, and client-secret JWT.
- [Apple Sign in with Apple web configuration](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web) documents the Services ID, associated primary App ID, domains, and return URLs.
- [Apple client-secret documentation](https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret) sets the six-month maximum expiry.
