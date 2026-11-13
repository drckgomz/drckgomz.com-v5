# Phase 5 — Legacy recovery status

## Evidence and limits

The exact authorized backup was inspected read-only in earlier Phase 3E work and reread by the same sanitized inspector during Phase 5A. It is a 201,030-byte UTF-8 PostgreSQL plain-text dump (PostgreSQL 15.8 / pg_dump 15.13), despite the `.backup` extension. Its previously reviewed SHA-256 fingerprint is unchanged. The inventory reports 1,014 top-level statements, 31 explicit table definitions, 32 `COPY` blocks and 175 serialized rows. The original file was not altered or executed.

The inventory identifies 28 application rows across seven legacy tables. Phase 3I's owner-reported development import staged 25 rows (all except three bug reports) plus provenance in restricted `legacy` tables. That prior result is historical evidence supplied by the owner; it was not reconnected to or reverified in this session. Nothing was imported by this phase.

The snapshot is dated and does not establish current website state. It is not safe to replace newer content with the dump. No report in this repository includes private post bodies, user contact data, credentials, passwords, session tokens or row-level personal details. The local importer emitted only counts and reconciliation outcomes.

## Recoverable content

- Two post rows and two post-media links, with UUIDs, HTML payloads, timestamps, deletion markers and legacy `active` status. The source has no slug or audience field.
- Six generic `content` rows and three `content_media` links, candidate homepage/project data whose old semantics do not map one-to-one to current routes.
- Ten shared media metadata rows. Their HTTPS URL syntax does not prove the referenced objects still exist or that they are safe to publish.
- Two inert legacy user/profile records. No legacy password, reset token, OAuth identity, session or admin flag is authority for a Better Auth account or role.
- Three bug reports, deliberately excluded from the reported 25-row stage pending a retention decision.

No categories/tags, terminal commands, modern audience groups, verified route aliases, or current production deltas were identified in that backup. “Not found in this snapshot” is not proof that the feature never existed elsewhere.

## Readiness

The current Drizzle schema has `legacy` staging/provenance tables from the previously applied base migrations, and the newer `app` schema can store normalized posts, media, homepage/project data, profiles, roles and audience records. This does not mean the legacy snapshot is ready to populate those public tables. `0004_sour_catseye.sql` adds audience and appearance tables but gives them no reader/writer grants and forces RLS, so those new areas remain deliberately unavailable pending a separately reviewed policy migration.

The reviewed source is now staged in a disposable local PostgreSQL 18 database. The importer preserves source IDs and timestamps in `legacy`, excludes credentials and bug reports, records provenance, and verifies each imported field without emitting row content. This does not authorize normalization into public application tables. Compare against current application data on a separately approved development branch before any normalized cutover. Preserve wall-clock timestamps until timezone semantics are approved, and keep active/unknown/deleted posts out of public routes.
