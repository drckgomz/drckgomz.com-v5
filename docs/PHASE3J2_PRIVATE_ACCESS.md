# Phase 3J.2 — Owner-Controlled Private Journal Access

## Implemented offline

- Added a Better Auth-only owner dashboard at `/admin/private-access` and owner navigation link.
- Added `GET` and `PATCH /api/admin/private-audience`; these routes return 404 unless `AUTH_PROVIDER=better-auth`.
- The list is paginated and projects only account email/name/username, profile state, verified-email state, owner/admin status, private access, and join date. Passwords, provider tokens, sessions, and other auth data are never selected.
- Grant/revoke uses the existing `app.user_capabilities` row with capability `private_blog.read`, `granted_by` set to the owner, and an event in `app.security_audit_events`.
- No role, owner, or account record is changed. The partial unique owner index remains the database-level singleton safeguard.
- Every list or mutation transaction locks and rechecks the actor profile and owner role. Mutations also lock and recheck the target profile and auth identity. Grants require a provisioned, enabled, unbanned, email-verified account. Revocations remain allowed for blocked accounts.
- Owner self-changes are rejected. Role assignment fields and unknown request fields are rejected. The mutation endpoint rejects cross-origin writes and uses private, no-store responses.
- Existing Clerk/Supabase user-management routes are unchanged. The new Better Auth endpoint is separate and disabled unless Better Auth is the configured provider.

## Revocation behavior

Better Auth cookie session caching remains disabled. The existing viewer resolves `app.user_capabilities` from the database for each request; deleting the capability therefore affects later private-content authorization checks without requiring the user to sign out. A request already authorized and in progress before the transaction commits may complete under its earlier decision.

## Offline coverage and limits

The mock-backed API tests cover anonymous and non-owner denials, inactive/banned owners, blocked and unverified targets, self-change attempts, unsupported role fields, cross-origin writes, pagination, and idempotent grant/revoke behavior. These tests exercise the HTTP handler contract and the shared policy with synthetic repositories. The Drizzle transaction implementation is type-checked but not executed against a database in this phase.

Before enabling this in development, verify the existing Phase 3H schema and ledger, then exercise actual Better Auth sessions, owner locking, audit writes, list pagination, grant/revoke, and subsequent private blog reads on the approved development branch. No migration is expected because all required tables, fields, constraints, and indexes already exist.
