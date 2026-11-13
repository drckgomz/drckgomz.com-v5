# Phase 3I — Historical Import Preflight

## Status

The offline preflight and development-only staging writer were prepared. The approved import attempt did not commit; a follow-up read-only inspection confirmed the staging and provenance tables remain empty. The source backup remains read-only. The runner is designed to write only the restricted `legacy` staging tables and `ops` import provenance tables. It does not populate `app.posts`, Better Auth tables, application profiles, roles, or capabilities.

## Backup and artifacts

The exact previously authorized backup was re-read without printing records and matches the sanitized Phase 3E inventory by SHA-256, byte length, format, application schema, and aggregate row counts. It remains a UTF-8 PostgreSQL plain-text dump (201,030 bytes). The parser verified all application COPY field widths. Primary key duplicates and foreign-key orphans are zero. The source contains 28 application rows; provider-managed records are excluded. The repository had no serialized import-row artifact; the preflight parses the source in memory and emits aggregate counts only.

## Expected source and first-run target counts

| Source relation | Source rows | Planned first-run destination | Planned writes | Handling |
| --- | ---: | --- | ---: | --- |
| `posts` | 2 | `legacy.posts` | 2 | Preserve IDs, HTML, statuses, deletion markers and naive timestamps; quarantined. No public app post. Any later app candidate defaults to draft/private pending slug and timezone review. |
| `media` | 10 | `legacy.media` | 10 | Preserve metadata, URL, object key and IDs; do not fetch or alter objects. Delivery remains unverified. |
| `content` | 6 | `legacy.content` | 6 | Preserve content and source references; homepage/project semantics remain quarantined. |
| `content_media` | 3 | `legacy.content_media` | 3 | Preserve relationship IDs and order; inserted after parent content and media. |
| `post_media` | 2 | `legacy.post_media` | 2 | Preserve relationship IDs and order; inserted after parent posts and media. |
| `users` | 2 | `legacy.users` | 2 | Preserve inert historical profile/admin flags, but omit password/reset fields. Never create auth users, sessions, profiles, roles, or capabilities. |
| `bug_reports` | 3 | Deferred | 0 | Retention and sensitivity decision is unresolved; no report text is copied by the proposed run. |
| **Total** | **28** |  | **25** | Three bug reports deferred. |

## Mapping and safety review

- Staging columns match `src/lib/db/schema.ts` and migration `0000`. Source IDs remain in their original integer/UUID representations. Nullable values and naive timestamps are passed as source text to `timestamp without time zone` columns.
- The writer's dependency order is posts, media, content, users, then relationship tables. This satisfies the five reviewed foreign-key relationships.
- Legacy status `active` is retained only in `legacy.posts`. No rows are added to `app.posts` or a public read path. The future content candidate policy remains `publication_state=draft`, `visibility=private`, with no published timestamp.
- User password, reset token, reset expiry, Supabase identities, sessions, provider history, and admin-derived privileges are excluded from target auth/authorization systems. `is_admin` and setup flags remain inert in restricted legacy staging only.
- Media URLs and keys are metadata only. No S3 request, upload, copy, rename, deletion, or publication occurs.
- Existing target collisions cause a fail-closed stop. A deterministic run ID and transaction advisory lock prevent overlapping runs. A completed rerun verifies existing staged rows and provenance and then performs no inserts. First import is a single transaction; any error triggers rollback. Recovery is by a verified development restore point/branch discard, never reverse-delete SQL.
- The runner reads only `.env.neon.development.local` for future import mode, validates its ignored status and exact endpoint/database/role, checks the Phase 3H migration ledger hashes and empty staging targets, and requires fixed project/branch/endpoint/database arguments, a fresh Console-verification attestation flag, and a separate explicit import confirmation flag. Neon Console branch-to-endpoint identity must still be checked immediately before a future run because the SQL connection cannot prove project/branch IDs.

## Validation and blockers

Offline parser tests cover COPY escaping, field-width errors, missing/duplicate tables, FK orphans, secret-field projection, and schema/order contracts. The dry run matches the expected 28 source rows and plans 25 staging writes. It does not connect to the database.

Before a live import approval, decide whether the three bug reports should remain deferred and separately confirm the development branch is still isolated and has a verified restore point. Also review current website data separately: this historical backup is not proof of current Supabase state. Reconcile route/slug and timestamp semantics before any public app-post projection or enabling new readers. No historical content is currently approved for publication.

## Approved import attempt and read-only verification

The owner explicitly approved one import of the 25 reviewed records to the verified development branch only. Neon Console identity was rechecked immediately before the attempt: project `jolly-poetry-87664309`, branch `br-nameless-dust-bewpmr4r` (`development`), endpoint `ep-sparkling-sun-bedq0ozn`, database `neondb`. The prepared fail-closed runner was invoked once using only `.env.neon.development.local`. It exited unsuccessfully with its generic rollback/stop message and did not report a commit. In accordance with the approval conditions, it was not retried or repaired.

A separate read-only transaction in the verified Neon development SQL Editor completed with a 15-second statement timeout and `ROLLBACK`. It confirmed PostgreSQL 18.6, read-only transaction mode, and all three expected Phase 3H migration hashes. Aggregate findings:

- Imported historical rows: **0 of 25**.
- `legacy.posts`, `legacy.media`, `legacy.content`, `legacy.content_media`, `legacy.post_media`, and `legacy.users`: **0 rows each**.
- Deferred `legacy.bug_reports`: **0 rows** (the three source bug reports remain excluded).
- Matching provenance records and import-run records: **0**.
- Legacy media/content/post relationship orphan counts: **0** for all three checked relationships.
- Public application rows (`app.posts`, `app.media`, `app.home_sections`, `app.home_projects`), Better Auth rows (`auth.user`, `auth.account`, `auth.session`), and application role assignments: **0** each.

No application record contents were queried. No account, role, media object, public application row, or production resource was changed. The import is **not complete**. The runner's suppressed diagnostic leaves the root cause unresolved; the independent scripted verifier also could not establish a local connection. The Console read-only check found no partial import state. Do not rerun the writer until the cause is diagnosed and a new import authorization is provided.

## Failed-attempt diagnosis (offline; no retry)

Review of the saved runner and the observed generic failure establishes that the exception reached the import `try/catch` before its `committed` flag was set. The runner's post-commit verification branch sets that flag first and emits a different message, so the observed output rules out a failure in the newly added post-commit verification code. The Console check independently confirms that the staging tables and provenance ledger are empty, so no import transaction committed.

The exact failing phase is **unknown**: the old catch discarded the error and had no phase marker. It could have failed at `pool.connect()`, during connection identity or migration/schema preconditions, during an insert/provenance write, or during pre-commit verification before rollback. The parallel local verifier also failed with suppressed diagnostics, which makes sandbox network/DNS/TLS restrictions plausible, but does not prove that was the writer's failure. There is no persisted runner trace or PostgreSQL error to distinguish these cases. Root cause confidence is therefore **low for a specific cause; high that this evidence does not implicate post-commit verification and that nothing committed**.

Offline comparison found that the runner's allowlisted staging column names/order, five expected legacy foreign-key pairs, write dependency order, and migration ledger hashes match the reviewed Phase 3H SQL/schema and recorded development catalog. PostgreSQL transaction/advisory-lock usage is structurally sound: one pooled client holds the transaction-scoped advisory lock, all source/provenance writes and pre-commit checks use that same client, and failures before `COMMIT` trigger `ROLLBACK`. No definite INSERT/schema mismatch was found from local artifacts. This cannot establish server-side permissions or runtime behavior.

The runner now keeps a bounded phase marker and classifies driver failures into DNS/host resolution, network connectivity, authentication, permissions, schema/query mismatch, constraint violation, transaction/timeout, or a generic precondition category. It prints only the phase and category, never the driver message, URL, or row values; post-commit verification remains distinctly reported. Offline regression tests exercise those classifications and confirm diagnostics do not contain the synthetic secret-bearing messages. **The runner was not rerun during the diagnosis turn.** The next step is to review a sanitized phase/category from a separately authorized attempt; if it reports connectivity, diagnose the local execution environment without changing database safeguards. A new import attempt requires separate explicit approval.

## Controlled second attempt (2026-11-11)

The owner authorized one additional attempt. Before it, the offline parser/regression suite passed (5/5), and the actual-backup dry run planned exactly 25 staging rows while deferring 3 bug reports. Neon Console showed the authorized development project, branch and endpoint; a fresh read-only transaction confirmed `neondb`, exactly three migration ledger entries with the reviewed hashes, all seven legacy source tables empty, and no existing matching provenance or import run.

The updated runner was invoked exactly once. It stopped with the sanitized diagnostic **`phase=connect, category=precondition-or-unknown`**. This phase means the failure occurred while acquiring the client, before the runner could issue its connection identity query or begin a transaction. The exception did not expose a recognized safe error code, so DNS/network versus driver/setup cause remains unresolved. No retry or repair was attempted.

Post-failure read-only verification in Neon Console completed on the development branch with a read-only transaction and `ROLLBACK`. It confirmed all 7 legacy table counts remain 0; matching `ops.legacy_entity_map` and `ops.legacy_import_runs` counts remain 0; all three checked relationship orphan counts are 0; application-table aggregate and auth/role aggregate counts are both 0; and the 3 migration hashes still match. Therefore **0 of 25 records were imported**, the 3 bug reports remain excluded, and the failed attempt committed no staging or provenance state. No application contents were queried. Stop here; another import attempt requires separate explicit approval after local client acquisition is diagnosed.

## Local client-acquisition diagnosis (2026-11-11; offline only)

The runner sets `phase="connect"` immediately before `await pool.connect()`. There are no validation checks between that assignment and the `try` body call. Thus the reported phase identifies the throwing operation as **pool client acquisition**; no transaction or SQL query had started. Source parsing, import flag validation, ignored-file validation, URL parsing, and `Pool` construction occur before the phase-tracked `try/catch`, so those failures would not produce this `phase=connect` diagnostic. The observed diagnostic alone cannot determine whether the pool failed locally while constructing/acquiring its client or during DNS, network, TLS, or PostgreSQL authentication.

Offline code comparison found the Phase 3F migration runner and Phase 3I importer use the same installed `@neondatabase/serverless` `Pool` implementation (1.2.0), `max: 1`, 10-second connection timeout, explicit `.env.neon.development.local` parser, endpoint/database/role checks, and `sslmode=require`. Neither loads `.env.local` or inherited `DATABASE_URL`. Phase 3F issues `pool.query(...)`, which acquires a pooled client internally; Phase 3I calls `pool.connect()` explicitly because it must hold one client across its transaction, advisory lock, writes, rollback, and verification. Both are supported pool operations. No local URL parsing or TLS configuration mismatch was found. The difference is the explicit client acquisition path and the different runtime execution context of the two historical attempts; that does not establish a driver defect or sandbox denial.

The old failure classifier inspected only top-level error codes and used `precondition-or-unknown` as its fallback, which was misleading for the known `connect` phase and could miss nested `AggregateError.errors` or `cause` socket codes. It now inspects bounded, cycle-safe nested machine codes without copying messages into output, distinguishes DNS, network, TLS/certificate, authentication, and other known categories, and labels an unclassified connect-phase failure `client-acquisition-unclassified`. Offline tests cover nested DNS and TLS errors and verify that private message text and codes do not leak into the output. These improvements make a future separately authorized attempt more diagnostic; they do not determine the already-observed failure's underlying cause.

**Root cause:** exact failing operation is identifiable (`await pool.connect()`); underlying cause remains unknown. **Confidence:** high for operation and pre-transaction timing; low for DNS/network/TLS/auth/local-driver attribution because raw diagnostics were intentionally suppressed and no error code was retained. Do not retry the import based on this diagnosis. Before a separately approved attempt, run only offline checks and review the new bounded phase/category output; if a newly approved diagnostic classifies a network error, investigate whether the command execution context permits outbound Neon connections without weakening safeguards. The historical Phase 3H approach is suitable for comparison, but moving the import to `pool.query` would be unsafe because its multi-statement transaction and lock must remain on the same checked-out client.

## Follow-up: isolated pool failure investigation (2026-11-11; no database connection)

The one-shot diagnostic was reviewed offline. The installed driver is `@neondatabase/serverless` 1.2.0 and the runtime is Node 24.21.0, where `globalThis.WebSocket` is available. The installed Neon README says an explicit WebSocket constructor is needed on Node 21 and earlier; the package's Pool uses WebSockets, and `Pool.query()` and `Pool.connect()` share the same underlying pool/transport. No missing WebSocket configuration was found. The importer, migration runner, and one-shot diagnostic all use a single-client pool, a 10-second timeout, the same explicit development URL parser, and required secure transport.

A DNS-only check resolved neither the development endpoint nor a neutral control domain (`example.com`) in the current command environment; one resolver is configured. It made no TCP, TLS, WebSocket, HTTP, or PostgreSQL connection. This, together with the sandbox's restricted network access, makes local resolver/egress restriction the **most likely** cause, with medium confidence; a machine-level resolver issue cannot be ruled out. TLS negotiation therefore remains untested. Node's TLS defaults include TLS 1.2 minimum and a populated system root store, but the Neon WebSocket transport uses secure `wss` and its own driver TLS handling, so those local values do not prove a successful handshake.

The diagnostic's safe-code allowlist omitted common Undici codes (`UND_ERR_CONNECT_TIMEOUT`, `UND_ERR_SOCKET`, and related connection errors). Thus its `safe error codes: none` meant no code from its incomplete allowlist was surfaced; it did not establish that the underlying error had no machine code. The allowlist now lives with the bounded error utilities, recognizes these codes as network failures, and has offline regression coverage. The previous error cannot be reclassified retroactively because its raw error was discarded. This reporting defect does not itself explain why the socket failed.

The standard `pg` client would use direct TCP and still requires DNS plus outbound network access, so it is not a remedy for the current evidence and no dependency was installed. Neon's HTTP `neon()` API is suitable for a future isolated single read-only query if HTTP egress is available, but it does not provide interactive sessions; its batched `transaction()` API is non-interactive. It must not replace the importer's checked-out Pool client, transaction, or advisory lock. No connection attempt or import was made during this follow-up.

**Safest next action:** do not alter the runner or retry from this restricted environment. When separately authorized, run a standalone diagnostic from a local execution environment whose DNS/network access is known to work, using the same explicit development file and one `pool.connect()` call. If it still fails, retain only the newly allowlisted phase/category/code report. The historical Phase 3H success shows the same driver path worked in its execution context, but available records do not prove that it ran under the current sandbox network conditions.

## Import verification and endpoint guard repair (offline; no import run)

The pre-commit and post-commit verifier now share a staging-count contract: all six imported source tables must have their exact source row counts and every excluded source table, including `legacy.bug_reports`, must contain zero rows. Detailed row and provenance matches are generated only from the six-table `INSERT_ORDER`; the aggregate provenance count must equal those matched rows. The source inventory and import report continue to account for the three deferred bug reports without writing them. This preserves the transaction rollback, empty-target precondition, and deterministic idempotency checks.

The URL guard now requires the exact previously reviewed development endpoint hostname, PostgreSQL protocol, expected database and role, a nonempty password, and an allowed PostgreSQL port. Endpoint-prefix lookalikes, other endpoint IDs, unexpected database names, malformed URLs, and unexpected ports fail closed. Project, branch, endpoint, and database command-line confirmations plus the fresh Console-attestation flag remain required. The hostname is checked locally; branch identity still requires an operator to verify Console immediately before a future run.

Offline regressions cover source bug reports being excluded from row/provenance matching while required to remain absent from staging, unexpected staging counts, and lookalike or unauthorized hostnames. These repairs were not used to run an import or database connection. The importer is ready for a **separately approved** execution after a fresh Console check; no new import attempt is authorized by this local repair.
