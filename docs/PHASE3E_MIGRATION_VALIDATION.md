# Phase 3E migration validation plan

**Backup structure and offline compatibility contracts were validated; no live migration or database comparison has been run.** The confirmed backup was re-read and matched its documented format/counts. Neon development branch identity is unverified. Tests against a real imported development dataset remain a future gate, not a current pass.

## Required stages and evidence

| Stage | Safe now? | Required evidence |
| --- | --- | --- |
| Repository contract review | Yes | Current route/schema map and this compatibility checklist |
| Backup read-only inventory | Passed locally | Recomputed format/size/version/counts; all COPY widths valid; no record values in logs |
| Offline mapper contract | Synthetic only; source-row batch not emitted | Deterministic envelopes and stable keys; credentials excluded; no target writes |
| Synthetic mapper tests | Passed (12 tests) | Parser quoting/COPY cases, compatibility gaps, stable mapping, secret exclusion, fail-closed IDs/orphans, aggregate snapshot diff |
| Neon development connection/import | No | Explicit owner approval plus verified dedicated disposable development branch, approved identity/least-privilege role and rollback point |
| Development reconciliation | No, requires import | Source/target per-table counts, keys, relationships, content/field fidelity, route/render checks and authorization tests |
| Production migration/cutover | Not authorized | Separate future approval, authoritative current snapshot, write freeze/delta reconciliation, recovery and rollback plan |

## Validation assertions

1. **Counts:** compare source and target counts by source relation and target entity, including quarantined/unmapped rows. Explain intentional transformations one-to-many or many-to-one. Never interpret the historical 28-row count as a target acceptance count for current v5.
2. **Identifiers and relationships:** assert source-key ledger coverage, unique target keys, all required parent/asset relations, no unresolved orphan, duplicate `(parent,order)` or slug conflict. Preserve the distinct integer bridge/content/user IDs and UUID post/media IDs.
3. **Content:** compare source/target titles, raw HTML, URLs, descriptions, captions, metadata, thumbnails, order, view counts and deletion markers under the approved transform. Validate recognized media placeholders resolve to the same parent-scoped media. Do not emit content or unsalted hashes.
4. **Dates and states:** compare naive source timestamp fields byte-for-byte/as wall-time values until timezone is approved. Assert every source status is represented in provenance; only explicit approved public states render publicly. `active`, deleted, unknown, null and conflict states must be quarantined by default.
5. **URLs and media:** preserve old route paths/redirects and original media URL/key references. Count only metadata-only reachable/unverified/missing classifications supplied by an explicitly approved checker; do not fetch S3 objects as part of this phase. Missing images render an accessible fallback without substituting a private URL.
6. **Rendering:** on a confirmed development dataset, verify homepage section content/order; blog list and exact-slug detail; project list/detail through both legacy root and `/projects` routes; navigation anchors; captions/galleries; responsive and theme modes. Use a fixture-backed request test first and browser QA when the runner is available.
7. **Authorization:** anonymous sees only approved published/public content; draft/private/archived/deleted items deny; authenticated private-reader, editor/admin and owner boundaries follow approved capability policy; import never grants admin/owner. Test previews, media APIs and redirects as well as page HTML.
8. **Idempotence/conflict:** run the same offline dry-run and later development import twice; second run creates no duplicates and reports unchanged rows. Change one source field, then assert it is flagged as a source conflict and does not overwrite an existing target row silently.
9. **Rollback:** in the disposable development branch only, demonstrate restoring/discarding the pre-import point and confirm source remains unchanged. Do not run destructive cleanup against shared or production databases.

## Migration report format

Each run should produce a restricted machine-readable private report plus a sanitized summary containing: run ID, source fingerprint, parser/mapping version, target branch attestation reference (opaque/non-secret), start/end time, per-source and per-target counts, created/unchanged/quarantined/conflict totals, FK/slug/order validation totals, content/media reference checks, authorization/render test results, rollback point reference and final disposition. Never include rows, HTML, email, user names, URL/object keys, password verifiers, tokens, raw per-record digests or database connection details in repository artifacts.

## Current status

- Independent Phase 3E parser confirmed 1,014 SQL statements, 31 explicit table definitions, 32 COPY blocks, 175 rows; seven application tables total 28 rows.
- All 32 COPY blocks passed field-width checks; five app FK relationships had no orphans, app primary keys had no duplicates, and populated join parent/order pairs had no duplicates.
- Compatibility comparison found none of the eight current v5 table contracts is a drop-in match. Backup data is not compared to current live content.
- Offline mapper and aggregate validator are implemented and tested with synthetic data; no database importer/writer or comparison against migrated data has been executed.
- Local Neon/Drizzle and Better Auth dependencies, an initial Drizzle schema, and a generated DDL snapshot now exist. They have not been applied to any database. There is no Neon branch attestation or database-backed comparison.
- No Neon branch identity has been attested, and no provider connection or import is authorized.
- No homepage/blog/project render comparison on imported data exists.
- Therefore migration validation status is **NOT RUN / NOT PASSED**. This must remain explicit until development import and all reconciliation assertions pass.

## Gated next steps

1. Review and approve the versioned field/state map, including timestamp timezone interpretation, route aliases/slugs, bug-report retention, identity proof, and whether legacy content should be copied into a restricted archive schema before normalized v5 tables.
2. Extend the tested mapper with explicit per-table transforms and lossless source provenance; keep it offline and reject unresolved decisions.
3. Review the local Drizzle schema, generated SQL, and Better Auth configuration in [implementation notes](PHASE3E_IMPLEMENTATION.md). Extend the offline transform/reconciliation before any provider connection. Require explicit branch identity plus separate approval for each connection, schema application, and import operation.
4. Only after those gates, migrate to a separate disposable development branch and run the full assertions above. Do not label this production migration or cutover.
