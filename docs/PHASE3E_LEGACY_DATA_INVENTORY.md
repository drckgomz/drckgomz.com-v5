# Phase 3E legacy data inventory

**Status: owner-confirmed, read-only local inventory complete. No database was connected and no import was run.** The file was opened only at the exact path confirmed by the owner. The original was not modified. A non-executing parser emitted aggregate schema/count data only; no record values or credential values were written to logs. Sanitized machine output is in the Git-ignored `.artifacts/phase3e/backup-inspection.json`.

## Source and evidence boundaries

The source was `/Volumes/DEV-LAB/Projects/Private-Backups/db_cluster-15-06-2025@15-25-31.backup`. Independent Phase 3E inspection confirmed a 201,030-byte UTF-8 PostgreSQL plain-text cluster dump (server 15.8, pg_dump 15.13), not a custom-format archive despite the suffix. The source was a regular non-symlink file; size, modification time and inode remained stable for the read. Do not treat its filename/date as provenance or proof that it represents the current website.

The inspector parsed 1,014 top-level SQL statements, 31 explicit table definitions, 32 COPY blocks, and 175 serialized rows. Seven application tables account for 28 rows; provider-managed COPY relations account for 147 rows. Every COPY row matched its declared field count; all seven application PK fields were unique in serialized rows, and all five declared application FK relationships had zero orphan references. The two join tables had no duplicate populated parent/order pairs. These checks cover serialized rows only; they do not prove dump completeness, execute/restore integrity, or current-state parity.

## Reported application data

| Backup relation | Reported rows | Available fields and meaning | Status |
| --- | ---: | --- | --- |
| `public.content` | 6 | Integer ID, type, title, URL, description, order, created timestamp, thumbnail URL, optional media UUID | Candidate homepage sections and project records; semantics require review |
| `public.content_media` | 3 | UUID ID, integer content ID, media UUID, position, context label, created timestamp | Explicit ordered content-to-media relationships |
| `public.media` | 10 | UUID ID, URL, object key, caption, type, upload timestamp, context, title, order | Shared media catalogue; not the v5 per-post/per-project media table |
| `public.posts` | 2 | UUID ID, title, HTML content, views, create/update/delete timestamps, status, deletion date | Blog content; legacy status is `active`; source contains no slug, excerpt, author or audience field |
| `public.post_media` | 2 | Integer bridge ID, post UUID, media UUID, media order | Post-to-shared-media relationships |
| `public.users` | 2 | Integer ID, username, email, legacy admin/setup flags, profile color, UUID reference | Identity/profile candidates only; credentials are excluded from migration |
| `public.bug_reports` | 3 | Integer ID, description, naive timestamp | Exists in backup; product/retention decision unresolved |

Aggregate values inspected without emitting row data: six `content` rows have the known types `about`, `experience`, `hero`, `project`, `resume`, `skills` (one each); both serialized posts have status `active`; all ten `media.url` fields are HTTPS URLs. This establishes URL syntax only, not availability, ownership, public/private access, or that any S3 object still exists. Blog HTML's recognized media placeholders resolve within the serialized media set per the earlier audit; no current page was rendered from this historical content.

The backup audit reports 26 provider relations across Supabase auth, storage, realtime, pgsodium and vault. Its serialized nonempty rows are only provider migration histories: auth (61), realtime (60), storage (26). It reports empty COPY blocks for many auth/storage relations, but this does **not** prove those services were never used. Do not transplant provider DDL, roles, grants, RLS configuration, tokens, sessions or migration history into the application target.

## Existing website compatibility inventory

The current checkout uses these eight Supabase application tables, as observed in code and [database migration plan](DATABASE_MIGRATION_PLAN.md): `user_profiles`, `posts`, `media`, `home_sections`, `home_media`, `home_projects`, `home_project_media`, `terminal_commands`. The historical backup has only `posts` and `media` by name, with incompatible contracts. Their presence in the backup is not proof of current state.

| Existing feature | Backup evidence | Missing or incompatible evidence |
| --- | --- | --- |
| Homepage Hero/About/Skills/Experience/Contact/Resume | `content` has candidate type rows; content/media bridge exists | No current `home_sections`/`home_media` contract, typed section body, resume mode, verified order semantics, contact content shape, or complete homepage media mapping |
| Blog | Two posts, HTML, timestamps/status, media bridge | No slugs, excerpts, thumbnails, display dates, author IDs or public/private audience; v5 post-media child shape differs |
| Project index/detail routes | `content` includes project candidates and generic URLs/text/thumbnails | No `home_projects`/`home_project_media` contracts, verified modern slug/color/status fields or exact old route aliases |
| Media library | Ten shared media records with URL/key and three content links plus two post links | No object existence/access check; URL and key may be public or stale; source does not prove ownership, privacy, variants or S3 object inventory |
| Users and admin | Two legacy app user rows, UUID references, legacy `is_admin`/`needs_setup` | No verified Clerk subject, current profile state, owner, ban, enabled, whitelist/private grant, or safe credential portability |
| Terminal | None | No command registry, aliases, action payloads or authorization state |
| Categories/tags | None identified | No source tables or relationships identified |
| Bug reports | Three records | Current checkout has no corresponding route/table consumer; retain pending owner decision |
| Navigation/theme | None identified | Current website navigation and theme are code/config, not recovered database content |

“Missing” means absent from this snapshot or code-observed table mapping. It does not establish absence from a live Supabase database, another backup, S3, an external service, or a newer source. No current database or external system was inspected.

## Data that may have changed since this snapshot

No current Supabase snapshot was available or accessed, so row-level deltas cannot be established. The backup may omit posts created/edited after export, changed status/deletion dates, newly added or reordered media, changed project/homepage records, profile/role restrictions, and any newer terminal configuration. The legacy dump itself has no modern project/section or terminal tables. Its `updated_at` values can only describe the records serialized in that old snapshot; they cannot reveal whether newer records or edits exist elsewhere. The website source confirms newer **schema expectations**, not newer **database rows**. A separately authorized, current-v5 source snapshot and keyed reconciliation are required before deciding which content is authoritative; do not overwrite newer data with these historical rows.

## Preservation requirements

- Preserve legacy identifiers in a namespaced mapping ledger; do not cast integer user/content/join IDs into unrelated UUIDs or Clerk subjects.
- Carry original HTML, media placeholders, object URLs/keys, captions, metadata, source status, deletion markers, view counts, order values, and timestamps without silent normalization. Keep raw/source provenance alongside transformed values in restricted migration records.
- Generate a slug only in an explicit reviewed mapping step; report collisions and preserve the original route/identifier. Never assume no-slug content had no existing URL.
- Keep `active` posts quarantined/private until audience and deletion intent are explicitly reviewed. `active` does not mean public.
- Do not auto-publish candidate project/homepage records. Preserve navigation behavior and established v5 paths from a current data snapshot or code-defined route aliases; the old dump cannot establish all redirects.
- Do not fetch, move, rename or delete media objects during metadata migration. Record unavailable media as unresolved; do not substitute a broken/private URL with a guessed public path.
- Keep the original backup read-only, outside Git and out of generated reports. The audit reports credential-bearing user fields; no such values belong in migration logs or fixtures.

## Next evidence needed

1. Identify the authoritative current-v5 source separately. A historical backup is a recovery candidate, not a current-state cutover source.
2. Obtain decisions for post audience/status, naive timestamp timezone, homepage/project mappings, bug-report retention and identity proof before writing normalized production-shaped rows.
3. Obtain separate approval and verified disposable Neon development-branch identity before any connection/import. No migration success can be claimed until imported development data is validated.
