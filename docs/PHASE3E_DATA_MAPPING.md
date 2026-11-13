# Phase 3E data mapping and compatibility plan

**The local schema, Better Auth adapter, and read-only Drizzle blog repository are implemented; no database persistence operation has run.** Clerk/Supabase remain the default, with the Drizzle blog reader opt-in. This document's legacy importer remains a dry-run candidate mapper only. Nothing here connects to a database, uploads media, enables registration, or publishes imported content. See [implementation and development gate](PHASE3E_IMPLEMENTATION.md), [legacy inventory](PHASE3E_LEGACY_DATA_INVENTORY.md), [database migration plan](DATABASE_MIGRATION_PLAN.md), and [private media proposal](infrastructure/PRIVATE_MEDIA_MIGRATION_PLAN.md).

## Deterministic migration contract

The local `scripts/phase3e/legacy_mapping.py` is a deterministic **staging-envelope mapper**, not a Neon writer. It preserves original source payloads and source IDs for non-user tables; for `users`, it intentionally omits password/reset-token fields while retaining historical profile/admin flags for review. Its stable source key is namespaced and SHA-256-derived. Posts remain quarantined, user privileges are empty, and media is marked unverified. `target_candidate()` adds a non-writing transform into `app.posts` only as a private draft candidate; it retains missing route/timezone/publication decisions as blockers and leaves other entities in restricted legacy staging. `validate_migration.py` checks batch IDs and declared relationships and has a memory-only aggregate snapshot comparator for future authorized source snapshots. It can report added/removed/changed counts without showing row IDs or field values. No data-bearing envelope is serialized by a CLI or written to disk.

The future importer must implement a versioned, explicit source-to-target transform, not replay the Supabase cluster dump. Never execute dump SQL, provider roles, grants, functions, extension installation or RLS statements. The importer must:

1. Accept a verified immutable source snapshot and an explicit target mapping version; reject unsupported schema/fingerprint/parser versions.
2. Run offline `--dry-run` by default. Show only table counts, validation totals, and opaque conflict IDs; never print record values, HTML, email, URLs, credentials or hashes of low-entropy personal fields.
3. Preserve source keys and timestamps in a private provenance map; use stable deterministic target identifiers where a transformation requires a new identifier. Re-running the same run ID/source/version must be idempotent.
4. Detect duplicate target IDs, normalized slugs, usernames, emails, attachment order, singleton sections, conflicting source maps, invalid parent references, malformed types and unsupported states. Fail closed on unresolved conflicts; do not silently drop or coalesce rows.
5. Write all target rows and provenance records in one transaction per consistent import unit, using explicit conflict comparison. `ON CONFLICT DO NOTHING` alone is not sufficient: existing rows must match the prior source/mapping fingerprint or be reported as conflicts.
6. Generate a sanitized migration report with source fingerprint, tool/mapping version, row counts, FK/orphan/duplicate totals, content fidelity results, media resolution status, quarantines and target development-branch attestation reference. Keep report free of row content and credentials.
7. Support rollback by discarding/recreating a dedicated disposable development branch or restoring a verified target restore point. Do not implement destructive row-deletion rollback against shared or production data.

The only permissible first import target is an explicitly confirmed, disposable Neon **development branch** with no production traffic and a least-privilege role. Do not access `DATABASE_URL` or infer environment from its hostname. No live import can start until the owner separately approves it and records branch identity out of Git.

## Mapping rules

| Source table and fields | Proposed target representation | Preservation and blocking rules |
| --- | --- | --- |
| `content.id`, `type`, `title`, `url`, `description`, `order_index`, `created_at`, `thumbnail_url`, `media_id` | Preserve as namespaced `legacy_content` provenance; map known singleton types to candidate `home_sections`, project type to candidate `projects` only after semantic review; keep `media_id` separate from gallery relations | Preserve raw source representation. Unknown type, double-encoded body, missing target contract, multiple candidates or singleton collisions quarantine. Do not invent `body` shape or contact field. |
| `content_media.id`, `content_id`, `media_id`, `position`, `context_label`, `created_at` | `home_section_media` or `project_media`/asset relationship plus source relation ledger | Preserve bridge ID, context, order and both source keys. Resolve parent type first. Keep duplicate relationship rows as conflicts; never dedupe solely by URL. |
| `media.id`, `url`, `key`, `caption`, `type`, `uploaded_at`, `context`, `title`, `order_index` | Stable asset catalogue record with original source-media UUID and exact source URL/key; relationships represented separately | Do not change or fetch URL/object key. Record only metadata needed for private reports. If target asset UUID is same-compatible, preserve; otherwise deterministic UUIDv5-style namespace mapping must be reviewed and stored. Existing public URLs stay unchanged at first. |
| `posts.id`, `title`, `content`, `views`, `created_at`, `updated_at`, `deleted_at`, `status`, `deletion_date` | `posts` with stable text/UUID-compatible ID, raw HTML, source status, views, deletion markers and source timestamps; derive slug in a reviewed explicit map | No source slug/excerpt/thumbnail/author/audience. Preserve exact status in provenance; map `active` to quarantined draft/private pending approval. Preserve media placeholder IDs; do not rewrite HTML before confirming each reference. |
| `post_media.id`, `post_id`, `media_id`, `media_order` | `post_media` with stable source bridge identity, target post/asset refs, order | Retain bridge ID separately from `media.id`; validate source FKs and attachment order. Do not synthesize per-post asset identity that destroys shared-media semantics. |
| `users.id`, `username`, `email`, `is_admin`, `created_at`, `user_id`, `needs_setup`, `profile_color` | Restricted legacy identity/provenance record and an application profile only after verified identity review | Never copy `password`, `reset_token` or reset expiry into target/auth. Preserve historical ownership mapping when independently evidenced. No automatic email merge, account activation, role/admin/owner grant, private-reader grant or Clerk/Better Auth link. |
| `bug_reports.id`, `description`, `reported_at` | Quarantined restricted legacy reports only if product owner approves retention and a target exists | Preserve exact timestamp semantics; no current consumer. Do not publish text or classify obsolete without approval. |
| Supabase auth/storage/realtime/provider tables, roles/grants/extensions | Excluded from website-data import | Keep auth enrollment/linking separate; never import sessions, provider tokens, password verifiers, service roles, RLS/grants or migration history. |

`source timestamps` are naive (without timezone) in the legacy application schema. Store the original wall time and source type until timezone provenance is approved. Do not append `Z`, convert to UTC, or fabricate offsets. Keep null values/nullability exact in provenance even where a reviewed target requires a placeholder.

## Identity and authorization transition

Clerk, Supabase identity references and Better Auth identities are distinct namespaces. First migrate content IDs/relationships while Clerk remains the active authentication system. Carry the old integer user ID and UUID reference as namespaced historical identifiers; do not treat the UUID as a verified Clerk subject. Never import legacy password verifiers, sessions, tokens or reset challenges. If the selected future auth system does not support verified credential compatibility, use verified password reset/re-enrollment or a separately approved session-backed account-link workflow. Require independent proof and conflict handling; email equality alone is insufficient.

Create owner/admin grants only through an independently reviewed bootstrap procedure after identity verification, with audit evidence and last-owner safeguards. Imported `is_admin` is historical data for review, not an executable authority. Imported users default disabled/no privileges until reviewed according to an approved lifecycle policy.

## Public behavior and URL compatibility checklist

- [ ] Snapshot the current application schema and authoritative data source after separate read approval; historical backup alone is insufficient.
- [ ] Preserve IDs used by old project routes and blog references; provide explicit route map for generated slugs and legacy paths.
- [ ] Verify old `/[slug]`, `/projects/[slug]`, `/blog/[slug]`, API aliases, navigation links and canonical/redirect responses before cutover.
- [ ] Preserve project order, home-section order, media order/captions, post dates, source publication state, deletion state and all placeholder references.
- [ ] Keep public rendering restricted to explicitly approved public content. Unknown status/audience remains nonpublic.
- [ ] Compare rendered homepage, each project page, blog list/detail and media galleries using approved synthetic/review fixtures before enabling imported content.
- [ ] Preserve existing object URLs during initial metadata migration. Broken/unavailable URLs are reported; objects are never renamed/deleted/moved by the DB migration.

## Media security and AWS constraints

The audit documents public object-read policies, an unbounded publication boundary for `derickgomez-images/*`, a legacy image-processing notification, and a potentially disruptive Deep Archive lifecycle rule for `standard/`. These are architectural inputs only; no AWS resource was queried or changed here.

Do not copy a draft/private reference to a publicly readable path or treat a database access check as object privacy. For historical URLs, preserve references and report them without fetching. Future private preview requires an authorized server endpoint and private storage origin; publication should create an explicitly reviewed public copy/manifest while preserving prior public paths. Unpublication must remove database visibility first and then coordinate CDN/object cleanup; downloaded copies and cached public URLs cannot be revoked retroactively. Follow the [private media proposal](infrastructure/PRIVATE_MEDIA_MIGRATION_PLAN.md) before any object movement.

## Idempotence, conflicts, and rollback

Use a source identity tuple `(source snapshot fingerprint, source schema, source table, source key, mapping version)` with unique constraints in a restricted migration ledger. Deterministic source keys plus immutable ledger entries make a retry repeatable. Compare target content hashes only in protected memory or via keyed digests when values are sensitive; publish aggregate pass/fail counts, not raw hashes of personal content. A changed source row for an already-mapped key is a conflict requiring explicit resolution, not an overwrite. Current local scripts stop before target persistence; generated candidate transforms do not authorize import or finalize unresolved route/timezone/privacy decisions.

Prepare the rollback by creating a disposable target branch/restore point after explicit approval, recording the target identity and restore evidence, and testing discard/recreation before importing. No row-by-row inverse delete is the rollback plan. Keep the source intact. No import is successful until reconciliation and rendering/authorization checks in [validation plan](PHASE3E_MIGRATION_VALIDATION.md) pass against the imported development data.
