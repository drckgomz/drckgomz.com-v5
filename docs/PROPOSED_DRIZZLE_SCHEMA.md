# Proposed Neon / Drizzle schema

Phase 2A, 2026-11-11. **Design proposal only, now informed by verified legacy dump metadata as well as application source and the six Phase 1 plans.** No Drizzle package, schema module, migration, database connection or auth implementation was added. PostgreSQL types and relationships below are proposed, not extracted DDL.

## Forensic amendments to the existing proposal

**Focused changes are needed; the architecture does not need replacing.** The inspected dump has a shared public.media catalog, post_media/content_media bridges, generic content sections/projects and legacy integer app users. It does not contain current v5 profile/home/project/terminal tables. These observations strengthen the asset/attachment separation while changing import and preservation requirements:

1. Keep auth account/session/verification models owned by the selected library. The two public.users accounts are **not** verified Clerk identities; their populated password verifiers are not imported. Namespace legacy integer IDs and UUID links in ops identity review; no email-based automatic grants. Empty auth.users provides no linked-identity proof.
2. Preserve post UUIDs and media UUIDs, but do not equate media UUIDs, integer post_media join IDs and target attachment IDs. Legacy post HTML uses recognized UUID media placeholders. Map `(source dataset, post ID, legacy media ID)` to a target attachment; retain separate source join IDs. If a media asset is shared across posts, it must not force conflicting global attachment primary keys.
3. Add nullable `deleted_at` and `scheduled_deletion_at` preservation fields to posts; map legacy deletion_date only after its semantics/timezone are confirmed. Optionally retain nullable `legacy_view_count` as untrusted historic aggregate, **not** reconstructed audit events. No source author, public audience, slug or real publication time may be invented.
4. Legacy status **active remains unresolved** and imports as draft/private or quarantine pending owner review. Do not reinterpret active as public or treat created_at as published_at automatically.
5. Preserve original naive timestamp provenance and field meaning in the restricted import ledger before choosing a timezone conversion. The target remains timestamptz; no implicit timezone cast.
6. Retain both legacy media URL and key as source evidence during locator reconciliation; the one-locator target invariant applies only **after** an unambiguous canonical locator is approved. Do not discard context/title/order or guess derivatives exist.
7. Map content's known singleton types (hero/about/skills/experience/resume) to sections; project type to project candidates. content.description/url/thumbnail_url and direct media_id have different meanings from multi-item content_media; no source body JSON/crop/navigation/theme configuration exists to copy.
8. Add optional bug-report recovery as a separate scope decision below. No terminal command table was found; the existing command model remains a new authored capability, not recovered data.

All are proposal changes, not implemented DDL. No library version, provider setup or runtime behavior was changed.

## Boundaries and rollout

Keep three logical namespaces: `auth` for the selected library's adapter tables, `app` for website data and permissions, and `ops` for restricted migration bookkeeping. Physical names/schema mapping depend on the pinned adapter's support; logical ownership matters more than forcing a particular schema name. Runtime code uses server-only repositories and an explicitly selected transaction-capable Neon/Postgres driver. No database URL belongs in browser code.

First preserve compatible source tables/IDs behind typed repositories, as proposed in [DATABASE_MIGRATION_PLAN.md](DATABASE_MIGRATION_PLAN.md). The normalized model below is a **later target**, not a reason to combine provider cutover and content transformation. Keep existing API response shapes with mappers during rollout; schema renames are not an API migration by themselves.

Conventions:

- New application-user, configuration, asset and audit IDs: PostgreSQL UUID. Content IDs that must survive existing links/placeholders: text initially, preserving exact source IDs; new values can be generated UUID strings. Revisit only after actual source types are known.
- All timestamps: timezone-aware `timestamptz` with explicit source timezone review. Do not guess date-only values into timestamps; preserve legacy display dates separately.
- Mutable entities carry `created_at`, `updated_at`, and an integer `version` for optimistic writes. Defaults do not update timestamps automatically; define service behavior explicitly.
- Prefer checked text state values initially over native enums to simplify controlled evolution. Drizzle `text({enum: ...})` typing and `$type<T>()` alone do not enforce database checks or runtime JSON validity.
- Delete content deliberately, generally archive/soft-delete first; use RESTRICT on valuable cross-entity references. No cascade may erase users, posts, media objects or audit history as an incidental account deletion.

## Authentication-owned models

Choose **one** adapter schema, not both. This section describes responsibilities, not exact generated columns. Verify names, required indexes and plugin additions against the selected release before generating reviewed SQL.

| Logical table | Purpose | Ownership / restrictions |
| --- | --- | --- |
| `auth.user` | Authentication identity, verified login address and library profile fields | Library owns account lifecycle; app must not treat email as durable person ID |
| `auth.account` | Unique provider + provider-subject association; credentials representation where supported | Authentication-owned secret-bearing data; never importer output or public API data |
| `auth.session` | Server sessions, expiry and revocation | Auth service only; never import old sessions |
| `auth.verification` or `auth.verification_token` | Verification/recovery challenge state, adapter-specific | Ephemeral, never legacy-content migration input |
| `auth.passkey` / `auth.authenticator` | WebAuthn public credential metadata and counters if approved/supported | Fresh enrollment by verified owner; do not assume legacy portability |
| Optional auth plugin models | Selected MFA/admin/plugin fields | Generate only when required; no speculative production DDL |

Auth IDs remain adapter-compatible **text**, with no UUID assumption. Password verifiers, provider tokens, challenge secrets and sessions stay solely within authentication-owned storage and are never copied into migration docs, logs or `app.users`. A Drizzle schema must reproduce the selected adapter's exact uniqueness/FKs rather than this conceptual list.

## Users, identity mapping and authorization

| Table | Proposed fields | Constraints / indexes / semantics |
| --- | --- | --- |
| `app.users` | id UUID PK; display_name, username, first_name, last_name, avatar_color text nullable; enabled boolean default false; banned_at timestamptz nullable; ban_reason text nullable; timestamps/version | Never includes password/session/token fields. Ban reason is restricted PII. New users enabled only through explicit provisioning policy; imported enabled state is reviewed. Normalized username unique only if required and duplicates resolved |
| `app.auth_links` | id UUID PK; user_id UUID FK users; provider_namespace text; subject text; verified_at nullable | Unique(namespace,subject), index(user_id); RESTRICT delete. Transitional namespaces support Clerk and selected new auth source. Verified new-auth link must point to an existing auth user; enforce via FK to selected auth table where practical, otherwise a reviewed transaction/integrity check. Do not silently link by email |
| `app.user_roles` | user_id UUID FK; role text; granted_by UUID nullable; granted_at timestamptz | PK(user_id,role); check role in owner/content_admin/whitelist_manager; index(role,user_id). Roles are application-owned, not OAuth claims |
| `app.user_capabilities` | user_id UUID FK; capability text; granted_by UUID nullable; granted_at | PK(user_id,capability); initial allowlist private_blog.read. Supports private readers without making them administrators |

Role meanings are proposed: owner assigns privileged roles; content_admin edits/previews content; whitelist_manager manages private-reader grants without automatically reading private posts. Preserve original role/owner/whitelist flags in restricted reconciliation data outside Git. Owner changes require fresh auth and transactional last-active-owner protection; a row CHECK cannot enforce that cross-row invariant. Revoke sessions or force fresh permission reads after bans/disable/role changes.

If Better Auth admin plugin is selected, decide before implementation whether plugin identity bans mirror app restrictions or app restrictions remain the sole site-access gate. Do not maintain two independently editable ban/role sources. Disable unneeded impersonation. Auth-related display fields may need a documented projection; authentication email verification must remain with the library.

## Blog and projects

Use **separate** publication state and audience; do not overload public/private as editorial states.

| Table | Proposed fields | Constraints / indexes |
| --- | --- | --- |
| `app.posts` | id text PK; slug text; title text; excerpt nullable; content_html text; publication_state text default draft; visibility text default private; published_at timestamptz nullable; display_date date nullable; deleted_at timestamptz nullable; scheduled_deletion_at timestamptz nullable; legacy_view_count integer nullable; thumbnail_asset_id UUID nullable FK assets; author_user_id UUID nullable FK users; timestamps/version | Unique normalized slug; nonempty title/slug; states draft/published/archived; audience public/private; index(state,visibility,published_at,id). Author is optional: current queries do not establish authorship; never invent a source author |
| `app.projects` | id text PK; slug nullable; title; excerpt nullable; content_html; href nullable; accent_color nullable; sort_order integer; state default draft; visibility default private; hero_asset_id UUID nullable FK; timestamps/version | Unique normalized nonnull slug; state/audience checks; index(state,visibility,sort_order,id). Preserve id-based fallback and legacy root URLs via route mapping |
| `app.post_media` | id text PK; post_id text FK posts; asset_id UUID FK; source_media_id text nullable; caption nullable; sort_order integer | Preserve attachment and source-media identity separately; parent-scoped legacy placeholder map and separate source join provenance. Index(post_id,source_media_id); resolve duplicate references before any uniqueness decision. FK indexes; unique(post_id,sort_order), nonnegative order. FK parent and asset RESTRICT; explicit transactional removal |
| `app.project_media` | id text PK; project_id text FK; asset_id UUID FK; caption nullable; sort_order integer; metadata jsonb | Parent/index/order checks as above; metadata shape validated |
| `app.content_routes` | path text PK; target_kind checked post/project; post_id nullable FK; project_id nullable FK; route_behavior checked canonical/redirect | Exactly one target; kind must match nonnull target. Resolve authorization before redirect/render; retain old paths without exposing unpublished titles |

Status mapping is a proposal requiring approval: public → published/public, private → published/private, draft → draft/private, archived → archived/private. Verified legacy active and all unknown/null/unrecognized states are quarantined/nonpublic; do not silently default them to published. Historical archived audience is unknown: preserve original status in the restricted ledger rather than inferring former visibility.

Soft-deleted or deletion-pending recovered content remains nonpublic until reviewed. Deletion timestamps do not authorize an automated hard-delete job. Private reader access is only to published/private; drafts and archives require explicit editorial capability. Anonymous access is published/public only. Blog page membership policy remains a separate route decision. Disabled/banned users are denied protected content before evaluating grants. Public project pages use the same published/public predicate as APIs; media delivery checks its parent as well as asset policy.

Slug normalization needs a reviewed Unicode/case policy and collision report before adding constraints. Parent/order unique constraints may need reviewed deferrable SQL or collision-safe transactional reorder; Drizzle relation declarations alone create no FK or deferred uniqueness.

## Media and files

| Table | Proposed fields | Constraints / indexes |
| --- | --- | --- |
| `app.assets` | id UUID PK; kind text (image/video/audio/document/embed/link); origin text (object/external); provider/bucket/object_key text nullable; external_url text nullable; mime_type nullable; byte_size bigint nullable; checksum nullable; width/height integer nullable; duration_ms bigint nullable; alt_text nullable; title nullable; access_class text; ingest_state text; created_by UUID nullable FK; timestamps/version | Exactly one locator family. Object requires provider/bucket/key, external requires URL; unique(provider,bucket,key) for object origin. Nonnegative sizes/dimensions/duration; access public/private/editorial; state pending/ready/rejected/missing. Original locators can be sensitive and are not audit output |
| `app.asset_variants` | id UUID PK; asset_id FK; variant_key text; provider/bucket/object_key; mime_type; dimensions/size/checksum nullable | Unique(asset_id,variant_key), unique storage locator; variants inherit access limits. MP4/WebM/poster/image widths are explicit rather than guessed |
| `app.home_section_media` | id text PK; section_key text FK home_sections; asset_id UUID FK; caption nullable; sort_order | Preserve old home media IDs; unique(section_key,sort_order), indexed FKs |

DB stores metadata only, not video blobs. Keep S3 initially. No deletion trigger calls storage. Attachments inherit at least their parent's restriction; a public object cannot become private from a row change. Prevent reusing public objects for protected attachments until approved private delivery exists, or create a protected copy later. A private post thumbnail must also be protected. External embeds cannot be guaranteed private by this site.

Use explicit post/project/home relationships rather than a universal attachment table with an unenforceable polymorphic FK. Terminal action JSON and configuration JSON may reference assets but require application validation/reconciliation; optional `app.command_assets(command_id,asset_id)` provides indexed integrity for terminal references. Upload signing/finalization and object reconciliation are future implementation work.

## Homepage, navigation and appearance

| Table | Proposed fields | Constraints / indexes |
| --- | --- | --- |
| `app.home_sections` | key text PK; title nullable; description nullable; body jsonb; schema_version integer; sort_order; enabled boolean; timestamps/version | Preserve keys hero/about/skills/experience/contact/resume. Runtime discriminated schemas per key; import raw double-encoded body only after validated conversion |
| `app.homepage_revisions` | id UUID PK; revision integer; state draft/published/archived; intro/title text; video_asset_id/poster_asset_id UUID nullable FK; hero_crop jsonb; settings jsonb; created_by nullable FK; created_at | Unique revision; video/poster type/readiness/public-policy validation; crop x/y bounds and zoom defined; no arbitrary script/CSS |
| `app.navigation_revisions` | id UUID PK; revision integer; created_by nullable FK; created_at | Immutable after activation; unique revision |
| `app.navigation_items` | id UUID PK; revision_id FK; parent_id nullable UUID; label text; internal_path nullable; external_url nullable; sort_order; visibility checked public/member/admin | Exactly one destination. Composite FK(parent_id,revision_id) to (id,revision_id) prevents cross-revision parents; unique(id,revision_id); transactional acyclic-tree check. Item visibility hides UI only, never secures destination |
| `app.theme_revisions` | id UUID PK; revision integer; tokens jsonb; schema_version; created_by nullable FK; created_at | Curated typed colors/fonts/spacing/radius/motion; schema validation and safe value allowlists; no executable settings |
| `app.site_configuration` | key text PK; homepage_revision_id, navigation_revision_id, theme_revision_id UUID FKs; updated_at/version | Singleton key=primary. Atomic activation of reviewed revision references; retain prior revisions for rollback |

Draft revision previews require editorial capability and no public caching. Published homepage must refer only to ready/public assets. Section changes initially remain independent; if atomic section-level publishing is required, add revision-keyed sections/media rather than pretending the initial mutable sections model is immutable. Resume configuration retains pdf/docx/text modes until owner approves any format change.

Navigation/theme configuration has **no observed source table** in current code; these are new capabilities, not confirmed legacy recoveries.

## Terminal commands

| Table | Proposed fields | Constraints / indexes |
| --- | --- | --- |
| `app.terminal_commands` | id text PK; description; actions jsonb; actions_version integer; requires_auth boolean default true; required_capability nullable text; show_in_help boolean default false; enabled boolean default false; rate_limit_per_min integer default 0; timestamps/version | JSON must be array with validated print/navigate/openUrl/audio/video/gallery actions; nonnegative rate; index(enabled,updated_at,id). Auth-required is not encoded solely in a UI flag |
| `app.command_names` | normalized_name text PK; command_id text FK; is_primary boolean | Unique primary name per command using partial unique index; primary/aliases share one namespace so aliases cannot shadow another command; locale/case normalization specified before import |
| Optional `app.command_assets` | command_id + asset_id FKs | Composite PK; reliable media reference inventory instead of relying only on JSON traversal |

Use capability checks on the server before returning restricted actions. Public help data excludes sensitive action payloads even if a command name is discoverable. Rate limits in command rows are policy, not enforcement; shared server enforcement remains necessary. Keep arbitrary executable code and SQL out of actions. Asset-ID based actions need a compatibility mapper for existing src URLs; preserve validated raw actions privately during staged conversion.

## Audit and migration provenance

| Table | Proposed fields | Constraints / indexes |
| --- | --- | --- |
| `app.audit_events` | id UUID PK; occurred_at timestamptz; actor_user_id UUID nullable FK; action code; entity_type; entity_id nullable text; outcome; request_id nullable; sanitized_metadata jsonb | Index(time), (actor,time), (entity_type,entity_id,time). Append-only runtime grants; restricted readers/retention. Never log HTML, user email, tokens, credentials, dump records, recovery links or arbitrary request bodies; identifiers themselves require access control |
| `ops.migration_runs` | id UUID PK; source fingerprint; source_label; phase; status; tool/parser version; started_at/completed_at; aggregate counts | No backup payloads. Private operational storage, not a Git artifact or public API |
| `ops.legacy_entity_map` | run_id FK; source_database/schema/table; source_key text; target_kind; target_id text; reconciliation_state | Unique(run_id,source relation,source_key); source IDs restricted. Target type checks via import/service validation or per-entity typed maps; do not claim polymorphic FK integrity |
| `ops.identity_review` | run_id FK; source_identity_reference; candidate_app_user_id nullable FK; review_state; reviewer nullable FK; reviewed_at | No passwords, hashes, tokens or raw user snapshots. Unmatched identities remain unresolved rather than deleted/auto-merged |

Audit role/content changes atomically with the application transaction; library auth events may require explicit hooks and delivery failure handling. A public export of the audit log is not proposed. SQL roles and application roles are different: a runtime database principal is not a website owner.

## Illustrative Drizzle notation

This handwritten fragment is an **uncompiled design example**, not extracted SQL, a migration, or a complete module. No dependency version is selected. Auth tables are intentionally omitted because the chosen adapter owns their exact shape.

```ts
// Documentation only: illustrative Drizzle pg-core notation.
const app = pgSchema("app");
const users = app.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  enabled: boolean("enabled").notNull().default(false),
  bannedAt: timestamp("banned_at", { withTimezone: true }),
});
const posts = app.table("posts", {
  id: text("id").primaryKey(), // preserve source IDs first
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  state: text("publication_state").notNull().default("draft"),
  visibility: text("visibility").notNull().default("private"),
  authorId: uuid("author_user_id").references(() => users.id, {
    onDelete: "restrict",
  }),
});
// Full proposal above also requires unique/check/index definitions,
// timestamps, content columns, assets and all other tables.
```

Do not install/generate from this snippet. During a later approved implementation, map camelCase properties to stable snake_case SQL names, generate reviewed migrations, express actual FKs/indexes/checks, review any handwritten SQL (partial/deferrable indexes and grants), and verify transaction behavior. Never run a schema push at application startup.

## Better Auth versus Auth.js — decision implications

This carries forward the assessment already recorded in [AUTH_EVALUATION.md](AUTH_EVALUATION.md); **no network requests, provider checks or fresh release verification were performed in Phase 2A**. Treat version-dependent features as evaluation inputs to revalidate later.

| Topic | Better Auth direction | Auth.js direction |
| --- | --- | --- |
| Passwords and recovery | More integrated lifecycle with application-supplied mail delivery | Credentials path entails more application-owned persistence/verification/reset work |
| GitHub/Google | Candidate provider integrations; exact scopes/linking/callbacks must be proven | Also candidate provider integrations; provider subject mapping still required |
| Passkeys | Plugin schema, enrollment and recovery review | Prior audit records experimental support; revalidate selected version/adapter before committing |
| Sessions | Prefer library database-backed sessions with explicit expiry/revocation | Choose and prove strategy, particularly Credentials compatibility; do not assume JWT and DB sessions are interchangeable |
| Admin roles | Plugin may help identity administration; website capabilities remain app-owned | Application callbacks/services own role policy |
| Schema impact | Adapter base models plus selected plugin additions | Adapter models plus chosen auth method requirements |

Provisional preference remains Better Auth; Auth.js is viable if an OAuth-first model and additional account-lifecycle work are acceptable. Finding legacy bcrypt-style verifiers does not change this recommendation or establish identity ownership. Neither library can establish dump provenance, infer owners or directly convert Clerk credentials. No library is selected or implemented here.

## Approval questions

Approve identity mapping/role policy; the state-versus-audience split; stable text content IDs; section/revision scope; whether optional command asset tracking is warranted; privacy/retention policy; and the auth prototype direction. Backup metadata is now inspected; defer final DDL/casts until timezone, identity, audience and field semantics are approved. The dump declares a Supabase extension bundle, but the target does not need that bundle merely to preserve UUIDs. See [LEGACY_DATABASE_AUDIT.md](LEGACY_DATABASE_AUDIT.md) for verified facts and remaining provenance limits.

## Optional legacy bug reports and import provenance

The backup contains 3 public.bug_reports rows with integer id, required description and naive reported_at. No current in-repository dashboard/API consumes them. Classification remains unknown pending owner approval; do not mark obsolete or publish their text.

If recovery is approved, propose `app.bug_reports`: new UUID PK, restricted description text, reported_at timestamptz nullable, review_state checked new/triaged/closed, optional reporter UUID FK, and timestamps/version. Index(state,reported_at,id). Keep source integer ID/dataset in the restricted ops entity map; do not fabricate reporter identity or response history. If recovery is declined, preserve source outside Git with approved retention, not deletion. No table is added to the running application here.

For all transformed entities, migration maps must distinguish the **historical backup dataset** from any future current-v5 snapshot. The same unqualified table name does not mean the same schema/version or person. Legacy audit_log_entries/migration-history tables are provider data and are not sources for fabricated app.audit_events.
