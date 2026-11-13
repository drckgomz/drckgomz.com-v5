# Database migration plan

Date: 2026-11-11. **Proposal only. No connection, schema change, export, import or migration was performed.** Production access requires a future, explicitly approved phase.

## Code-observed schema

Column names below are observed in queries, payloads or local types. Database types, nullability, primary/foreign keys, unique constraints, defaults and indexes are **unverified**. JavaScript types and source comments are not database DDL. Additional provider-side tables, schemas, policies, functions and triggers may exist.

| Table | Observed columns | Relationships and usage |
| --- | --- | --- |
| `user_profiles` | id, email, username, first_name, last_name, avatar_color, role, enabled, is_owner, is_whitelist_admin, can_view_private, is_banned, banned_at, banned_reason, created_at, updated_at | `id` compared directly with Clerk userId; authentication-domain relationship, not a verified FK. Service-role reads for profile/auth/admin; update roles/grants/bans/owner flags |
| `posts` | id, slug, title, excerpt, content, status, date, thumbnail_url, created_at, updated_at | Parent for nested media; full admin create/read/update/delete. PATCH can create a missing slug. Status vocabulary in UI: public/private/draft/archived; DB constraints unknown |
| `media` | id, post_id, type, url, caption, idx, title, created_at | `post_id → posts.id` inferred from filters/nested PostgREST relationship; admin upload/link/caption/delete/reorder; ordered idx. `title` read by public detail but not consistently written |
| `home_sections` | key, title, description, thumbnail_url, body | Keys hero/about/skills/experience/contact/resume; anonymous server reads, direct browser resume read; body has flexible and sometimes string-encoded JSON |
| `home_media` | id, section_key, type, url, caption, idx | `section_key → home_sections.key` inferred by About filter; no FK proof; ordered About images |
| `home_projects` | id, idx, title, slug, excerpt, href, color, image_url, content, status, created_at, updated_at | Public list/detail APIs and two page patterns; admin list/read/update/delete, no create POST. Relationship to project media inferred from nested selects |
| `home_project_media` | id, project_id, type, url, caption, idx, meta, created_at | `project_id → home_projects.id` inferred; ordered media, append/replace, caption/order/meta editing and deletion |
| `terminal_commands` | id, name, aliases, description, actions, requires_auth, role, show_in_help, enabled, rate_limit_per_min, updated_at | Independent command registry, admin CRUD and public service-role read. Source says actions stored as text; writers stringify JSON and readers tolerate strings/arrays. Verify actual type/rows |

There are **eight** code-observed tables. No author/user FK is selected or written for posts/projects, so do not invent ownership relationships. No comments/tags/categories/revisions/analytics/bug-report tables are evidenced. No Supabase Storage metadata API calls, RPCs, realtime subscriptions, Edge Functions, or Supabase Auth login calls observed. Their absence from this repository does not prove absence in the provider.

## Access patterns to replace

- `lib/supabase/server.ts`: public-schema anonymous-key client, no request-user identity propagation. Used by homepage sections, project pages/APIs. Public access currently relies on unknown grants/RLS in addition to partial code predicates.
- `lib/supabase/client.ts` and wrapper `browserClient.ts`: singleton browser anonymous client; concrete direct browser query in `ResumeModal`.
- `lib/supabase/admin.server.ts` and repeated local `getSupabaseAdmin()` factories: service-role PostgREST access, bypassing ordinary RLS. Used in profiles, blog and admin; terminal public endpoint deliberately uses it due to an `app` schema permission issue described in a comment.
- Supabase nested selects (`posts → media`, `home_projects → home_project_media`) require equivalent joins/queries in Drizzle, preserving media order and list response shape.
- Mutations often issue separate requests: delete children then parent, determine max idx then insert, and resequence media. Project replace deletes before inserts. These are candidates for explicit SQL transactions and concurrency handling, not direct line-for-line rewrites.
- Lists are inconsistent: blog hard limit 25; projects offset/limit with exact count; terminal 1–500 limit; admin lists often unbounded. Preserve user-facing behavior initially while correcting pagination intentionally.

## Neon and Drizzle evaluation

Neon PostgreSQL plus Drizzle is a good candidate for this modest relational application: PostgreSQL content can retain IDs and relationships; explicit typed SQL can replace broad untyped PostgREST calls; migrations become reviewable repository artifacts. It also makes us responsible for server API access, connection behavior and permission enforcement currently split across Supabase and the app.

| Concern | Proposed approach | Dependency / risk |
| --- | --- | --- |
| App access | Server-only data services and typed Drizzle queries; browser uses same-origin APIs/server-rendered data | Never expose a database URL or replace anonymous Supabase with a browser PostgreSQL driver |
| Runtime driver | Node runtime; choose pooled PostgreSQL/WebSocket driver when interactive transactions are needed | HTTP single queries are attractive for reads, but auth adapters and transactional writes need proven driver semantics [1] |
| Connections | Bounded pooling/serverless lifecycle; region close to app runtime | Cold starts, connection limits and transaction-pool session-state limitations must be measured [2] |
| Migrations | Separate privileged migration credentials; reviewed generated SQL and migration ledger; no automatic production schema push | Source schema must first be known. Existing DB policy/functions/extensions may need manual SQL [3] |
| Authorization | Application capabilities plus least-privilege runtime database role; evaluate RLS for defense in depth | Drizzle is not an authorization engine; generic DB identity does not reproduce Clerk/Supabase request context |
| Storage | Retain existing S3 initially | PostgreSQL migration does not move objects or secure public URLs |
| Operations | Backups/restore rehearsal, monitoring, regional latency, retention and budget decisions | No plan/cost/account assumptions; choose service tier later |

Use Neon as the PostgreSQL replacement under evaluation; do not implicitly adopt other provider products. Supabase's combined services are not replaced by merely changing a connection URL. Current code suggests database work is the main Supabase coupling, but only a future schema/policy export can establish full scope. [Official Supabase migration guide](https://neon.com/docs/import/migrate-from-supabase).

## Target model — conceptual, not DDL

Initially preserve all eight legacy tables, original IDs, slugs, flags, timestamps, media IDs/keys and raw payloads. Add a separate authentication schema/model set required by the selected version of Better Auth or Auth.js. Recommended domain separation:

- Auth user/account/session/verification records, plus passkey records if approved.
- Application profile with durable ID and a unique new-auth-subject mapping; retain legacy Clerk ID. Do not overwrite Clerk subjects during a bulk text replacement.
- Identity migration ledger with source ID, target ID, verification/mapping state and reconciliation result; restrict access and avoid storing session tokens.
- Later, validated homepage configuration/revisions, theme settings and a media asset catalog. These are new product capabilities, not prerequisites for preserving content.

Confirm unique slugs/section keys, relationship FKs, `(parent_id, idx)` ordering strategy, date/timestamp semantics, indexes for status/date and project order, JSON/text normalization and status constraints after inspecting an authorized schema copy. Preserve raw malformed or double-encoded values for manual resolution. Do not guess UUID conversions for text identity fields.

## Proposed execution order and gates

| Step | Work in a future authorized phase | Exit gate |
| --- | --- | --- |
| 0. Policy and baseline | Approve status/capability matrix, record current behavior, fix urgent application leaks in a separate scoped change; choose versions and package manager | Permission tests pass on synthetic data; no removal of working guards |
| 1. Evidence acquisition | Owner-authorized schema-only export including grants/RLS/functions/triggers/extensions and later controlled content/account/object inventories; no such access now | Complete manifest, backups, privacy/retention rules and source version recorded |
| 2. Local model | Reproduce schema using synthetic data; generate reviewed Drizzle baseline; define repository/service interfaces while keeping Clerk | Existing response/ordering/visibility contracts tested without providers |
| 3. Isolated rehearsal | Provision only after separate approval; restore approved sanitized copy into isolated PostgreSQL/Neon, map extensions and policies | Row/relationship/hash/status reconciliation and restore rehearsal pass |
| 4. Database adapter | Implement Neon repositories behind a deliberate config switch while Clerk remains identity provider | Every section/profile/post/project/command and resume query accounted for; no mixed writes |
| 5. Database cutover | Separate production approval; backup, defined write freeze, final consistent copy/delta, reconcile, switch read/write target once | Agreed error/latency/privacy thresholds met; rollback available |
| 6. Authentication | Independently approved Better Auth/Auth.js enrollment rollout after database stability; use identity mapping and preserve restrictions | Owner recovery + account linking + session revocation + private-reader parity verified |
| 7. Product redesign | Build homepage editing/media model, video presentation and design system incrementally | Accessibility/content acceptance; route/slug continuity |
| 8. Retirement | Separate retention/decommission approval after observation and backup verification | No active legacy reads/writes; retained recovery path and content reconciliation |

Steps 1–8 are **not authorized or executed by this document**. Database-first allows Clerk IDs to continue working while data moves. Auth implementation can be explored locally after approval, but avoid simultaneous production database/auth cutover. Do not introduce two active authorities for permissions or uncoordinated dual writes.

## Entity preservation and verification

| Entity | Preserve / reconcile | Special failure handling |
| --- | --- | --- |
| Users | Profile fields, legacy subject, verified identity evidence, grants, owner and restrictions | No password portability assumption; enrollment/recovery and conflict review per auth evaluation; never delete unmatched accounts |
| Posts | IDs, slugs, raw HTML, status, date, excerpts, thumbnails, timestamps | Keep `[MEDIA … (id)]` references intact; content/row checksums and status counts; archived remains nonpublic by proposed policy |
| Projects | IDs/slugs, order, href/color, HTML, status, hero and media | Maintain old URL aliases until canonical route decision; no accidental publication |
| Homepage | Section keys, body raw data, crop values, text, About order and resume mode | Preserve encoding quirks before normalization; no guessed conversion losing content |
| Media | Media IDs, parents/order/captions/meta, object keys and external URLs | Build reference/object manifest; copy only after storage decision, compare checksums and permissions; no object deletion |
| Commands | Name/aliases/actions/flags/rate values | Preserve raw actions before parsing; validate known action schema and URL schemes; private actions must not leak in registry |
| Permissions | Ban/disabled/owner/whitelist/private flags | Compare effective capabilities for each mapped subject; deny ambiguous access pending owner review |

Acceptance requires source/target row counts by table and status, IDs and slugs, content hashes, orphan/duplicate reports, timestamps/JSON fidelity, media-reference parity, anonymous/private/blocked/admin test results, and explicit owner recovery. Establish actual counts later; no counts invented here.

## Cutover and rollback design

Prefer a short approved editorial write freeze over dual-write complexity. Define maintenance behavior for posts, grants and terminal edits, take a consistent final snapshot, validate before changing the data target, and maintain one writer. Pre-switch failure means abort with source unchanged. Post-switch failure means stop writes, preserve a target snapshot and reconcile any new writes before rollback; simply flipping back could lose content or bans.

Keep old provider data/configuration intact through an approved observation window. Define error/latency thresholds and owner-lockout/private-leak triggers before cutover; privacy failures require immediate containment. Database rollback and auth rollback are separate: new auth credentials/sessions cannot be assumed valid in Clerk. Backups must be restore-tested in isolation, not merely assumed available. Decommissioning, deleting accounts/objects or changing DNS/hosting is outside this plan's execution authority.

## Official references

1. [Drizzle Neon drivers and transaction distinctions](https://orm.drizzle.team/docs/connect-neon)
2. [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
3. [Drizzle migration workflows](https://orm.drizzle.team/docs/migrations)
