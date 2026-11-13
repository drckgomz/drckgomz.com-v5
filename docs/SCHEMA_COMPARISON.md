# Schema comparison: legacy backup, current v5 and proposed target

Phase 2A, 2026-11-11. **Resumed inspection verified a PostgreSQL 15.8 plain-text cluster dump (pg_dump 15.13).** It contains seven public application tables and 28 serialized application rows. Current v5 queries do not match that legacy contract. Structural metadata/counts below are observed in the backup; mappings and permission semantics remain proposals. No SQL was executed.

Reviewed existing plans: [architecture](ARCHITECTURE_AUDIT.md), [routes](ROUTE_MAP.md), [authentication](AUTH_EVALUATION.md), [database migration](DATABASE_MIGRATION_PLAN.md), [content/media](CONTENT_AND_MEDIA_AUDIT.md), and [redesign](REDESIGN_ROADMAP.md). Original documents remain unchanged. Current source was rechecked for Supabase queries, profile/role guards, API methods and terminal action schema.

## Evidence levels

- **Observed in source:** query strings, writes, local types, route methods and guards. These establish expected database contracts, not actual DDL or data counts.
- **Observed in backup:** 31 explicit table definitions, two additional extension-managed table COPY targets, 32 COPY blocks and 175 serialized rows across the postgres section; all table counts/classifications are in [LEGACY_DATABASE_AUDIT.md](LEGACY_DATABASE_AUDIT.md).
- **Proposed:** target schema, constraints and policies for review, not implemented.

## Table-by-table comparison

| Current v5 contract | Verified legacy evidence | Compatibility / required work |
| --- | --- | --- |
| user_profiles with Clerk text id, role/owner/whitelist/private/banned/enabled flags | **Absent.** public.users has 2 rows, integer id, UUID user_id, username/email/password/is_admin/needs_setup/profile_color | Not a Clerk profile table. No auth.users FK; serialized auth.users empty. Preserve IDs as namespaced references, map profile_color, verify identities and review grants; no credential copying |
| posts with UUID-like id, slug/title/excerpt/content/status/date/thumbnail/timestamps | public.posts: 2 rows, UUID id, title/content/views/created_at/updated_at/deleted_at/status/deletion_date | Names overlap but slug/excerpt/date/thumbnail absent. Status is active, not v5 audience vocabulary; generate reviewed slugs and retain deletion/views metadata |
| media as post child with post_id/type/url/caption/idx/title/created_at | public.media: 10 rows, UUID id, url/key/caption/type/uploaded_at/context/title/order_index; **no post_id/idx/created_at** | Shared registry requires post_media join; current nested select and child writes cannot work unchanged |
| home_projects and home_project_media | Both **absent**; content has project type, generic text/URL/thumbnail and content_media links | Recover candidate project content after field-meaning review; no exact modern project status/slug/color/body model |
| home_sections and home_media | Both **absent**; public.content has 6 rows covering hero/about/skills/experience/resume/project; content_media has 3 links | Content type→section key for known sections, preserve text/URL/thumbnail/media; body/crop/contact fields not established by current schema |
| terminal_commands | **Absent**; no equivalent structured command registry identified | No DB-backed terminal commands can be recovered from this file; maintain proposal as a new feature requiring another source or authoring |

These are the eight table names expected by current queries: only posts and media exist, and neither is a compatible drop-in. Missing table means absent from this inspected file, not absent from current production.

### Every legacy application table

| Legacy table | Rows | Classification | Reuse decision |
| --- | --- | --- | --- |
| public.bug_reports | 3 | Unknown | App-owned reports exist; feature/retention approval needed, not confirmed obsolete |
| public.content | 6 | Requires transformation | Recover sections and project candidates; partial unique type index explains singleton sections |
| public.content_media | 3 | Requires transformation | Useful explicit shared-asset attachments; convert parent/order/context |
| public.media | 10 | Requires transformation | Asset metadata reusable; retain url and key separately during review |
| public.post_media | 2 | Requires transformation | Post/media bridge, not an attribute on media; integer join ID distinct from UUID media ID |
| public.posts | 2 | Requires transformation | IDs/HTML reusable, publication meaning unresolved; preserve deletion/history fields |
| public.users | 2 | Requires transformation | Profile recovery candidates only until identity/privilege review; credentials excluded |

All 26 other identified relations are provider-managed; the full inventory includes explicit empty COPY blocks and the no-block realtime.messages parent in the legacy audit. No relation is confirmed obsolete and no whole application table is classified reusable unchanged; useful fields/content can still be reused after transformation.

## Relationships and constraints

| Relationship / key | Verified backup fact | Target consequence |
| --- | --- | --- |
| Legacy users.user_id | Nullable UUID, populated in serialized rows; no declared FK; auth.users COPY empty | Do not infer Clerk/Supabase ownership or link by email; namespace identity evidence and enroll after verification |
| post_media.post_id/media_id | Nullable UUID FKs to posts.id/media.id; both ON DELETE CASCADE | Current posts→media nested query must become explicit bridge join or repository mapping |
| content_media.content_id/media_id | Required integer/UUID FKs to content/media; cascade on parent deletion | Separate section/project attachments into catalog, preserving join provenance |
| content.media_id | Additional nullable FK to media.id with default NO ACTION; serialized values all null | Keep separate from multi-item gallery; avoid blindly duplicating attachments |
| Join integrity | No orphaned nonnull references in five application FK relationships; no duplicate parent/order pairs found in two join tables | Useful initial evidence only; future importer still validates nulls, order and completeness |
| Uniqueness | Seven public PKs; users username/email unique; no slug columns; no parent/order uniqueness | Review normalized names/slugs; do not copy missing or overbroad assumptions |
| Explicit indexes | idx_content_media_content_id; partial unique_single_type for about/skills/experience/hero/resume | Preserve intentional singleton section semantics, allow multiple project records |
| Status/deletion | posts.status defaults to active; serialized posts have active; deleted_at/deletion_date fields exist | Active audience unknown; deletion state preserved without automatic publication |
| Timestamps | Application timestamps are without time zone | Source timezone must be established; do not cast to UTC silently |
| UUID and sequences | UUID defaults use extensions.uuid_generate_v4 or gen_random_uuid; leftover integer sequences also owned by UUID columns | Clean target defaults, preserve UUID identities; do not recreate stale sequences |

Provider roles/grants, 24 RLS enables and no CREATE POLICY statements are observed, but do not establish live access. Broad ALL grants to anon/authenticated/service_role on all public tables are unsafe to copy, especially where RLS is not enabled. Provider-specific functions/extensions are not Neon application dependencies by default.

## Endpoint and feature impact

| Existing endpoints / views | Current behavior | Target contract / migration concern |
| --- | --- | --- |
| `/api/profile` GET; `/settings` | Clerk ID + enabled profile; settings calls nonexistent PUT | Provision durable app profile; implement writes only in a later authorized phase; bans/disabled checks centralized |
| `/api/admin/profile` GET | Stub returns null, no DB lookup | Not evidence of a separate profile table |
| `/api/admin/users`, `/me`, `/[id]` | Profile list/self/PATCH; accepted admin can patch owner flag | Separate identity lifecycle from app permission management; owner-only sensitive grants and last-owner protection |
| `/api/public/blogs` and `/[slug]`; `/blog*` | APIs permit draft/archive paths; pages require Clerk/profile; detail view searches first 25 list rows | Deny unpublished by default; exact-slug detail; explicit private readership and page membership decision |
| `/api/admin/posts`, `/[slug]` | CRUD, status and PATCH-create behavior | Stable IDs, author optional, atomic child operations, no accidental publishing on import |
| `/api/admin/posts/[slug]/media`, `/upload`, `/link`, `/reorder`; `/api/admin/media/[mediaId]` | Metadata, S3 upload, link and order/caption/delete | Preserve placeholder IDs; media privacy/finalization and source keys distinct from public URLs |
| `/api/home/projects`, `/[id]`, `/[id]/media`; project pages | APIs filter public; pages lack explicit status denial | Same state/audience predicate everywhere; old root and nested slugs maintained |
| `/api/admin/projects`, `/[id]`, child media endpoints | Edit/delete/list; no project create POST; destructive replace sequence | Typed transactional repository; future creation gap is a feature, not recovered schema evidence |
| `/api/admin/uploads/presign` | S3 upload signing only | No proof backup contains objects; metadata/object inventory separate |
| `/api/terminal/commands`; admin command collection/detail | Public enabled user commands include auth-required actions; browser role/rate checks | Server filtered actions; validated JSON/name aliases; shared rate enforcement |
| Homepage sections and ResumeModal | Server anonymous Supabase reads; browser resume query | Server-only Neon repositories; validated section bodies; keep resume variants |
| `/admin/home`, `/admin/bugs`, external `/v1` backend references | Home/bugs pages absent; external backend not in checkout | Legacy bug_reports is confirmed; no homepage editor model is present. Feature scope and retention still need owner review; absent routes do not prove obsolete |

The complete existing 25-handler map is in [ROUTE_MAP.md](ROUTE_MAP.md). No endpoint implementation or protection changed in this phase.

## New capabilities without a current observed table

Navigation revisions/items, theme revisions, homepage video publishing/revisions, central asset variants, application audit logs, identity migration reviews and explicit role/capability tables are **proposed additions**. No corresponding navigation/theme/homepage-revision/audit/command-registry table is identified in this backup. Conversely, legacy bug_reports and credential-bearing public.users **are confirmed**, along with empty provider auth/storage table data sections. Absence of current source callers does not make historical data obsolete.

## Legacy classification and evidence limits

The local structural inventory is now complete for this file: 7 app relations (6 require transformation, bug_reports unknown) and 26 provider-managed relations, including extension-managed COPY targets. No whole table is reusable unchanged and no table is confirmed obsolete. [LEGACY_DATABASE_AUDIT.md](LEGACY_DATABASE_AUDIT.md) records every identified table, explicit column metadata, counts, constraints, indexes, roles and extensions.

Only serialized counts and lexical/relational checks were performed. No restore, SQL execution, current database comparison, blob fetch or auth verification occurred. Extension-owned table DDL is not expanded, and a clean parse cannot establish export completeness or production provenance. The backup contains useful recovery material but cannot satisfy current v5 endpoints without new schema and data transformations.

The target design needs focused amendments: distinguish global media IDs from join/attachment IDs; preserve legacy deletion fields, optional view counts and naive timestamp provenance; namespace integer legacy user/content keys; explicitly quarantine active status; and make bug-report recovery a separate optional decision. Auth-owned/application-owned separation and the Neon/Drizzle direction remain appropriate proposals.
