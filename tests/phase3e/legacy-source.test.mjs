import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { assertLegacyStagingCounts, buildSafeInsertRow, expectedColumnAllowlist, importedRowsForVerification, INSERT_ORDER, parseLegacyDump, validateLegacyRows } from "../../scripts/phase3i/legacy-source.mjs";
import { classifyImportFailure, collectSafeImportErrorCodes } from "../../scripts/phase3i/import-error-classification.mjs";
import { DEVELOPMENT_TARGET, normalizeDevelopmentDatabaseUrl } from "../../scripts/phase3i/development-target.mjs";

const fixture = `COPY public.media (id, url, key, caption, type, uploaded_at, context, title, order_index) FROM stdin;\n00000000-0000-0000-0000-000000000001\thttps://media.invalid/a\t\\N\tline\\ncaption\timage\t2025-01-02 03:04:05\tpost\ttitle\t0\n\\.\nCOPY public.posts (id, title, content, views, created_at, updated_at, deleted_at, status, deletion_date) FROM stdin;\n00000000-0000-0000-0000-000000000002\tTitle\t<p>ok</p>\t1\t2025-01-02 03:04:05\t2025-01-02 03:04:05\t\\N\tactive\t\\N\n\\.\nCOPY public.content (id, type, title, url, description, order_index, created_at, thumbnail_url, media_id) FROM stdin;\n1\thero\t\\N\t\\N\t\\N\t0\t\\N\t\\N\t\\N\n\\.\nCOPY public.content_media (id, content_id, media_id, position, context_label, created_at) FROM stdin;\n00000000-0000-0000-0000-000000000003\t1\t00000000-0000-0000-0000-000000000001\t0\t\\N\t\\N\n\\.\nCOPY public.post_media (id, post_id, media_id, media_order) FROM stdin;\n1\t00000000-0000-0000-0000-000000000002\t00000000-0000-0000-0000-000000000001\t0\n\\.\nCOPY public.users (id, username, is_admin, created_at, email, user_id, needs_setup, profile_color, password, reset_token, reset_token_expires) FROM stdin;\n1\tlegacy\tf\t2025-01-02 03:04:05\tlegacy@example.invalid\t\\N\tf\tblue\tprivate-hash\tprivate-token\t2025-01-03 03:04:05\n\\.\nCOPY public.bug_reports (id, description, reported_at) FROM stdin;\n1\tsynthetic report\t2025-01-02 03:04:05\n\\.\n`;

test("legacy parser projects the exact safe target fields and keeps COPY escapes", () => {
  const parsed = parseLegacyDump(Buffer.from(fixture));
  assert.equal(parsed.copiedRows, 7);
  assert.equal(parsed.rows.media[0].caption, "line\ncaption");
  assert.deepEqual(parsed.counts, { bug_reports: 1, content: 1, content_media: 1, media: 1, post_media: 1, posts: 1, users: 1 });
  assert.equal("password" in parsed.rows.users[0], false);
  assert.equal("reset_token" in parsed.rows.users[0], false);
  assert.equal(parsed.rows.users[0].is_admin, "f");
  assert.equal(parsed.rows.posts[0].status, "active");
  assert.equal(buildSafeInsertRow("users", parsed.rows.users[0]).columns.includes("password"), false);
});

test("legacy parser refuses malformed widths, duplicate COPY blocks, missing tables, and invalid FKs", () => {
  assert.throws(() => parseLegacyDump(fixture.replace("title\t0\n\\.\nCOPY public.posts", "title\n\\.\nCOPY public.posts")), /field width/);
  assert.throws(() => parseLegacyDump(fixture.replace("COPY public.bug_reports", "COPY public.media (id, url, key, caption, type, uploaded_at, context, title, order_index) FROM stdin;\n\\.\nCOPY public.bug_reports")), /duplicate/);
  assert.throws(() => parseLegacyDump(fixture.replace(/COPY public.bug_reports[\s\S]*$/, "")), /missing/);
  const parsed = parseLegacyDump(Buffer.from(fixture));
  parsed.rows.post_media[0].post_id = "missing-parent";
  assert.throws(() => validateLegacyRows(parsed.rows), /foreign-key/);
});

test("planned import order matches legacy FK dependencies and never maps auth tables", () => {
  const migration = readFileSync(new URL("../../drizzle/0000_petite_loki.sql", import.meta.url), "utf8");
  for (const table of [...INSERT_ORDER, "bug_reports"]) assert.ok(migration.includes(`CREATE TABLE "legacy"."${table}"`));
  const rank = (table) => INSERT_ORDER.indexOf(table);
  assert.ok(rank("posts") < rank("post_media"));
  assert.ok(rank("media") < rank("content_media") && rank("media") < rank("post_media"));
  assert.ok(rank("content") < rank("content_media"));
  assert.equal(INSERT_ORDER.includes("bug_reports"), false);
  assert.equal(INSERT_ORDER.includes("auth.user"), false);
  assert.match(migration, /CREATE TABLE "legacy"\."content_media"/);
  assert.match(migration, /CREATE TABLE "legacy"\."post_media"/);
  for (const table of Object.keys({ bug_reports: 1, content: 1, content_media: 1, media: 1, post_media: 1, posts: 1, users: 1 })) {
    const start = migration.indexOf(`CREATE TABLE "legacy"."${table}"`);
    const end = migration.indexOf("--> statement-breakpoint", start);
    const definition = migration.slice(start, end < 0 ? migration.length : end);
    for (const column of expectedColumnAllowlist(table)) assert.ok(definition.includes(`"${column}"`), `${table}.${column} is present in Drizzle DDL`);
  }
  const usersStart = migration.indexOf('CREATE TABLE "legacy"."users"');
  const usersEnd = migration.indexOf("--> statement-breakpoint", usersStart);
  assert.doesNotMatch(migration.slice(usersStart, usersEnd), /"password"|"reset_token"/);
});

test("excluded bug reports count toward the source plan but never require staged rows or provenance matches", () => {
  const parsed = parseLegacyDump(Buffer.from(fixture));
  const verifiedRows = importedRowsForVerification(parsed.rows);
  const reviewedCounts = { posts: 2, media: 10, content: 6, users: 2, content_media: 3, post_media: 2, bug_reports: 3 };
  const reviewedStagingTotal = INSERT_ORDER.reduce((total, table) => total + reviewedCounts[table], 0);
  const actualCounts = Object.fromEntries(Object.keys(parsed.rows).map((table) => [
    table,
    INSERT_ORDER.includes(table) ? parsed.rows[table].length : 0,
  ]));

  assert.equal(parsed.rows.bug_reports.length, 1);
  assert.equal(verifiedRows.length, 6);
  assert.equal(reviewedStagingTotal, 25);
  assert.equal(reviewedCounts.bug_reports, 3);
  assert.ok(verifiedRows.every(({ table }) => table !== "bug_reports"));
  assert.doesNotThrow(() => assertLegacyStagingCounts(parsed.rows, actualCounts));
});

test("staging count verification rejects unexpected rows in imported or excluded tables", () => {
  const parsed = parseLegacyDump(Buffer.from(fixture));
  const counts = Object.fromEntries(Object.keys(parsed.rows).map((table) => [
    table,
    INSERT_ORDER.includes(table) ? parsed.rows[table].length : 0,
  ]));

  assert.throws(() => assertLegacyStagingCounts(parsed.rows, { ...counts, bug_reports: 1 }), /staging row count/);
  assert.throws(() => assertLegacyStagingCounts(parsed.rows, { ...counts, media: counts.media + 1 }), /staging row count/);
  assert.throws(() => assertLegacyStagingCounts(parsed.rows, { ...counts, posts: counts.posts - 1 }), /staging row count/);
});

test("development URL guard accepts only the reviewed endpoint hostname and target", () => {
  const makeUrl = (hostname = DEVELOPMENT_TARGET.hostname, database = DEVELOPMENT_TARGET.database) =>
    `postgresql://${encodeURIComponent(DEVELOPMENT_TARGET.role)}:synthetic-password@${hostname}/${database}?channel_binding=require`;
  const normalized = new URL(normalizeDevelopmentDatabaseUrl(makeUrl()));
  const unexpectedPort = new URL(makeUrl());
  unexpectedPort.port = "6543";

  assert.equal(normalized.hostname, DEVELOPMENT_TARGET.hostname);
  assert.equal(normalized.pathname, `/${DEVELOPMENT_TARGET.database}`);
  assert.equal(normalized.searchParams.get("sslmode"), "require");
  assert.equal(normalized.searchParams.get("channel_binding"), "require");
  for (const candidate of [
    makeUrl(`${DEVELOPMENT_TARGET.hostname}.attacker.invalid`),
    makeUrl(`${DEVELOPMENT_TARGET.endpoint}.evil.neon.tech`),
    makeUrl("ep-unapproved-endpoint.c-9.us-east-2.aws.neon.tech"),
    makeUrl(DEVELOPMENT_TARGET.hostname, "production"),
    makeUrl().replace("postgresql://", "https://"),
    unexpectedPort.toString(),
  ]) {
    assert.throws(() => normalizeDevelopmentDatabaseUrl(candidate), /development URL/);
  }
  assert.throws(() => normalizeDevelopmentDatabaseUrl("not a URL"), /development URL is invalid/);
});

test("import failure classification distinguishes safe operational categories without returning raw errors", () => {
  const cases = [
    [{ code: "ENOTFOUND", message: "db.example.invalid user=private password=secret" }, "connect", "dns-or-host-resolution"],
    [new AggregateError([Object.assign(new Error("password=secret"), { code: "EAI_AGAIN" })]), "connect", "dns-or-host-resolution"],
    [{ cause: Object.assign(new Error("private socket message"), { code: "UND_ERR_CONNECT_TIMEOUT" }) }, "connect", "network-connectivity"],
    [{ cause: Object.assign(new Error("private host"), { code: "ERR_TLS_CERT_ALTNAME_INVALID" }) }, "connect", "tls-or-certificate"],
    [{ code: "28P01", message: "password authentication failed for user private" }, "connect", "authentication"],
    [{ code: "42501", message: "permission denied for table private_rows" }, "staging-write", "permissions"],
    [{ code: "42P01", message: "relation private_rows does not exist" }, "staging-schema", "schema-or-query-mismatch"],
    [{ code: "23505", message: "duplicate key contains private values" }, "staging-write", "constraint-violation"],
    [{ code: "57014", message: "statement timeout" }, "pre-commit-verification", "transaction-or-timeout"],
    [{ code: "XX000", message: "private diagnostic content" }, "post-commit-verification", "post-commit-verification"],
  ];

  for (const [error, phase, category] of cases) {
    const result = classifyImportFailure(error, phase);
    assert.deepEqual(result, { phase, category });
    if (error.message) assert.equal(JSON.stringify(result).includes(error.message), false);
    assert.equal(JSON.stringify(result).includes("secret"), false);
  }
});

test("unknown driver diagnostics are reduced to bounded phase and category labels", () => {
  assert.deepEqual(classifyImportFailure(new Error("server returned a secret-bearing diagnostic"), "untrusted-phase"), {
    phase: "unknown-phase",
    category: "precondition-or-unknown",
  });
  assert.deepEqual(classifyImportFailure(new Error("private driver text"), "connect"), {
    phase: "connect",
    category: "client-acquisition-unclassified",
  });
  const wrapped = new AggregateError([Object.assign(new Error("user=private password=secret"), { code: "ENOTFOUND" })]);
  const result = classifyImportFailure(wrapped, "connect");
  assert.deepEqual(result, { phase: "connect", category: "dns-or-host-resolution" });
  assert.doesNotMatch(JSON.stringify(result), /private|secret|ENOTFOUND/);
  const undiciError = new AggregateError([Object.assign(new Error("private socket details"), { code: "UND_ERR_CONNECT_TIMEOUT" })]);
  assert.deepEqual(collectSafeImportErrorCodes(undiciError), ["UND_ERR_CONNECT_TIMEOUT"]);
  assert.deepEqual(collectSafeImportErrorCodes({ code: "PRIVATE_DATABASE_URL" }), []);
});
