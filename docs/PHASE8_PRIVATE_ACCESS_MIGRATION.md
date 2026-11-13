# Private Access local migration candidate

Prepared 2026-11-13. **Not applied. Not runtime-certified.** The existing six Drizzle migrations/journal/manifest remain unchanged.

## Root cause

The local Phase 6 runtime installed viewer/profile/post functions, but did not install `list_private_audience_users(text,integer,integer)` or `set_private_journal_access(text,text,boolean)`. The application store already calls those exact signatures. They exist in the reviewed remote privilege-isolation SQL, whose role names and prerequisites do not match the isolated local runtime. Running that entire remote script locally would be incorrect.

## Prepared files

- `scripts/phase8/local-private-audience.prepared.sql`: additive local-only candidate adapted from the reviewed function definitions. Creates a separate `phase8_assert_active_owner` proof helper and the two audience functions. Does not replace the current viewer/read policies or touch owner assignments, posts, media, or historical mappings.
- `scripts/phase8/preflight-private-audience.mjs`: read-only preflight, with no apply mode. Does not read environment files or arbitrary database URLs. Prints only sanitized state, never identity credentials or session values.

Preflight passed against `127.0.0.1:55441/drckgomz_phase5_test` as `phase5_local`, PostgreSQL 18: exact six migration hashes, expected login/nonlogin roles, no unexpected RLS on the function data tables, expected owner helper and unique-owner index, exactly one owner and three private drafts, and all candidate function signatures absent.

## Candidate safety properties

- SQL also pins database/role/address/port/major and exact migration hashes inside its transaction. Unexpected existing function state or role/RLS state aborts. It has statement/lock timeouts and does not use `CREATE OR REPLACE`.
- Session proof resolves the verified, active, unbanned owner from an expiring session digest; caller-supplied user IDs do not determine the actor.
- Mutation serializes via the reviewed advisory lock, locks and rechecks the actor and target, disallows self changes, rejects grants to blocked/unverified accounts, and atomically writes audit events when a capability changes.
- Functions use fixed `pg_catalog` search paths and qualified relation names. PUBLIC execute is revoked. The runtime role gets EXECUTE only; no direct role/capability/audit table privileges.
- Narrow table privileges go to the existing NOLOGIN function owner. UPDATE on timestamp columns is needed for PostgreSQL row locks; role assignment fields are not granted. Existing schema privileges are preserved except temporary CREATE needed for function ownership, which is revoked at the end.
- No RLS is disabled. No password, session token, provider key or storage URL is returned.

## Still required before applying

1. Repeat the read-only preflight and compare schema/function ownership and candidate SQL to the current local state.
2. Review the candidate privilege changes and concurrency semantics. The existing `transfer_owner_from_legacy` routine is never called by this work; review its lock compatibility rather than invoking it.
3. Establish the approved owner Playwright fixture and disposable nonowner test identities through normal local authentication, without changing the recovered owner.
4. Apply only in the approved isolated local database, then test anonymous/ordinary/banned/disabled/unverified denial, self-change denial, idempotent grant/revoke and audit events, rollback-on-audit-failure, concurrent actor revocation, expired-session denial, single-owner preservation, and unchanged original post/media fingerprints.
5. Record the local patch separately; do not append fabricated entries to the six-migration Drizzle ledger. Prepare a separately reviewed reproducible migration plan before any future remote use.

The preflight is not proof that the SQL functions execute correctly. No application of this candidate or claim of working Private Access management is made in this session.
