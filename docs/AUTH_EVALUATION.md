# Authentication evaluation

Date: 2026-11-11. Recommendation: **prefer Better Auth for an isolated proof of concept**, pending approval and version-specific security/adapter testing. Keep Clerk in the working application until replacement parity and recovery are demonstrated. Neither candidate is installed or configured by this work.

## Application-specific requirements

This is a personal creative site with privileged authoring, invited/private readership, profile display preferences, banned/disabled users, and terminal content. Identity is currently Clerk; effective permissions live in Supabase `user_profiles`. Replacing login widgets alone would break that relationship. Preserve stable subject mapping, private access and restrictions; avoid importing existing inconsistent role rules as the desired policy.

No provider inspection established whether the current Clerk tenant actually enables passwords, GitHub, Google, or passkeys. Evaluate all as candidate requirements rather than assuming existing usage.

## Comparison

| Requirement | Better Auth | Auth.js | Consequence here |
| --- | --- | --- | --- |
| Email/password | Built-in authenticator, verification and reset hooks; application supplies email delivery | Credentials provider delegates validation; persistence, password hashing, signup, abuse controls and resets require application work | Better Auth reduces custom account lifecycle work [1][2] |
| GitHub/Google OAuth | Both documented providers; configure callback URLs and scopes | Both documented providers | Both viable; establish verified identity linking and new callback ownership separately [3][4][5] |
| Passkeys | Dedicated WebAuthn plugin and schema | Official WebAuthn documentation currently labels support experimental and unsuitable for production; adapter compatibility is constrained | Prefer Better Auth if passkeys are a launch requirement; prove registration, revocation, recovery and target browser behavior [6][7] |
| Sessions | Cookie/session storage with expiry, freshness and revocation; optional caches | JWT or database strategy; JWT immediate revocation needs additional state/short lifetime | Prefer database sessions and current application permission checks; test exact credentials/session combination in the chosen Auth.js version [8][9] |
| Account recovery | Password-reset and verification flow hooks provided; mail service and safe UX remain ours | Build password recovery around Credentials or choose email-link/OAuth recovery | Neither replaces a recovery policy or reliable mail operations [1][2] |
| Administrative roles | Admin plugin provides role/ban/session-management primitives and extensible access control | Roles via callbacks/session/database and application APIs | Better Auth closer to dashboard needs; owner and private readership remain domain permissions [10][11] |
| Next App Router | Route handler integration, server session APIs, cookie handling for server actions | Handler/auth exports and Next integration | Both need awaited request APIs and server authorization; proxy is an optimistic navigation check [12][5] |
| Drizzle/Postgres | Documented Drizzle adapter and plugin-driven schema generation | Database adapters include Drizzle | Validate pinned adapter/schema/transaction compatibility; do not copy snippets from differing versions [13][5] |
| Maintenance | Integrated lifecycle and plugin surface; we operate security updates, mail and auth DB | Flexible OAuth-first library; more application-owned lifecycle code | Evaluate actual supported release and maintenance trajectory at implementation; current Auth.js getting-started docs describe v5 beta+ [5] |

Better Auth is the better fit because password recovery, passkeys, and administrative lifecycle features are part of the requested evaluation. Auth.js remains reasonable if OAuth/email links dominate and we accept implementing the remaining lifecycle. Avoid choosing on generic popularity or unverified cost claims. Both are libraries with operational responsibility transferred from Clerk to the site owner.

## Proposed security and role policy — approval required

A single server authorization service should resolve identity → current profile → capability. Deny banned, disabled and missing-profile subjects before evaluating grants. Do not let a session payload or UI localStorage become the authority for mutable permissions.

| Capability | Visitor | Active member | Private reader | Content admin | Whitelist manager | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| Public projects/terminal | Yes | Yes | Yes | Yes | Yes | Yes |
| Public blog API | Yes | Yes | Yes | Yes | Yes | Yes |
| Public blog page | Decision: currently session/profile required for all pages |
| Private posts/media | No | No | Yes | Yes | Only with explicit private grant | Yes |
| Draft/archived previews | No | No | No | Yes | No | Yes |
| Edit posts/projects/home/commands | No | No | No | Yes | No | Yes |
| Grant private access | No | No | No | No by default | Yes | Yes |
| Assign admin/owner, manage owner recovery | No | No | No | No | No | Yes |

This is intentionally **proposed**, not a description of current behavior. Current page guard grants whitelist admins broad page entry while APIs demand role admin, and any accepted admin can PATCH owner flags. Preserve all legacy values in a migration ledger; resolve contradictions with owner review before activation, defaulting to no additional grants. Never infer ownership from email, signup order, OAuth profile data, or role strings supplied by a client. Protect the last active owner and deny self-service escalation. If using Better Auth's admin plugin, disable unneeded impersonation and map bans/roles deliberately so two inconsistent authorities do not emerge.

For sessions: secure HttpOnly cookies in production, appropriate SameSite/trusted-origin settings, framework CSRF/OAuth state protections, explicit expiry/rotation, server checks on every protected operation, and reauthentication for owner changes, password/email changes, passkey enrollment/removal and destructive actions. Revoke sessions on ban, disable, password recovery and security-sensitive role changes; test optional cookie-cache staleness. A client inactivity timer is UX, not a server expiry policy. Add shared server-side auth rate limits rather than per-browser memory counters. Never log tokens, recovery links or password inputs.

For recovery: verified email delivery with expiring single-use tokens, non-enumerating responses, throttling, session invalidation, and a tested lost-passkey path. Recommend two owner passkeys plus a separate documented owner recovery method, with bootstrap controlled outside public signup. Email address changes require verification and should not silently relink identities. Custom UI must retain keyboard access, autocomplete/password-manager support and accessible errors.

## Existing account transition

1. Later, with explicit export authorization, inventory Clerk subjects, verified email addresses, OAuth provider subjects, bans and auth factors; independently inventory application profiles. No export occurs in this phase.
2. Keep content/profile IDs stable initially. Add a unique identity mapping from legacy Clerk subject to new auth subject; retain the legacy ID for reconciliation. Resolve missing, duplicate and conflicting records manually. Do not conflate auth user rows with application profiles.
3. **Do not assume Clerk passwords/hashes are exportable or compatible.** Default to an enrollment/reset flow after verifying ownership of an existing verified email, or a narrowly scoped bridge that validates a current Clerk session server-side. Any bridge must be designed/reviewed separately and expiring; no bearer token accepted without verification.
4. OAuth users authenticate again; map by verified provider subject and approved account-linking rules. Do not bulk-link by matching email alone. Do not assume Clerk OAuth tokens or consents transfer.
5. Existing passkeys/MFA and Clerk sessions are not assumed portable. Require re-enrollment as applicable; test recovery first and communicate expected sign-in changes. Preserve bans/disabled flags even during enrollment and recovery.
6. Keep new registration separate from claiming a legacy profile; a new account must not inherit another user's private grants. Reconcile orphan profiles without deleting them.
7. Owner access and private-reader permissions must pass synthetic parity tests before a later cutover. Plan explicit session invalidation/relogin. Keep Clerk rollback available; credentials created only in the new system will need a defined rollback/recovery path.

## Clerk replacement checklist

Replace root provider and sign-in/up widgets; server `auth/currentUser`; middleware; profile ID lookups; all token-consuming hooks; avatar account management/signout; banned page signout; idle logout redirects; terminal auth callbacks; and post/user API clients. Add an explicit profile provisioning mechanism. Avoid recreating the legacy terminal password prompt or `blog_token` localStorage flow. The currently unimplemented `/api/terminal/login` should eventually become navigation to the standard sign-in experience.

## Required proof of concept before selection

In a local or separately authorized isolated environment with synthetic users: email signup/verification/reset, GitHub/Google linking conflicts, revoked sessions, passkey registration/authentication/lost-device recovery, disabled/banned/owner checks, CSRF/origin/redirect rejection, concurrency, and Next 16 server component/handler/cookie integration. Pin library/adapter/plugin versions, review advisories and generated SQL, and verify session strategy compatibility rather than assuming parity. No live provider setup, mail sends, or prototype implementation is included here.

## Official references

Reviewed during audit; recheck before implementation.

1. [Better Auth email/password](https://better-auth.com/docs/authentication/email-password)
2. [Auth.js Credentials](https://authjs.dev/getting-started/authentication/credentials)
3. [Better Auth GitHub](https://better-auth.com/docs/authentication/github)
4. [Better Auth Google](https://better-auth.com/docs/authentication/google)
5. [Auth.js getting started](https://authjs.dev/getting-started)
6. [Better Auth passkeys](https://better-auth.com/docs/plugins/passkey)
7. [Auth.js WebAuthn](https://authjs.dev/getting-started/authentication/webauthn)
8. [Better Auth sessions](https://better-auth.com/docs/concepts/session-management)
9. [Auth.js session strategies](https://authjs.dev/concepts/session-strategies)
10. [Better Auth admin](https://better-auth.com/docs/plugins/admin)
11. [Auth.js RBAC](https://authjs.dev/guides/role-based-access-control)
12. [Better Auth Next integration](https://better-auth.com/docs/integrations/next)
13. [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
