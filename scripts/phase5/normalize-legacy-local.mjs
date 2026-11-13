#!/usr/bin/env node
import { createHash } from "node:crypto";
import pg from "pg";
import { validateMigrationArtifacts } from "./validate-migrations.mjs";

const ROOT = process.cwd();
const SOURCE_FINGERPRINT = "1d9aa9083a77af25752d167d928ed4e23297a8a38660743e4536035f00639add";
const SOURCE_MAPPING = "phase3i-legacy-stage-v1";
const MAPPING_VERSION = "phase5-normalize-v3";
const PREVIOUS_MAPPING_VERSION = "phase5-normalize-v2";
const EXPECTED = Object.freeze({ host: "127.0.0.1", port: 55441, database: "drckgomz_phase5_test", user: "phase5_local", major: 18 });
const URL = "postgresql://phase5_local@127.0.0.1:55441/drckgomz_phase5_test?sslmode=disable";
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const apply = args.includes("--apply-local-content");
if (args.some((arg) => !["--apply-local-content", "--dry-run"].includes(arg)) || (apply && args.includes("--dry-run"))) {
  fail("arguments", "unsupported-or-conflicting-mode");
}

const artifacts = validateMigrationArtifacts(ROOT);
if (artifacts.migrationCount !== 6) fail("migration-check", "unexpected-migration-count");
const pool = new pg.Pool({ connectionString: URL, max: 1, connectionTimeoutMillis: 3000, idleTimeoutMillis: 5000 });
let client;
let transaction = false;
let phase = "connect";
try {
  client = await pool.connect();
  phase = "identity";
  const identity = (await client.query("select current_database() as database, current_user as role, current_setting('server_version_num')::int / 10000 as major, inet_server_addr() = '127.0.0.1'::inet as loopback")).rows[0];
  if (identity.database !== EXPECTED.database || identity.role !== EXPECTED.user || identity.major !== EXPECTED.major || identity.loopback !== true) fail("identity", "local-target-mismatch");

  phase = "migration-history";
  const expectedHashes = artifacts.migrationHashes;
  if (!Array.isArray(expectedHashes) || expectedHashes.length !== 6) fail(phase, "migration-manifest-invalid");
  const ledger = (await client.query("select hash from drizzle.__drizzle_migrations order by created_at asc")).rows.map((row) => row.hash);
  if (JSON.stringify(ledger) !== JSON.stringify(expectedHashes)) fail(phase, "applied-migration-history-mismatch");

  phase = "source-verification";
  const sourceRun = (await client.query("select id from ops.legacy_import_runs where source_fingerprint=$1 and mapping_version=$2 and status='imported'", [SOURCE_FINGERPRINT, SOURCE_MAPPING])).rows;
  if (sourceRun.length !== 1) fail(phase, "staged-source-provenance-missing-or-ambiguous");
  const counts = (await client.query("select (select count(*)::int from legacy.posts) posts, (select count(*)::int from legacy.post_media) post_media, (select count(*)::int from legacy.media) media, (select count(*)::int from legacy.bug_reports) bug_reports, (select count(*)::int from ops.legacy_entity_map where source_fingerprint=$1 and mapping_version=$2 and review_state='quarantined') provenance", [SOURCE_FINGERPRINT, SOURCE_MAPPING])).rows[0];
  if (counts.posts !== 2 || counts.post_media !== 2 || counts.media !== 10 || counts.bug_reports !== 0 || counts.provenance !== 25) fail(phase, "staged-source-count-mismatch");

  phase = "begin";
  await client.query("begin"); transaction = true;
  await client.query("set local statement_timeout='15s'");
  await client.query("set local lock_timeout='5s'");
  await client.query("set local time zone 'UTC'");
  await client.query("select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 20261112))", [SOURCE_FINGERPRINT + MAPPING_VERSION]);
  phase = "source-read";
  const sourcePosts = (await client.query(`select id::text, title, content, views, created_at::text as created_at, updated_at::text as updated_at,
      deleted_at::text as deleted_at, status, deletion_date::text as deletion_date
    from legacy.posts order by id`)).rows;
  const sourceMedia = (await client.query(`select link.id::text as bridge_id, link.post_id::text, link.media_id::text, link.media_order,
      media.type, media.caption, media.title, media.uploaded_at::text as uploaded_at
    from legacy.post_media link join legacy.media media on media.id=link.media_id
    where link.post_id is not null order by link.post_id, link.media_order nulls last, link.id`)).rows;
  if (sourcePosts.length !== 2 || sourceMedia.length !== 2 || sourceMedia.some((row) => !sourcePosts.some((post) => post.id === row.post_id))) fail("source-read", "unresolved-post-media-reference");

  const runId = runIdFor(SOURCE_FINGERPRINT, MAPPING_VERSION);
  const previous = (await client.query("select status, source_fingerprint, mapping_version from ops.legacy_import_runs where id=$1 for update", [runId])).rows[0];
  const applicationCounts = (await client.query(`select
    (select count(*)::int from app.posts) posts,
    (select count(*)::int from app.media) media,
    (select count(*)::int from app.user_profiles)+(select count(*)::int from app.user_roles)+
    (select count(*)::int from app.user_capabilities)+(select count(*)::int from app.security_audit_events)+
    (select count(*)::int from app.audience_groups)+(select count(*)::int from app.audience_memberships)+
    (select count(*)::int from app.post_access_grants)+(select count(*)::int from app.post_access_requests)+
    (select count(*)::int from app.site_media)+(select count(*)::int from app.appearance_settings) other_app,
    (select count(*)::int from auth."user")+(select count(*)::int from auth.session)+
    (select count(*)::int from auth.account)+(select count(*)::int from auth.verification) auth_rows`)).rows[0];

  if (previous) {
    if (previous.status !== "imported" || previous.source_fingerprint !== SOURCE_FINGERPRINT || previous.mapping_version !== MAPPING_VERSION) fail("idempotency", "normalization-ledger-conflict");
    if (applicationCounts.other_app !== 0 || applicationCounts.auth_rows !== 0) fail("idempotency", "unexpected-app-or-auth-records");
    await verifyExisting(client, sourcePosts, sourceMedia, runId);
    if (apply) await client.query("commit"); else await client.query("rollback");
    transaction = false;
    console.log(JSON.stringify({ result: "already-normalized-and-reconciled", mode: apply ? "apply-local-content" : "dry-run", posts: 2, mediaRelationships: 2, publication: "private-drafts-or-archived", bugReports: 0, credentialsImported: 0, usersCreated: 0, rolesGranted: 0 }));
  } else {
    const priorRunId = runIdFor(SOURCE_FINGERPRINT, PREVIOUS_MAPPING_VERSION);
    const priorRun = (await client.query("select status,source_fingerprint,mapping_version from ops.legacy_import_runs where id=$1 for update", [priorRunId])).rows[0];
    if (priorRun) {
      if (priorRun.status !== "imported" || priorRun.source_fingerprint !== SOURCE_FINGERPRINT || priorRun.mapping_version !== PREVIOUS_MAPPING_VERSION) fail("prior-mapping", "previous-normalization-ledger-conflict");
      if (applicationCounts.posts !== 2 || applicationCounts.media !== 2 || applicationCounts.other_app !== 0 || applicationCounts.auth_rows !== 0) fail("prior-mapping", "previous-normalization-target-mismatch");
      await verifyExisting(client, sourcePosts, sourceMedia, priorRunId, { checkTimestamps: false, expectedMapping: PREVIOUS_MAPPING_VERSION, checkLedgerReport: false });
    } else if (applicationCounts.posts !== 0 || applicationCounts.media !== 0 || applicationCounts.other_app !== 0 || applicationCounts.auth_rows !== 0) {
      fail("target-precondition", "application-or-auth-target-not-empty");
    }
    const mapCount = (await client.query("select count(*)::int as count from ops.legacy_entity_map where run_id=$1", [runId])).rows[0].count;
    if (mapCount !== 0) fail("target-precondition", "normalization-provenance-not-empty");
    if (apply) {
      phase = "write";
      const report = { mappingVersion: MAPPING_VERSION, sourceFingerprint: SOURCE_FINGERPRINT, posts: sourcePosts.length, mediaRelationships: sourceMedia.length, postsPublished: 0, postsPrivate: sourcePosts.length, usersCreated: 0, rolesGranted: 0, authRowsWritten: 0, mediaUrlsCopied: 0, timestampInterpretation: "source wall-clock timestamps deterministically interpreted as UTC with microsecond precision; raw values remain in legacy staging" };
      await client.query("insert into ops.legacy_import_runs (id,source_fingerprint,mapping_version,status,report) values ($1,$2,$3,'validating',$4::jsonb)", [runId, SOURCE_FINGERPRINT, MAPPING_VERSION, JSON.stringify(report)]);
      if (priorRun) {
        // Correct the known v1 timestamp parser defect only after verifying that
        // the target rows are exactly those created by the prior local mapping.
        for (const post of sourcePosts) {
          await client.query("update app.posts set created_at=$2::timestamptz,updated_at=$3::timestamptz where id=$1", [post.id, asUtcTimestamp(post.created_at) ?? "1970-01-01T00:00:00Z", asUtcTimestamp(post.updated_at) ?? asUtcTimestamp(post.created_at) ?? "1970-01-01T00:00:00Z"]);
        }
        for (const item of sourceMedia) {
          await client.query("update app.media set created_at=$2::timestamptz where id=$1 and post_id=$3 and source_media_id=$4", [`legacy-post-media-${item.bridge_id}`, asUtcTimestamp(item.uploaded_at) ?? "1970-01-01T00:00:00Z", item.post_id, item.media_id]);
        }
      } else {
        for (const post of sourcePosts) {
          const slug = makeSlug(post.title, post.id);
          const deleted = post.deleted_at !== null || post.deletion_date !== null;
          await client.query(`insert into app.posts
            (id,slug,title,excerpt,content,publication_state,visibility,published_at,date,thumbnail_url,legacy_views,legacy_status,deleted_at,deletion_date,author_user_id,created_at,updated_at,revision)
            values ($1,$2,$3,null,$4,$5::public.publication_state,'private',null,$6,null,$7,$8,$9,$10,null,$11,$12,1)`,
          [post.id, slug, post.title, post.content, deleted ? "archived" : "draft", legacyDate(post.created_at), post.views, post.status, post.deleted_at, post.deletion_date,
            asUtcTimestamp(post.created_at) ?? "1970-01-01T00:00:00Z", asUtcTimestamp(post.updated_at) ?? asUtcTimestamp(post.created_at) ?? "1970-01-01T00:00:00Z"]);
          await addProvenance(client, runId, "posts", post.id, "posts", post.id);
        }
        for (const media of sourceMedia) {
          const id = `legacy-post-media-${media.bridge_id}`;
          const sourceType = String(media.type ?? "").toLowerCase();
          const type = ["image", "youtube", "instagram", "video", "file"].includes(sourceType) ? sourceType : "file";
          await client.query(`insert into app.media (id,post_id,type,url,caption,idx,title,created_at,source_media_id)
            values ($1,$2,$3,null,$4,$5,$6,$7,$8)`,
          [id, media.post_id, type, media.caption, Number.isSafeInteger(media.media_order) && media.media_order >= 0 ? media.media_order : 0, media.title, asUtcTimestamp(media.uploaded_at) ?? "1970-01-01T00:00:00Z", media.media_id]);
          await addProvenance(client, runId, "post_media", media.bridge_id, "media", id);
        }
      }
      if (priorRun) {
        for (const post of sourcePosts) await addProvenance(client, runId, "posts", post.id, "posts", post.id);
        for (const item of sourceMedia) await addProvenance(client, runId, "post_media", item.bridge_id, "media", `legacy-post-media-${item.bridge_id}`);
      }
      await client.query("update ops.legacy_import_runs set status='imported',finished_at=now(),report=$2::jsonb where id=$1", [runId, JSON.stringify(report)]);
    }
    phase = "verification";
    if (apply) await verifyExisting(client, sourcePosts, sourceMedia, runId);
    else await verifyDryRun(sourcePosts, sourceMedia);
    if (apply) await client.query("commit"); else await client.query("rollback");
    transaction = false;
    console.log(JSON.stringify({ result: apply ? "normalized-and-reconciled" : "normalization-plan-validated", mode: apply ? "apply-local-content" : "dry-run", posts: 2, mediaRelationships: 2, publication: "private-drafts-or-archived", bugReports: 0, credentialsImported: 0, usersCreated: 0, rolesGranted: 0, mediaUrlsCopied: 0 }));
  }
} catch (error) {
  if (transaction && client) await client.query("rollback").catch(() => {});
  const safePhase = error && typeof error === "object" && "phase" in error ? String(error.phase) : phase;
  fail(safePhase, classify(error));
} finally {
  client?.release();
  await pool.end().catch(() => {});
}

async function verifyDryRun(posts, media) {
  const slugs = new Set();
  for (const post of posts) {
    const slug = makeSlug(post.title, post.id).toLowerCase();
    if (!slug || slugs.has(slug)) fail("verification", "generated-slug-collision");
    slugs.add(slug);
  }
  if (media.some((item) => !posts.some((post) => post.id === item.post_id))) fail("verification", "media-parent-missing");
}

async function verifyExisting(client, sourcePosts, sourceMedia, runId, { checkTimestamps = true, expectedMapping = MAPPING_VERSION, checkLedgerReport = true } = {}) {
  const rows = (await client.query("select id,slug,title,content,publication_state::text as state,visibility::text as visibility,published_at,legacy_status,legacy_views,date::text as date,author_user_id,deleted_at::text as deleted_at,deletion_date::text as deletion_date,created_at,updated_at from app.posts order by id")).rows;
  if (rows.length !== sourcePosts.length) fail("verification", "post-count-mismatch");
  for (const source of sourcePosts) {
    const row = rows.find((item) => item.id === source.id);
    const deleted = source.deleted_at !== null || source.deletion_date !== null;
    if (!row || row.title !== source.title || row.content !== source.content || row.visibility !== "private" || row.state !== (deleted ? "archived" : "draft") || row.published_at !== null || row.legacy_status !== source.status || row.legacy_views !== source.views || row.date !== legacyDate(source.created_at) || row.author_user_id !== null || row.slug !== makeSlug(source.title, source.id)) fail("verification", "post-content-or-privacy-mismatch");
    if (row.deleted_at !== source.deleted_at || row.deletion_date !== source.deletion_date) fail("verification", "deletion-marker-reconciliation-failed");
  }
  const attachments = (await client.query("select id,post_id,type,url,caption,idx,title,source_media_id,created_at from app.media order by id")).rows;
  if (attachments.length !== sourceMedia.length) fail("verification", "media-count-mismatch");
  for (const item of attachments) {
    const source = sourceMedia.find((src) => src.post_id === item.post_id && src.media_id === item.source_media_id && item.id === `legacy-post-media-${src.bridge_id}`);
    const sourceType = String(source?.type ?? "").toLowerCase();
    const expectedType = ["image", "youtube", "instagram", "video", "file"].includes(sourceType) ? sourceType : "file";
    if (item.url !== null) fail("verification", "media-url-not-quarantined");
    if (!source) fail("verification", "media-provenance-link-mismatch");
    if (item.type !== expectedType) fail("verification", "media-type-mismatch");
    if (item.caption !== source.caption || item.title !== source.title) fail("verification", "media-description-mismatch");
    if (item.idx !== (Number.isSafeInteger(source.media_order) && source.media_order >= 0 ? source.media_order : 0)) fail("verification", "media-order-mismatch");
  }
  if (checkTimestamps) {
    const mismatch = (await client.query(`select count(*)::int as count from app.posts target
      join legacy.posts source on target.id=source.id::text
      where (target.created_at at time zone 'UTC') is distinct from coalesce(source.created_at, timestamp '1970-01-01 00:00:00')
         or (target.updated_at at time zone 'UTC') is distinct from coalesce(source.updated_at, source.created_at, timestamp '1970-01-01 00:00:00')`)).rows[0].count;
    const mediaMismatch = (await client.query(`select count(*)::int as count from app.media target
      join legacy.post_media bridge on target.id='legacy-post-media-' || bridge.id::text
      join legacy.media source on source.id=bridge.media_id
      where (target.created_at at time zone 'UTC') is distinct from coalesce(source.uploaded_at, timestamp '1970-01-01 00:00:00')`)).rows[0].count;
    if (mismatch || mediaMismatch) fail("verification", "timestamp-reconciliation-failed");
  }
  const provenance = (await client.query("select count(*)::int as count from ops.legacy_entity_map where run_id=$1 and source_fingerprint=$2 and mapping_version=$3 and target_schema='app' and review_state='quarantined'", [runId, SOURCE_FINGERPRINT, expectedMapping])).rows[0].count;
  if (provenance !== sourcePosts.length + sourceMedia.length) fail("verification", "normalized-provenance-count-mismatch");
  const report = (await client.query("select status,report from ops.legacy_import_runs where id=$1 and source_fingerprint=$2 and mapping_version=$3", [runId, SOURCE_FINGERPRINT, expectedMapping])).rows[0];
  if (!report || report.status !== "imported" || checkLedgerReport && (report.report.posts !== 2 || report.report.mediaRelationships !== 2 || report.report.postsPublished !== 0)) fail("verification", "normalization-ledger-mismatch");
}

async function addProvenance(client, runId, sourceTable, sourceId, targetTable, targetId) {
  await client.query(`insert into ops.legacy_entity_map (run_id,source_namespace,source_table,source_id,target_schema,target_table,target_id,source_fingerprint,mapping_version,review_state)
    values ($1,'supabase-backup-unverified',$2,$3,'app',$4,$5,$6,$7,'quarantined')`, [runId, sourceTable, String(sourceId), targetTable, targetId, SOURCE_FINGERPRINT, MAPPING_VERSION]);
}

function makeSlug(title, id) {
  const normalized = String(title).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-+$/g, "");
  return `${normalized || "legacy-post"}-${String(id).toLowerCase()}`;
}

function asUtcTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?: |T)\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)) return null;
  return `${value.replace(" ", "T")}Z`;
}

function legacyDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

function runIdFor(fingerprint, mapping) {
  const bytes = createHash("sha256").update(`${fingerprint}:${mapping}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function classify(error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (code === "23505") return "duplicate-or-conflict";
  if (code.startsWith("23")) return "constraint-violation";
  if (code.startsWith("42")) return "schema-mismatch";
  if (code.startsWith("28")) return "authentication-failure";
  if (code.startsWith("08") || code === "ECONNREFUSED" || code === "ETIMEDOUT") return "connection-failure";
  if (error instanceof Error && error.name === "UnverifiedNeonDevelopmentTargetError") return "target-guard-failed";
  return "database-operation-failed";
}

function fail(phase, category) {
  console.error(`Local normalization stopped (phase=${phase}, category=${category}); sensitive values and content were suppressed.`);
  process.exit(1);
}
