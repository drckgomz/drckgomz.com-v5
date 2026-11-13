# Overnight CMS migration candidates

Prepared only. **No SQL in this document or its referenced candidates has been applied.** These are review artifacts, not deployment-ready or runtime-certified migrations. The existing six Drizzle files, hashes, journal and snapshots remain unchanged.

- `scripts/phase8/local-private-audience.prepared.sql`: previously prepared capability management functions; still blocked pending explicit application and full live security/concurrency/audit tests.
- `scripts/phase8/local-media-metadata.prepared.sql`: adds media alt text/revision, owner-function SELECT/UPDATE policies, scoped grants, optimistic caption/title/alt update function and audit insert. It never updates storage URL/key/parent/order and never contacts S3.
- `scripts/phase8/local-cms-resources.prepared.sql`: adds project technology metadata and isolated draft/published site configuration storage, owner/public RLS policies, and owner-only read/write functions for Projects, Users and settings/home/navigation/appearance. It does not alter the owner assignment or existing post content/media mappings.

Both new candidates pin local database/operator/address/port/PG major and the exact six migration hashes. They check expected function/column/role state and are transactional with lock/statement timeouts. No apply runner exists.

## Live readiness boundary

The application checks function existence and EXECUTE privileges before rendering persistence controls or querying these repositories. Missing migrations return explicit 503/unavailable states. Client schemas and service tests are real, but a mocked repository is not evidence of a functioning database backend. No migration authorization can be inferred from passing tests.

## Mandatory review and tests before any application

1. Repeat the exact-target preflight and inspect all current columns, privileges, function ownership, role memberships and existing RLS policies. Review the complete SQL diff and confirm no role has BYPASSRLS or login as the definer owner.
2. Validate SQL syntax and behavior in an authorized disposable rehearsal environment, including partial-install/reapplication aborts. These candidates were statically reviewed, not executed. Do not silently change target guards or run them on the existing database as a syntax test.
3. Review direct function input validation, actor revocation/locking, concurrency and audit rollback. Apply the same strict validation at the database boundary as the application where public settings might otherwise receive invalid values. Public readers also revalidate published settings and fall back to canonical values on invalid data.
4. Project gallery organization currently accepts only media already bound to the same project. New gallery object upload/linking/removal needs a separate private/public storage contract. Delete refuses projects with gallery rows. No S3 objects are deleted.
5. User mutation must reject owner/self changes, role injection, unverified administrative grants, stale revisions, expired/revoked/disabled sessions and concurrent ownership changes. Retain the existing single-owner index; never bootstrap or transfer an owner to test this feature. Registration remains ordinary-member only.
6. Configuration writes must retain draft/published separation, reject secrets/unknown fields/executable URLs/CSS injection, preserve canonical CSS defaults, validate contrast, and leave admin navigation/auth/recovery independent of public navigation.
7. Exercise synthetic create/update/refresh/publish/unpublish/delete, media metadata conflicts, audit-event insertion and rollback-on-audit-failure. Compare original post/media/owner fingerprints before and after.
8. Synchronize the Drizzle schema and create a separately reviewed migration-manifest plan only after the candidate is approved. Adding future columns to current ORM models before migration application would break existing `select()` paths, so it was deliberately avoided.

Current API gateways: `/api/admin/media/[mediaId]/metadata` (GET/PATCH) and `/api/admin/cms/[section]` (GET/PUT). They authorize on the server and preserve same-origin/revision checks; they do not expose database credentials or privileged browser connections.

## Sprint approval checkpoint (2026-11-13; all remain unapplied)

New candidate: `scripts/phase8/local-post-metadata.prepared.sql` grants only `UPDATE(excerpt,date)` on `app.posts` to `drckgomz_local_owner`. No row writes, schema changes, functions, or RLS changes. Exact-target/hash/owner/RLS/previous-grant checks abort unexpected environments. This enables the new revision-checked metadata form; it does not enable taxonomy, featured images, slug changes, SEO overrides, or revision history.

Approval scope must name the exact files, individually or together:
- `scripts/phase8/local-post-metadata.prepared.sql`
- `scripts/phase8/local-private-audience.prepared.sql`
- `scripts/phase8/local-media-metadata.prepared.sql`
- `scripts/phase8/local-cms-resources.prepared.sql`

Target only: `127.0.0.1:55441/drckgomz_phase5_test`, operator `phase5_local`. Existing candidates affect audience capability functions/grants; media metadata columns/policies/audit function; project technology/gallery management, user role/profile grants/functions, and site configuration tables/policies/functions. The new grant increases the owner runtime's writable columns; older definer functions have broader authorization/concurrency risks and remain uncertified.

Before application: inspect current privileges/RLS/function ownership and exact SQL hashes; rehearse candidates in a separately authorized disposable database. Snapshot original three draft IDs/states/revisions/content hashes, media mappings, and owner/role counts. Verify synthetic saves/refresh/conflicts, owner denial, revoked sessions and audit rollback; compare preservation fingerprints afterward. No real account mutations. Metadata rollback: stop writes and revoke `UPDATE(excerpt,date)` from `drckgomz_local_owner`; this does not reverse saved values. Older candidates require a reviewed inverse migration or disposable-database snapshot restore; no rollback/application is authorized by this document.
