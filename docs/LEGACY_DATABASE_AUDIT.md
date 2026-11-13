# Legacy database audit

Phase 2A, 2026-11-11. Branch: `feat/cinematic-redesign`.

**Status: resumed inspection completed locally without executing SQL.** The earlier missing-file blocker is resolved. The backup contains useful legacy website schema and data, but is **not a drop-in v5 database** and is not verified as current production. Findings below supersede the earlier unavailable-file observations; the original planning structure is retained.

## File verification

Source: `/Volumes/DEV-LAB/Projects/Private-Backups/db_cluster-15-06-2025@15-25-31.backup`.

| Check | Verified observation |
| --- | --- |
| Readability | Opened read-only successfully; the previously missing path is now available |
| Actual format | UTF-8 plain-text PostgreSQL **cluster SQL dump**, not a custom-format archive despite `.backup` suffix |
| Size | 201,030 bytes, 5,919 lines |
| PostgreSQL headers | Source database version **15.8**; pg_dump tool version **15.13** in both database sections |
| Databases | Two connection sections: `template1` and `postgres`. No top-level CREATE DATABASE statements; all application tables/data are in the `postgres` section |
| Schemas | Nine explicit schema declarations: auth, extensions, graphql, graphql_public, pgbouncer, pgsodium, realtime, storage, vault; public is used without an explicit CREATE SCHEMA |
| Coverage | 1,014 top-level statements parsed; 31 explicit table definitions, 32 COPY blocks, 175 serialized rows; no top-level INSERT data statements |
| Table coverage | 33 table relations identified: 31 explicit definitions plus extension-managed pgsodium.key and vault.secrets COPY targets. realtime.messages has DDL but no COPY block |
| Integrity limit | Balanced non-executing lexical parse and COPY field-width validation passed; local file fingerprint remained stable. This does not prove restorable integrity, authenticity, export completeness or source environment |
| Tooling | Standard-library Python read/parse/count only; no PostgreSQL client invocation, installation, restore or SQL execution |

The file name is not proof of backup date or provenance. Provider objects establish a Supabase-style cluster layout, not ownership of a currently deployed v5 instance. Database connection directives were parsed as text and never followed.

## Verified forensic summary

| Evidence | Observation |
| --- | --- |
| Application tables | Seven public tables: bug_reports, content, content_media, media, post_media, posts, users; **28 serialized rows** |
| Provider tables | 26 relations identified across auth, realtime, storage, pgsodium and vault; **147 serialized rows**, all in three provider migration-history tables |
| Constraints | 31 declared primary keys, 9 named unique constraints, 20 FKs, 8 inline CHECK constraints across explicit definitions; extension-created definitions are not expanded in the dump |
| Indexes | 47 explicit CREATE INDEX statements; constraint-backed indexes are additional. Application has 2 explicit indexes plus 7 PK and 2 unique constraints |
| RLS | 24 explicit RLS-enable statements, including public.content and public.posts; **no CREATE POLICY statements**. No RLS-enable statements for the other five application tables |
| Routines and automation | 34 explicit function definitions, 2 row triggers, 6 event triggers and a vault view, all provider-scoped; no public application function/trigger definitions found |
| Roles/extensions | 16 role declarations; 7 extension declarations. Roles include bypass-RLS and superuser infrastructure privileges; these are not website administrator roles |
| Credentials / personal data | Nonempty bcrypt-like password verifiers and email fields in public.users; values not displayed or copied. No nonempty reset-token values in those serialized rows; auth-user/session/identity/MFA, vault and key COPY sections are empty |
| Core compatibility | Only posts/media names overlap current v5 tables, and both have incompatible column/relationship contracts. Six other v5 table names are absent |

Exact counts describe serialized COPY rows in this file only, not current database populations. Zero means an explicitly empty COPY block, except realtime.messages where **no COPY block is present**. No actual user identity, content body, credential, private URL or individual record digest is included.

## Non-executing inspection method and limits

Inspection used a local lexer handling comments, quoted identifiers, escaped strings, dollar-quoted function bodies, statement boundaries and COPY terminators. COPY values stayed in process memory; only structural metadata, aggregate validation results and counts were emitted. Every row matched its declared COPY column count. The following procedure remains the safety contract; archive branches were unnecessary for this plain-text file:

1. Open read-only; record file type/magic, size, modification time and fingerprint. Check for symlinks and whether the source changes during inspection. Never infer provenance solely from a filename or timestamp.
2. Identify text SQL, custom PostgreSQL archive, tar archive, compressed text, directory-format dump or an unsupported format from bytes. Decompress/parse as data only, with limits for expansion ratio, memory, statement size and runtime. Stop on unsupported/truncated input; do not run embedded commands or follow arbitrary archive paths.
3. For a PostgreSQL archive, a compatible `pg_restore --list` is a possible non-executing TOC inspection, **without a database target**. Capture/parse metadata through a sanitizer instead of printing raw output. Schema rendering to a parser, if later used, must likewise have no database target; SQL emission is not SQL execution. Tool availability/version compatibility still needs resolution.
4. For text/cluster dumps, use a non-executing lexer/parser that understands quoted identifiers, escaped/dollar-quoted strings, multiline statements, database boundaries and COPY data blocks. Never `source` the dump, feed it to psql, execute functions, honor shell meta-commands, or treat dump comments as instructions.
5. Collect only allowlisted structural fields: database/schema/table identifiers, column types/nullability, PK/FK/unique/check relationships, safe index structure, role names/privilege booleans/membership and extension names/versions. Review identifiers themselves for sensitive content before publication. Replace all string literals in defaults/checks/comments with descriptive placeholders when they could contain data or secrets. Do not emit function bodies, SECURITY DEFINER code, connection strings, role password clauses, foreign-server options, or large-object payloads.
6. Count COPY rows only in properly delimited data sections; do not display or retain cell values. Plain COPY text rows can often be counted exactly for that section; CSV multiline values need a CSV-aware parser, and INSERT tuples need a SQL-aware parser. Sum sections per database/schema/table; label unsupported segments and lower bounds rather than silently reporting exact totals. Archive TOC data entries alone do not establish row counts. Do not run SELECT/count SQL.
7. Record parser coverage, ambiguous/truncated sections, dump versions, dependency gaps and count confidence. A syntactically present table or data block does not establish restorable integrity. Any aggregate content/state statistics should avoid small-group disclosures.
8. Classify every discovered relation using schema dependencies, callers and ownership evidence, not names alone. Produce only a sanitized inventory in these documents; retain the original backup outside Git. Do not create a raw scratch copy or upload to a service.

The inspection must remain non-executing even if the dump contains CREATE DATABASE, CREATE ROLE, DO blocks, extension installation, event triggers, executable functions, program COPY, or shell/client meta-commands. Schema definitions are untrusted inputs too. A future clean target model should be handwritten/reviewed rather than restoring arbitrary legacy DDL.

## Classification rules

| Class | Evidence needed | Treatment |
| --- | --- | --- |
| Reusable | Verified source structure/meaning fits a required domain and safe target constraints | Preserve compatible fields and keys; validate data before accepting |
| Requires transformation | Useful domain with changed state, identifiers, JSON, auth linkage or media model | Explicit reviewed mapping and restricted reconciliation ledger |
| Obsolete | Confirmed retired feature with owner agreement and no remaining references | Exclude from active target only after review; preserve source, no deletion |
| Provider-managed | Confirmed PostgreSQL/provider service objects or adapter infrastructure | Do not transplant ownership, service roles or secrets into app schema; review any useful domain metadata separately |
| Unknown | Missing/ambiguous provenance, schema or dependency meaning | Quarantine from imports/privilege activation, retain evidence |

Supabase auth/storage/realtime and extension-owned objects are confirmed here. Application data is in public, but classification is based on dependencies and structure, not schema name alone. A provider-managed table can hold sensitive data; that class never implies permission to discard it. No table is classified obsolete without owner confirmation.

## Security implications

The backup **does contain confidential account and personal-content data**. public.users has populated password-verifier and email fields; its credential values match bcrypt-style encoding. Only presence/format was tested; no passwords were cracked or verified. The dump contains no detected role PASSWORD clauses, and its auth user/session/identity/MFA, vault secrets and pgsodium key COPY blocks are empty. This narrow observation does not make the file nonsensitive or establish that no other embedded secret could exist in free text, URLs or function bodies.

All seven public tables receive broad ALL grants to anon, authenticated and service_role. Only posts/content explicitly enable RLS; no policies are defined in the file. Thus an ordinary RLS-constrained role would be denied rows on those two tables absent other state, while the other five tables have no shown RLS protection against their grants. This is a **dangerous legacy configuration**, particularly for credential-bearing public.users; it is not proof that a live endpoint was reachable or that any disclosure occurred. Do not transplant these grants, infrastructure roles, function bodies or policies into Neon.

The users table contains legacy UUID-link fields but no FK to auth.users, whose COPY block is empty. These are not verified Clerk identities and must not become owner grants or login links automatically. Review exposure/credential remediation separately if this snapshot is confirmed to originate from a real deployment; no credentials were rotated and no provider state was contacted.

Keep the backup outside Git with restricted access. Documentation includes schema identifiers/types/counts only; defaults/index predicates are summarized or literal-redacted, and function bodies/record values remain excluded.

## Usefulness assessment and remaining questions

**Useful as a legacy content/schema recovery source, not a direct v5 restore.** Two posts, ten media records, two post-media links, six homepage/project content records and three content-media links are potential recovery material. Two legacy app accounts need verified enrollment, and three bug reports require a product/retention decision. No current-style user_profiles, home_sections/home_media/home_projects/home_project_media or terminal_commands table is present.

The posts use legacy status `active`, including the column default; this is not proof of public audience. Post HTML contains recognized media placeholders, whose recognized UUID references resolve to the serialized media IDs. All five declared application FK relationships have no orphaned nonnull serialized references; no duplicate parent/order pairs were found in the two join tables. These checks do not authenticate authorship or establish how the original UI enforced visibility.

Remaining questions: which environment generated this file; whether its apparent date is accurate; whether newer authoritative content/accounts exist; what `active` meant for readership; which section fields map to resume/project bodies; what timezone naive timestamps used; whether bug reports should return; and whether media objects still exist and are permitted for reuse. None requires a production connection in this phase.

See [SCHEMA_COMPARISON.md](SCHEMA_COMPARISON.md), [PROPOSED_DRIZZLE_SCHEMA.md](PROPOSED_DRIZZLE_SCHEMA.md) and [DATA_MIGRATION_STRATEGY.md](DATA_MIGRATION_STRATEGY.md). The following appendices are verified structural metadata, not raw SQL or data exports.

## Application columns, defaults and keys

All seven tables are owned by postgres in the dump. `NN` means NOT NULL; omitted means nullable. All legacy application timestamps below are **without time zone**. Default expressions are described, not replayed.

| Relation | Verified columns / types / nullability | Defaults and constraints |
| --- | --- | --- |
| public.bug_reports | id integer NN; description text NN; reported_at timestamp | id sequence default; reported_at now; PK id |
| public.content | id integer NN; type varchar(20) NN; title varchar(255); url text; description text; order_index integer; created_at timestamp; thumbnail_url text; media_id UUID | id sequence; created_at current timestamp; PK id; media_id FK media.id; singleton-type partial unique index |
| public.content_media | id UUID NN; content_id integer NN; media_id UUID NN; position integer; context_label text; created_at timestamp | id gen_random_uuid; position 0; context_label text default not reproduced; created_at current timestamp; PK id; content/media FKs |
| public.media | id UUID NN; url text NN; key text; caption text; type text; uploaded_at timestamp; context text; title text; order_index integer | id extensions.uuid_generate_v4; uploaded_at now; type string default withheld here; PK id named images_pkey |
| public.post_media | id integer NN; post_id UUID; media_id UUID; media_order integer | id sequence; PK id; nullable post/media FKs |
| public.posts | id UUID NN; title varchar(255) NN; content text NN; views integer; created_at timestamp; updated_at timestamp; deleted_at timestamp; status varchar(10); deletion_date timestamp | id extensions.uuid_generate_v4; views 0; created_at current timestamp; status active; PK id; no slug/author/audience constraint |
| public.users | id integer NN; username varchar(100) NN; password text NN; is_admin boolean; created_at timestamp; email varchar(255) NN; reset_token text; reset_token_expires timestamp; user_id UUID; needs_setup boolean; profile_color text | id sequence; is_admin false; created_at current timestamp; needs_setup true; color default not reproduced; PK id; unique username and email; **no user_id FK** |

Six public sequences are declared/owned: bug_reports_id_seq, content_id_seq, images_id_seq, post_media_id_seq, posts_id_seq, users_id_seq. Only bug_reports/content/post_media/users receive nextval column defaults. images_id_seq and posts_id_seq are integer sequences owned by UUID columns whose actual defaults use UUID functions; treat them as legacy artifacts, not dependencies to reproduce.

## Application relationships and index inventory

| Constraint | Relationship / behavior |
| --- | --- |
| content_media_content_id_fkey | content_media.content_id → content.id; ON DELETE CASCADE |
| content_media_media_id_fkey | content_media.media_id → media.id; ON DELETE CASCADE |
| content_media_id_fkey | content.media_id → media.id; default NO ACTION deletion/update |
| post_media_post_id_fkey | post_media.post_id → posts.id; ON DELETE CASCADE |
| post_media_media_id_fkey | post_media.media_id → media.id; ON DELETE CASCADE |

No explicit ON UPDATE override is shown. No application CHECK constraints or uniqueness constraint on join parent/order pairs is declared. idx_content_media_content_id is a nonunique btree on content_media.content_id. unique_single_type is a partial unique btree on content.type for about/skills/experience/hero/resume; project rows are not singleton-constrained. In addition, each application table has its PK and users has separate email/username unique constraints. No additional explicit public indexes appear in this file.

## All table relations, classifications and COPY counts

Counts are exact serialized rows for supported plain-text COPY blocks; `no block` is distinct from zero. Provider-managed extension-created tables do not have full CREATE TABLE definitions in this dump. No legacy table is confirmed obsolete.

| Database.schema.table (database postgres) | Primary classification | Rows | Evidence / reuse |
| --- | --- | --- | --- |
| public.bug_reports | Unknown | 3 | App feature recognized, future bug dashboard/retention undecided; preserve, do not auto-import |
| public.content | Requires transformation | 6 | Legacy homepage/project content; useful type vocabulary and text/media references |
| public.content_media | Requires transformation | 3 | Shared asset attachments to content |
| public.media | Requires transformation | 10 | Shared global media registry, not v5 child media table |
| public.post_media | Requires transformation | 2 | Many-to-many post/media bridge |
| public.posts | Requires transformation | 2 | Legacy HTML and IDs reusable; status active, no audience/slug |
| public.users | Requires transformation | 2 | Identity verification required; exclude credentials from content migration |
| auth.audit_log_entries | Provider-managed | 0 | Explicit table definition and COPY block |
| auth.flow_state | Provider-managed | 0 | Explicit table definition and COPY block |
| auth.identities | Provider-managed | 0 | Explicit table definition and COPY block |
| auth.instances | Provider-managed | 0 | Explicit table definition and COPY block |
| auth.mfa_amr_claims | Provider-managed | 0 | Explicit table definition and COPY block |
| auth.mfa_challenges | Provider-managed | 0 | Explicit table definition and COPY block |
| auth.mfa_factors | Provider-managed | 0 | Explicit table definition and COPY block |
| auth.one_time_tokens | Provider-managed | 0 | Explicit table definition and COPY block |
| auth.refresh_tokens | Provider-managed | 0 | Explicit table definition and COPY block |
| auth.saml_providers | Provider-managed | 0 | Explicit table definition and COPY block |
| auth.saml_relay_states | Provider-managed | 0 | Explicit table definition and COPY block |
| auth.schema_migrations | Provider-managed | 61 | Provider migration history, not application content |
| auth.sessions | Provider-managed | 0 | Explicit table definition and COPY block |
| auth.sso_domains | Provider-managed | 0 | Explicit table definition and COPY block |
| auth.sso_providers | Provider-managed | 0 | Explicit table definition and COPY block |
| auth.users | Provider-managed | 0 | Explicit table definition and COPY block |
| pgsodium.key | Provider-managed | 0 | Extension-managed COPY target; table DDL supplied by extension, not expanded here |
| realtime.schema_migrations | Provider-managed | 60 | Provider migration history, not application content |
| realtime.subscription | Provider-managed | 0 | Explicit table definition and COPY block |
| storage.buckets | Provider-managed | 0 | Explicit table definition and COPY block |
| storage.migrations | Provider-managed | 26 | Provider migration history, not application content |
| storage.objects | Provider-managed | 0 | Explicit table definition and COPY block |
| storage.s3_multipart_uploads | Provider-managed | 0 | Explicit table definition and COPY block |
| storage.s3_multipart_uploads_parts | Provider-managed | 0 | Explicit table definition and COPY block |
| vault.secrets | Provider-managed | 0 | Extension-managed COPY target; table DDL supplied by extension, not expanded here |
| realtime.messages | Provider-managed | no block | Partitioned parent defined; no row data section or child partitions identified |

Totals: 7 application relations / 28 rows; 26 provider relations / 147 rows; 33 identified table relations / 175 serialized rows. All nonempty provider rows are auth.schema_migrations (61), realtime.schema_migrations (60) and storage.migrations (26). Neither empty auth/storage sections nor absent objects prove those services were never used outside this snapshot.

## Provider roles, extensions and dependencies

Roles: anon, authenticated, authenticator, dashboard_user, pgbouncer, pgsodium_keyholder, pgsodium_keyiduser, pgsodium_keymaker, postgres, service_role, supabase_admin, supabase_auth_admin, supabase_read_only_user, supabase_realtime_admin, supabase_replication_admin, supabase_storage_admin. supabase_admin is declared SUPERUSER; postgres/service_role/supabase_read_only_user also have BYPASSRLS. Login/replication/role-creation powers and membership grants are provider infrastructure. None maps to the app's is_admin flag or to an approved owner role.

Extensions declared without pinned VERSION clauses: pgsodium in pgsodium; pg_graphql in graphql; pg_stat_statements, pgcrypto, pgjwt and uuid-ossp in extensions; supabase_vault in vault. Installed extension versions cannot be established from these declarations. Website UUID defaults reference uuid-ossp, while content_media uses gen_random_uuid. A clean Neon model need not preserve the provider extension bundle or its namespace-qualified defaults.

No public application enum is declared. Provider types include auth aal_level/code_challenge_method/factor_status/factor_type/one_time_token_type, and realtime action/equality_op plus user_defined_filter/wal_column/wal_rls composite types. Realtime publication and service/event-trigger automation are not website features to restore.

## Provider column metadata (explicit definitions)

All cells below omit literal defaults and values. Types/nullability are observed DDL; generated-column expressions are not reproduced.

| Table | Columns / types |
| --- | --- |
| auth.audit_log_entries | instance_id: uuid; id: uuid NN; payload: json; created_at: timestamp with time zone; ip_address: character varying(64) NN |
| auth.flow_state | id: uuid NN; user_id: uuid; auth_code: text NN; code_challenge_method: auth.code_challenge_method NN; code_challenge: text NN; provider_type: text NN; provider_access_token: text; provider_refresh_token: text; created_at: timestamp with time zone; updated_at: timestamp with time zone; authentication_method: text NN; auth_code_issued_at: timestamp with time zone |
| auth.identities | provider_id: text NN; user_id: uuid NN; identity_data: jsonb NN; provider: text NN; last_sign_in_at: timestamp with time zone; created_at: timestamp with time zone; updated_at: timestamp with time zone; email: text generated; id: uuid NN |
| auth.instances | id: uuid NN; uuid: uuid; raw_base_config: text; created_at: timestamp with time zone; updated_at: timestamp with time zone |
| auth.mfa_amr_claims | session_id: uuid NN; created_at: timestamp with time zone NN; updated_at: timestamp with time zone NN; authentication_method: text NN; id: uuid NN |
| auth.mfa_challenges | id: uuid NN; factor_id: uuid NN; created_at: timestamp with time zone NN; verified_at: timestamp with time zone; ip_address: inet NN; otp_code: text; web_authn_session_data: jsonb |
| auth.mfa_factors | id: uuid NN; user_id: uuid NN; friendly_name: text; factor_type: auth.factor_type NN; status: auth.factor_status NN; created_at: timestamp with time zone NN; updated_at: timestamp with time zone NN; secret: text; phone: text; last_challenged_at: timestamp with time zone; web_authn_credential: jsonb; web_authn_aaguid: uuid |
| auth.one_time_tokens | id: uuid NN; user_id: uuid NN; token_type: auth.one_time_token_type NN; token_hash: text NN; relates_to: text NN; created_at: timestamp without time zone NN; updated_at: timestamp without time zone NN |
| auth.refresh_tokens | instance_id: uuid; id: bigint NN; token: character varying(255); user_id: character varying(255); revoked: boolean; created_at: timestamp with time zone; updated_at: timestamp with time zone; parent: character varying(255); session_id: uuid |
| auth.saml_providers | id: uuid NN; sso_provider_id: uuid NN; entity_id: text NN; metadata_xml: text NN; metadata_url: text; attribute_mapping: jsonb; created_at: timestamp with time zone; updated_at: timestamp with time zone; name_id_format: text |
| auth.saml_relay_states | id: uuid NN; sso_provider_id: uuid NN; request_id: text NN; for_email: text; redirect_to: text; created_at: timestamp with time zone; updated_at: timestamp with time zone; flow_state_id: uuid |
| auth.schema_migrations | version: character varying(255) NN |
| auth.sessions | id: uuid NN; user_id: uuid NN; created_at: timestamp with time zone; updated_at: timestamp with time zone; factor_id: uuid; aal: auth.aal_level; not_after: timestamp with time zone; refreshed_at: timestamp without time zone; user_agent: text; ip: inet; tag: text |
| auth.sso_domains | id: uuid NN; sso_provider_id: uuid NN; domain: text NN; created_at: timestamp with time zone; updated_at: timestamp with time zone |
| auth.sso_providers | id: uuid NN; resource_id: text; created_at: timestamp with time zone; updated_at: timestamp with time zone |
| auth.users | instance_id: uuid; id: uuid NN; aud: character varying(255); role: character varying(255); email: character varying(255); encrypted_password: character varying(255); email_confirmed_at: timestamp with time zone; invited_at: timestamp with time zone; confirmation_token: character varying(255); confirmation_sent_at: timestamp with time zone; recovery_token: character varying(255); recovery_sent_at: timestamp with time zone; email_change_token_new: character varying(255); email_change: character varying(255); email_change_sent_at: timestamp with time zone; last_sign_in_at: timestamp with time zone; raw_app_meta_data: jsonb; raw_user_meta_data: jsonb; is_super_admin: boolean; created_at: timestamp with time zone; updated_at: timestamp with time zone; phone: text; phone_confirmed_at: timestamp with time zone; phone_change: text; phone_change_token: character varying(255); phone_change_sent_at: timestamp with time zone; confirmed_at: timestamp with time zone generated; email_change_token_current: character varying(255); email_change_confirm_status: smallint; banned_until: timestamp with time zone; reauthentication_token: character varying(255); reauthentication_sent_at: timestamp with time zone; is_sso_user: boolean NN; deleted_at: timestamp with time zone; is_anonymous: boolean NN |
| realtime.messages | topic: text NN; extension: text NN; payload: jsonb; event: text; private: boolean; updated_at: timestamp without time zone NN; inserted_at: timestamp without time zone NN; id: uuid NN |
| realtime.schema_migrations | version: bigint NN; inserted_at: timestamp(0) without time zone |
| realtime.subscription | id: bigint NN; subscription_id: uuid NN; entity: regclass NN; filters: realtime.user_defined_filter [] NN; claims: jsonb NN; claims_role: regrole NN generated; created_at: timestamp without time zone NN |
| storage.buckets | id: text NN; name: text NN; owner: uuid; created_at: timestamp with time zone; updated_at: timestamp with time zone; public: boolean; avif_autodetection: boolean; file_size_limit: bigint; allowed_mime_types: text []; owner_id: text |
| storage.migrations | id: integer NN; name: character varying(100) NN; hash: character varying(40) NN; executed_at: timestamp without time zone |
| storage.objects | id: uuid NN; bucket_id: text; name: text; owner: uuid; created_at: timestamp with time zone; updated_at: timestamp with time zone; last_accessed_at: timestamp with time zone; metadata: jsonb; path_tokens: text [] generated; version: text; owner_id: text; user_metadata: jsonb |
| storage.s3_multipart_uploads | id: text NN; in_progress_size: bigint NN; upload_signature: text NN; bucket_id: text NN; key: text NN; version: text NN; owner_id: text; created_at: timestamp with time zone NN; user_metadata: jsonb |
| storage.s3_multipart_uploads_parts | id: uuid NN; upload_id: text NN; size: bigint NN; part_number: integer NN; bucket_id: text NN; key: text NN; etag: text NN; owner_id: text; version: text NN; created_at: timestamp with time zone NN |

Extension-owned COPY columns are observed as follows: pgsodium.key has id, status, created, expires, key_type, key_id, key_context, name, associated_data, raw_key, raw_key_nonce, parent_key, comment, user_data; vault.secrets has id, name, description, secret, key_id, nonce, created_at, updated_at. Both sections are empty. Their column types/constraints remain extension-defined and unverified because table DDL is not expanded in this file. vault.decrypted_secrets is a view, not an additional table.

## Provider constraint and explicit index metadata

Literal predicates are redacted; this is a structural inventory, not executable SQL. Named CHECK identifiers containing spaces are generalized by the sanitizer. Application constraints/indexes are listed separately above.

| Kind | Sanitized structure |
| --- | --- |
| Constraint | `ALTER TABLE ONLY auth.mfa_amr_claims ADD CONSTRAINT amr_id_pk PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY auth.audit_log_entries ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY auth.flow_state ADD CONSTRAINT flow_state_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY auth.identities ADD CONSTRAINT identities_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY auth.identities ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE ( provider_id , provider )` |
| Constraint | `ALTER TABLE ONLY auth.instances ADD CONSTRAINT instances_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY auth.mfa_amr_claims ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE ( session_id , authentication_method )` |
| Constraint | `ALTER TABLE ONLY auth.mfa_challenges ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY auth.mfa_factors ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE ( last_challenged_at )` |
| Constraint | `ALTER TABLE ONLY auth.mfa_factors ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY auth.one_time_tokens ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY auth.refresh_tokens ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY auth.refresh_tokens ADD CONSTRAINT refresh_tokens_token_unique UNIQUE ( token )` |
| Constraint | `ALTER TABLE ONLY auth.saml_providers ADD CONSTRAINT saml_providers_entity_id_key UNIQUE ( entity_id )` |
| Constraint | `ALTER TABLE ONLY auth.saml_providers ADD CONSTRAINT saml_providers_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY auth.saml_relay_states ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY auth.schema_migrations ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY ( version )` |
| Constraint | `ALTER TABLE ONLY auth.sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY auth.sso_domains ADD CONSTRAINT sso_domains_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY auth.sso_providers ADD CONSTRAINT sso_providers_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY auth.users ADD CONSTRAINT users_phone_key UNIQUE ( phone )` |
| Constraint | `ALTER TABLE ONLY auth.users ADD CONSTRAINT users_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY realtime.messages ADD CONSTRAINT messages_pkey PRIMARY KEY ( id , inserted_at )` |
| Constraint | `ALTER TABLE ONLY realtime.subscription ADD CONSTRAINT pk_subscription PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY realtime.schema_migrations ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY ( version )` |
| Constraint | `ALTER TABLE ONLY storage.buckets ADD CONSTRAINT buckets_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY storage.migrations ADD CONSTRAINT migrations_name_key UNIQUE ( name )` |
| Constraint | `ALTER TABLE ONLY storage.migrations ADD CONSTRAINT migrations_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY storage.objects ADD CONSTRAINT objects_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY storage.s3_multipart_uploads_parts ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY ( id )` |
| Constraint | `ALTER TABLE ONLY storage.s3_multipart_uploads ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY ( id )` |
| Index | `CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree ( instance_id )` |
| Index | `CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree ( confirmation_token ) WHERE ( ( confirmation_token ) :: text ! ~ <literal> :: text )` |
| Index | `CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree ( email_change_token_current ) WHERE ( ( email_change_token_current ) :: text ! ~ <literal> :: text )` |
| Index | `CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree ( email_change_token_new ) WHERE ( ( email_change_token_new ) :: text ! ~ <literal> :: text )` |
| Index | `CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree ( user_id , created_at )` |
| Index | `CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree ( created_at DESC )` |
| Index | `CREATE INDEX identities_email_idx ON auth.identities USING btree ( email text_pattern_ops )` |
| Index | `CREATE INDEX identities_user_id_idx ON auth.identities USING btree ( user_id )` |
| Index | `CREATE INDEX idx_auth_code ON auth.flow_state USING btree ( auth_code )` |
| Index | `CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree ( user_id , authentication_method )` |
| Index | `CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree ( created_at DESC )` |
| Index | `CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree ( friendly_name , user_id ) WHERE ( TRIM ( BOTH FROM friendly_name ) <> <literal> :: text )` |
| Index | `CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree ( user_id )` |
| Index | `CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash ( relates_to )` |
| Index | `CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash ( token_hash )` |
| Index | `CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree ( user_id , token_type )` |
| Index | `CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree ( reauthentication_token ) WHERE ( ( reauthentication_token ) :: text ! ~ <literal> :: text )` |
| Index | `CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree ( recovery_token ) WHERE ( ( recovery_token ) :: text ! ~ <literal> :: text )` |
| Index | `CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree ( instance_id )` |
| Index | `CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree ( instance_id , user_id )` |
| Index | `CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree ( parent )` |
| Index | `CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree ( session_id , revoked )` |
| Index | `CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree ( updated_at DESC )` |
| Index | `CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree ( sso_provider_id )` |
| Index | `CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree ( created_at DESC )` |
| Index | `CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree ( for_email )` |
| Index | `CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree ( sso_provider_id )` |
| Index | `CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree ( not_after DESC )` |
| Index | `CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree ( user_id )` |
| Index | `CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree ( lower ( domain ) )` |
| Index | `CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree ( sso_provider_id )` |
| Index | `CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree ( lower ( resource_id ) )` |
| Index | `CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree ( user_id , phone )` |
| Index | `CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree ( user_id , created_at )` |
| Index | `CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree ( email ) WHERE ( is_sso_user = false )` |
| Index | `CREATE INDEX users_instance_id_email_idx ON auth.users USING btree ( instance_id , lower ( ( email ) :: text ) )` |
| Index | `CREATE INDEX users_instance_id_idx ON auth.users USING btree ( instance_id )` |
| Index | `CREATE INDEX users_is_anonymous_idx ON auth.users USING btree ( is_anonymous )` |
| Index | `CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree ( entity )` |
| Index | `CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_key ON realtime.subscription USING btree ( subscription_id , entity , filters )` |
| Index | `CREATE UNIQUE INDEX bname ON storage.buckets USING btree ( name )` |
| Index | `CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree ( bucket_id , name )` |
| Index | `CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree ( bucket_id , key , created_at )` |
| Index | `CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree ( bucket_id , name COLLATE C )` |
| Index | `CREATE INDEX name_prefix_search ON storage.objects USING btree ( name text_pattern_ops )` |
| Constraint | `ALTER TABLE ONLY auth.identities ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY ( user_id ) REFERENCES auth.users ( id ) ON DELETE CASCADE` |
| Constraint | `ALTER TABLE ONLY auth.mfa_amr_claims ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY ( session_id ) REFERENCES auth.sessions ( id ) ON DELETE CASCADE` |
| Constraint | `ALTER TABLE ONLY auth.mfa_challenges ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY ( factor_id ) REFERENCES auth.mfa_factors ( id ) ON DELETE CASCADE` |
| Constraint | `ALTER TABLE ONLY auth.mfa_factors ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY ( user_id ) REFERENCES auth.users ( id ) ON DELETE CASCADE` |
| Constraint | `ALTER TABLE ONLY auth.one_time_tokens ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY ( user_id ) REFERENCES auth.users ( id ) ON DELETE CASCADE` |
| Constraint | `ALTER TABLE ONLY auth.refresh_tokens ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY ( session_id ) REFERENCES auth.sessions ( id ) ON DELETE CASCADE` |
| Constraint | `ALTER TABLE ONLY auth.saml_providers ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY ( sso_provider_id ) REFERENCES auth.sso_providers ( id ) ON DELETE CASCADE` |
| Constraint | `ALTER TABLE ONLY auth.saml_relay_states ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY ( flow_state_id ) REFERENCES auth.flow_state ( id ) ON DELETE CASCADE` |
| Constraint | `ALTER TABLE ONLY auth.saml_relay_states ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY ( sso_provider_id ) REFERENCES auth.sso_providers ( id ) ON DELETE CASCADE` |
| Constraint | `ALTER TABLE ONLY auth.sessions ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY ( user_id ) REFERENCES auth.users ( id ) ON DELETE CASCADE` |
| Constraint | `ALTER TABLE ONLY auth.sso_domains ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY ( sso_provider_id ) REFERENCES auth.sso_providers ( id ) ON DELETE CASCADE` |
| Constraint | `ALTER TABLE ONLY storage.objects ADD CONSTRAINT objects_bucketId_fkey FOREIGN KEY ( bucket_id ) REFERENCES storage.buckets ( id )` |
| Constraint | `ALTER TABLE ONLY storage.s3_multipart_uploads ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY ( bucket_id ) REFERENCES storage.buckets ( id )` |
| Constraint | `ALTER TABLE ONLY storage.s3_multipart_uploads_parts ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY ( bucket_id ) REFERENCES storage.buckets ( id )` |
| Constraint | `ALTER TABLE ONLY storage.s3_multipart_uploads_parts ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY ( upload_id ) REFERENCES storage.s3_multipart_uploads ( id ) ON DELETE CASCADE` |

Eight inline CHECK constraints occur in provider auth definitions: nonempty token hash (1), SAML provider field checks (3), SAML relay request (1), SSO domain (1), SSO resource (1), and email-change confirmation range (1). No secret values or verifier contents are reproduced.
