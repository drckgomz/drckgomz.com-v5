# Local owner account recovery preparation

Status: preparation only. No owner role, credentials, legacy account, or post was modified in this work.

## Read-only findings

The only database inspected was the pinned disposable PostgreSQL 18 database `drckgomz_phase5_test` on loopback. Every inspection ran in a read-only transaction and ended with `ROLLBACK`.

- The staged legacy backup contains two user records; one carries the legacy `is_admin` flag. Passwords and reset tokens were excluded from staging by design.
- The two staged legacy identities have zero matches against Better Auth users by normalized email and zero matches by legacy `user_id`.
- The local database contains one owner role assigned to a Better Auth user with a verified email and a password credential. The owner record is the synthetic Phase 6 bootstrap identity, not one of the staged legacy identities. Its local user ID suffix is `ad1200`; no email, password, or reset token is recorded here.
- The current owner can authenticate and administer the two recovered posts. Browser tests verified editing one post and restoring its original value.
- The two recovered application posts remain `draft` + `private`. Their content and two media relationships remain present. Media URLs remain unset/quarantined.
- Better Auth reset, verification, and password change work for an eligible local account through the local inbox. This does not establish that a legacy account was migrated.

The legacy `is_admin` flag is historical evidence only. It does not prove the intended current owner and must never grant an application role automatically.

## Safe enrollment and identity matching

1. Use the existing local `/sign-up` flow with the email address on the intended legacy account. Local Better Auth registration creates an ordinary account/profile only; it does not grant owner/admin roles or private-post access.
2. Complete verification through `/dev/mailbox`. Do not import the legacy password or reset token.
3. Before any role change, compare the verified Better Auth identity to the specific staged `legacy.users` row. Require exactly one email match and review any source `user_id` evidence. No match, multiple matches, or conflicting identifiers means stop. Keep the actual email and row details out of logs and reports.
4. Have the site owner confirm the exact source-row-to-Better-Auth-user mapping as a separate approval. Neither the legacy admin flag nor email verification alone is sufficient authorization to transfer ownership.

The existing synthetic owner remains usable throughout preparation. The original accounts and all staged data remain intact.

## Proposed owner-role transfer (not implemented or executed)

The current role schema already enforces at most one owner with `app_user_roles_single_owner_uq`. There is no owner-transfer database function in the applied local migrations. The reviewed Phase 3J.5D owner functions cover private-audience listing and capability changes, not owner-role transfer; the existing owner-runtime role must not receive direct table-write privileges as a shortcut.

After the exact mapping and SQL are separately approved, implement one narrow database function owned by the non-login `drckgomz_owner_admin` role and callable only by `drckgomz_owner_runtime`. It must:

- Use a fixed `pg_catalog` search path, fully qualified object names, no dynamic SQL, and explicit execution grants with PUBLIC revoked.
- Derive and validate the actor from the live Better Auth session token digest, current unexpired session row, verified email, active/unblocked profile, and current owner role. Caller-supplied owner flags or arbitrary session variables are not proof.
- Acquire a transaction-scoped advisory lock and lock the singleton owner row and target account/profile. Require the exact approved legacy mapping, one verified active target, a different actor/target, and no conflicting mapping.
- Update the existing owner-role row's `user_id` to the target inside the same transaction (rather than deleting an account or inserting a second owner), and insert an audit event recording the previous owner as actor, the target as subject, and an opaque reference to the reviewed mapping.
- Treat the role mutation and audit insert as atomic: audit failure aborts the transfer. The partial unique index remains a final invariant.
- Preserve the previous owner account, credential, profile, and all content. It simply ceases to hold the owner role after a successful transfer.

Do not implement a broader role-management endpoint. Test the function on a disposable database using two synthetic verified users, then verify function ACLs, owner uniqueness, exact audit event, and denied behavior for invalid/expired sessions, blocked users, wrong mappings, concurrent transfers, and ordinary members.

## Rollback

- Before commit, any failed precondition or SQL/audit error rolls back both the role-row update and audit insertion; no account is deleted.
- After commit, rollback is a new, separately approved compensating transaction. It must revalidate the target as current owner, reassign the same role row to the prior owner, and append a second audit event. Never erase the original audit event or silently retry.
- The existing owner account remains present, so a compensating transfer does not require restoring an account or password.

## Follow-up verification and unapplied procedure (2026-11-12)

Read-only checks against the pinned disposable PostgreSQL 18 target verified exactly one owner assignment (`…ad1200`), two staged legacy users, and two application posts. Both application posts remain `draft` + `private`. The active Safari session was visibly authenticated to the local site, but this UI-only check did not expose a Better Auth user ID to the database inspection; I did not use its personal email in SQL, logs, or this report.

A sanitized database comparison found one verified, enabled, unblocked Better Auth account (`…F3iJmY`) whose normalized email uniquely matches the staged legacy administrator row. No Better Auth user has a matching legacy `user_id`. This is a candidate mapping only: email correspondence and the historical `is_admin` flag do not prove that the signed-in account belongs to the requestor or establish identity ownership. The intended target therefore remains **unconfirmed** until the owner explicitly confirms the masked source/destination mapping and the evidence basis.

[`scripts/phase6/owner-role-transfer-review-only.sql`](../scripts/phase6/owner-role-transfer-review-only.sql) is a local-only, unapplied proposal. It adds no Drizzle migration and, if separately approved and installed, would add a fixed-search-path `SECURITY DEFINER` function owned by the NOLOGIN local function role. The local owner LOGIN role would receive function execution only. The function requires a live owner session, an active unblocked actor, a verified/enabled target, a unique match to an explicitly selected legacy row, and an explicit mapping confirmation. It intentionally never reads `legacy.users.is_admin`. Its single transaction updates the existing owner-role row and inserts `owner_role_transferred` audit evidence; either both commit or neither does. No function/grant was installed and no owner transfer was run.

The latest review fixed a permission defect in the proposal: it previously attempted to lock `auth.session` and `legacy.users` rows even though the function owner has no `UPDATE` privilege on those tables, which PostgreSQL requires for `SELECT ... FOR UPDATE/SHARE`. The function now relies on the existing database-owned `current_owner_id()` helper to validate the session digest, expiration, verified email, active/unblocked profile, and current owner role; it locks only auth-user/profile/owner rows for which the local function role has narrow column-update privileges. It reads the immutable legacy staging row without a row lock and rechecks uniqueness. The SQL remains unapplied; these function-body permissions and concurrent session-revocation behavior still require disposable PostgreSQL execution before use. The email match remains a consistency check, not sole proof of identity.

Offline regression tests in `tests/phase6/owner-role-transfer.test.mjs` check the review-only SQL security contract and synthetic success, denied mapping/session, unverified-target, and audit-failure rollback cases. These are contract/model tests, not PostgreSQL validation of the unapplied function. The real transfer, function installation, and target-account identity remain unverified and require separate approval.

## Approval gates still required

1. User completes local ordinary-account enrollment and verification; this is not an owner grant.
2. User confirms the exact private legacy-row-to-verified-account mapping after a unique match is available.
3. User reviews and separately approves the proposed owner-transfer function/migration and its local test results.
4. User separately approves execution of that function against the disposable local database.
5. Publishing either recovered post is a separate post-by-post decision. Both remain private drafts until reviewed.
