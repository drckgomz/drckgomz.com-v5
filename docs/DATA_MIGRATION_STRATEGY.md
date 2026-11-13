# Data migration strategy

Phase 2A, 2026-11-11. **Planning only. The backup is now readable and has been inspected as text; no SQL was executed and no data was imported.** The strategy is conditional and requires further evidence/approvals. No restore, account changes, provider calls, upload, deployment or application-code edit is part of this phase.

## Evidence and source of truth

The requested backup is a readable 201,030-byte plain-text PostgreSQL cluster dump. Headers report PostgreSQL 15.8 and pg_dump 15.13. The postgres section contains seven public application tables with 28 serialized rows; provider tables add 147 migration-history rows. See [LEGACY_DATABASE_AUDIT.md](LEGACY_DATABASE_AUDIT.md) for counts, columns and constraints. Environment/date authenticity and relation to current production remain unverified. Do not use this legacy snapshot to overwrite newer writing, media, user bans, owner grants or configuration.

Before any import design becomes executable, determine provenance and source authority separately for schema, content and identities. A historical dump may be useful as a **reference** or **recovery source** while remaining unsuitable as a full replacement. Keep old and current dataset identities distinct. Production comparison would require separate access approval; none was made here.

## Ordered phases and gates

| Phase | Authorized now? | Planned work | Exit evidence |
| --- | --- | --- | --- |
| A. Local forensic discovery | Completed locally, without execution | File/format, sanitized schema/counts and table classification inspected | 32 COPY blocks validated, 175 serialized rows, stable source fingerprint; no raw rows in repository |
| B. Mapping approval | Documentation only | Choose reusable fields, state/audience policy, identity strategy, target constraints and conflict rules | Owner decisions + per-table mapping; unresolved relations remain quarantined |
| C. Local implementation/rehearsal | No | Handwritten reviewed schema/repositories/importer; synthetic fixtures first; later separately approved isolated clean-target import | Count/key/FK/hash/status/order and security tests pass; never execute arbitrary dump SQL |
| D. Neon/provider preparation | No | Explicitly approved isolated environment, compatible extensions/driver, backups/roles and migrations | Verified least privilege, restore plan and operational limits |
| E. Current-data reconciliation/cutover | No | Separately approved current snapshot/export, write freeze, final diff, one writer and monitored switch | No missing/newer content or permission changes lost; owner recovery works |
| F. Authentication transition | No | Verified identity linking/enrollment independent of DB change | Owner/private-reader/ban/recovery/session revocation parity |
| G. Cleanup/retirement | No | Separate retention/decommission review | Approved recovery retention; no automatic source/account/object deletion |

The earlier plan mentions isolated restore rehearsals; **this phase forbids any restore or SQL execution**. A later clean-target import must be separately approved and based on reviewed schema/data transformations, not an automatic replay of untrusted cluster SQL. No generated SQL or importer is delivered here.

## Per-domain handling

| Domain | Proposed transformation | Conservative conflict policy |
| --- | --- | --- |
| Identity/profile | Legacy users integer ID and unverified UUID user_id reference → namespaced app identity review; map profile_color; no verified Clerk subjects in this file | Unmatched stays unresolved; no email-only merge, credential imports, inferred ownership or account deletion |
| Permissions | Legacy users offers is_admin/needs_setup only; enabled/ban/private/owner/whitelist flags are not supplied by this snapshot. Preserve any later authoritative evidence separately and review app capability assignments | Restrictions win pending review; never grant admin/owner simply because a legacy flag or provider SQL role says so |
| Blog | Recover 2 UUID posts and HTML; no source slug/excerpt/thumbnail/publication time. Preserve views/deleted_at/deletion_date; active audience unresolved; parent-scoped media placeholder mapping | Newer/current content wins unless owner selects a recovery version; unknown statuses nonpublic; avoid destructive deduplication |
| Projects | Recover project-type public.content candidates; fields are generic URL/text/thumbnail/order, not a verified v5 project schema; review mapping | Colliding slugs/IDs require explicit resolution; never silently publish recovered project |
| Media metadata | 10 shared public.media rows + 2 post_media links + 3 content_media links; keep global UUID vs integer/UUID join identity distinct and retain URL/key evidence | Do not assume identical URL means same rights or content; no remote fetches/deletes; private/public conflict requires review |
| Homepage | Map known content.type singleton sections; retain description/title/URL/thumbnail and contextual links; no source body JSON/crop schema established | Do not drop unrecognized fields or parse strings repeatedly until an arbitrary shape emerges |
| Terminal | No command table/registry identified; obtain another approved source or author commands later | Unknown actions disabled/quarantined; alias collisions fail import; no restricted actions in public registry |
| Nav/theme/audit | No matching legacy tables identified; maintain new-feature proposals | Start curated config after owner review; do not fabricate historical audit events |
| Provider objects | Exclude Supabase auth/storage/realtime/key/vault models and 147 provider migration rows from website data migration | Do not copy roles, grants, service accounts, auth sessions, token data or extension-owned DDL wholesale |

The target normalized schema in [PROPOSED_DRIZZLE_SCHEMA.md](PROPOSED_DRIZZLE_SCHEMA.md) is a later stage. Preserve a compatible data-access layer and Clerk IDs through the database cutover first; normalize content/media and replace authentication independently. Source type differences are now known for this snapshot: user/content and post join IDs are integers, posts/media UUIDs, content joins UUIDs; preserve or map them explicitly. Do not cast legacy user IDs into Clerk subjects or assume this older dump supplies a current-v5 cutover source.

## Publication and permission mappings requiring approval

| Legacy semantic value, if verified | Proposed target | Access |
| --- | --- | --- |
| public | published + public | Public query API; page membership remains a separate decision |
| private | published + private | Active private reader or editorial/owner capability |
| draft | draft + private | Editorial preview only |
| archived | archived + private | Editorial only; do not infer historical public audience |
| active (verified legacy default and serialized state) | Quarantine or draft/private pending owner audience review | No automatic publication |
| null/unrecognized | Quarantine or draft/private pending review | No public visibility |

Public/private/draft/archived are v5 source vocabulary; **active** is the observed legacy vocabulary and does not determine audience. Do not map active to published/public by guesswork. The current APIs have status leaks, inconsistent owner/whitelist checks and missing ban checks in admin helpers. Migration validation must implement the **approved policy**, not reproduce accidental disclosure. No existing guard was changed or removed in this phase.

## Authentication strategy

Maintain authentication-owned account/session/verification/passkey storage separately from application-owned users, roles and private-content grants. Database roles are infrastructure principals, never website roles. A legacy password-like column does not imply Clerk passwords are portable or that any verifier should be printed or retained in the repository.

Carry forward Better Auth as the provisional proof-of-concept preference from [AUTH_EVALUATION.md](AUTH_EVALUATION.md); Auth.js remains an alternative for OAuth-first use with more custom lifecycle handling. No new release checks or network access occurred here. Revalidate adapter/plugin/session compatibility and advisories in a later authorized evaluation.

Default account transition: verified enrollment/reset for eligible existing identities, or a separately reviewed server-verified Clerk-session bridge. Re-authenticate OAuth users with verified provider subjects; passkeys/MFA re-enroll unless compatibility is actually demonstrated. Never import legacy sessions, tokens, recovery challenges or provider password clauses into app tables. Preserve bans/disable state through claiming/recovery. Test owner recovery before enrollment opens. Credential changes made after auth cutover require an explicit rollback path; reverting to Clerk will not make them portable.

## Secret and private-data handling

Verified security finding: public.users contains nonempty bcrypt-like password verifiers and email fields. No values are shown; reset-token values in these serialized rows are empty. Provider auth user/session/identity/MFA and vault/key COPY blocks are empty. Broad legacy table grants and missing RLS on credential-bearing users must not be reused; no live exposure was tested. Other embedded secret categories are not exhaustively ruled out by this bounded inspection. Keep source and any authorized private reconciliation artifacts outside Git with restricted access. Do not output raw role clauses, function bodies, credentials, verifiers, connection strings, signed URLs, emails, media locators, private HTML or user rows. SQL schema defaults and comments can also contain secrets. No forensic raw extract or synthetic copy of source records should be added to docs.

For count-only parsing, track rows/coverage per qualified table; unsupported INSERT/COPY formats are unknown or lower-bound estimates, not zero. A row count says nothing about trusted account ownership or media existence. Avoid small-group sensitive statistics. Any later secrets rotation is a separate provider action needing authorization, not automatic cleanup.

## Reconciliation and validation design

- Fingerprint the source read-only and distinguish each source database/schema/table. Record parser/tool versions, complete/partial status, and a private run ledger. Stop if the file changes mid-read.
- Use deterministic source keys and a per-entity mapping ledger to support repeatable imports. A repeated run must not create duplicate entities or grant new privileges. Retain source content outside the repository until the retention decision; do not log it.
- Validate primary keys, normalized slug/name collisions, parent/child orphans, nulls, types, timestamps/timezones, malformed JSON and ordered media. No silent truncation/coercion or bulk default-to-public behavior.
- Compare per-table and per-status totals, stable IDs, transformed content checksums and attachment counts/order in a private ledger. Documentation carries aggregates/structural results only, never individual record hashes or content excerpts.
- Preserve the old media-ID-to-new-attachment map so `[MEDIA … (id)]` content remains renderable. Blob availability/rights/access require a separately approved object inventory; database rows do not contain or prove the objects.
- Use synthetic visitor/member/private-reader/content-admin/whitelist-manager/owner/banned/disabled/missing-profile fixtures. Check direct APIs, pages, draft/private thumbnails, command actions and media delivery. No live requests during this phase.
- Verify posts beyond the first 25 and both legacy/canonical project paths. Test atomic reorder/replace, upload finalization failure, session invalidation and last-owner protections in later isolated implementation.

## Cutover and rollback, for later approval

Keep one authority for writes and grants. Prefer an approved short editorial write freeze over uncoordinated dual writes. Capture a current consistent source, compare with legacy recovery candidates, reconcile conflicts, validate in isolation, and switch database target while Clerk remains identity provider. Source data and provider settings stay intact through an approved observation window.

Abort before switch if reconciliation/permissions fail. After target writes begin, stop writes and preserve target changes before rollback; flipping a connection string back can lose new posts, bans or grants. Database and auth rollback are separate plans. Define error/latency limits, private-content disclosure triggers, owner lockout procedures and who can authorize actions. No freeze, export, switch, restore or rollback action is being taken now.

## Decisions / unresolved questions

1. Confirm backup provenance, apparent date and authoritative-data role; path access and local forensic inventory are now resolved.
2. Determine whether legacy material is reference-only, recovery content or a proposed migration source; no current-production assumption.
3. Approve the state/audience split, role capability model, old-ID preservation and conservative conflict handling.
4. Choose Better Auth/Auth.js proof-of-concept scope, login methods, verification/recovery and owner bootstrap policy.
5. Decide whether to normalize media/configuration during a later stage or preserve source layout longer; retain S3 initially.
6. Set privacy, retention and secret-remediation ownership; review any detected credential category without revealing values.
7. Separately authorize any implementation, provider access, isolated import or cutover. Existing safety constraints remain in force.

**Stop point:** the four existing documents are updated with verified metadata/counts; local non-executing forensics is complete for the inspected file, with provenance, semantic mapping and recovery decisions still open. No application/auth/provider changes are authorized by these documents.

## Verified recovery scope and focused next steps

The snapshot offers 2 blog posts, 10 media records, 2 post/media joins, 6 homepage/project content records, 3 content/media joins, 2 legacy application accounts and 3 bug reports. Every application table requires a transformation or a scope decision; no whole table is drop-in compatible with current v5 queries. No current-style profiles, homepage/project tables or terminal commands can be sourced directly from this file.

1. Approve a **recovery-only mapping**, without treating this file as current production. Review homepage/project field meanings and source timestamp timezone; confirm that active is not an audience permission.
2. Preserve source UUID post/media identities plus distinct join IDs in parent-scoped mapping; recognized HTML media references and all declared application FK references resolve within the serialized dataset, but importer validation remains mandatory.
3. Retain legacy soft-deletion metadata and optional historic views; add optional bug-report model only after scope/retention approval. No obsolete classification or deletion is warranted yet.
4. Reuse the proposed asset/attachment, app/auth separation and revision models, with the focused amendments in [PROPOSED_DRIZZLE_SCHEMA.md](PROPOSED_DRIZZLE_SCHEMA.md). No evidence requires copying Supabase infrastructure into Neon or selecting an auth library based on old credential verifiers.
5. Continue with synthetic fixtures and reviewed schema/importer design only after implementation authorization. Any future current-provider comparison, isolated import, production switch or credential remediation remains separately authorized work.
