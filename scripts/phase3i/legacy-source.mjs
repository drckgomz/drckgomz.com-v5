import { createHash } from "node:crypto";

export const SOURCE_TABLES = Object.freeze({
  bug_reports: ["id", "description", "reported_at"],
  content: ["id", "type", "title", "url", "description", "order_index", "created_at", "thumbnail_url", "media_id"],
  content_media: ["id", "content_id", "media_id", "position", "context_label", "created_at"],
  media: ["id", "url", "key", "caption", "type", "uploaded_at", "context", "title", "order_index"],
  post_media: ["id", "post_id", "media_id", "media_order"],
  posts: ["id", "title", "content", "views", "created_at", "updated_at", "deleted_at", "status", "deletion_date"],
  users: ["id", "username", "is_admin", "created_at", "email", "user_id", "needs_setup", "profile_color"],
});

// Bug reports are deliberately deferred until retention and sensitivity are
// explicitly approved; no report descriptions are copied by this run.
export const INSERT_ORDER = Object.freeze([
  "posts", "media", "content", "users", "content_media", "post_media",
]);
export const MAPPING_VERSION = "phase3i-legacy-stage-v1";

const COLUMNS = Object.freeze({
  bug_reports: ["id", "description", "reported_at"],
  content: ["id", "type", "title", "url", "description", "order_index", "created_at", "thumbnail_url", "media_id"],
  content_media: ["id", "content_id", "media_id", "position", "context_label", "created_at"],
  media: ["id", "url", "key", "caption", "type", "uploaded_at", "context", "title", "order_index"],
  post_media: ["id", "post_id", "media_id", "media_order"],
  posts: ["id", "title", "content", "views", "created_at", "updated_at", "deleted_at", "status", "deletion_date"],
  // Credentials/reset tokens are deliberately absent, even if present in COPY.
  users: ["id", "username", "is_admin", "created_at", "email", "user_id", "needs_setup", "profile_color"],
});
const CREDENTIAL_COLUMNS = new Set(["password", "reset_token", "reset_token_expires"]);

function decodeCopyField(value) {
  if (value === "\\N") return null;
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "\\") { result += value[index]; continue; }
    const next = value[++index];
    if (next === undefined) throw new Error("malformed COPY escape");
    const simple = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "\\": "\\" };
    if (Object.hasOwn(simple, next)) { result += simple[next]; continue; }
    if (/[0-7]/.test(next)) {
      const tail = value.slice(index, index + 3).match(/^[0-7]{1,3}/)?.[0] ?? next;
      result += String.fromCodePoint(Number.parseInt(tail, 8));
      index += tail.length - 1;
      continue;
    }
    if (next === "x") {
      const tail = value.slice(index + 1, index + 3).match(/^[0-9a-fA-F]{1,2}/)?.[0];
      if (!tail) throw new Error("malformed COPY hex escape");
      result += String.fromCodePoint(Number.parseInt(tail, 16));
      index += tail.length;
      continue;
    }
    // PostgreSQL text COPY treats a backslash before other characters as an
    // escape for that literal character.
    result += next;
  }
  return result;
}

function splitColumnList(source) {
  return source.split(",").map((value) => value.trim().replace(/^"|"$/g, "").replaceAll('""', '"'));
}

export function parseLegacyDump(raw) {
  let text;
  try { text = Buffer.isBuffer(raw) ? new TextDecoder("utf-8", { fatal: true }).decode(raw) : String(raw); }
  catch { throw new Error("source backup is not valid UTF-8"); }
  const lines = text.split(/\r?\n/);
  const rows = Object.fromEntries(Object.keys(SOURCE_TABLES).map((table) => [table, []]));
  const seen = new Set();
  let copiedRows = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index].match(/^COPY\s+(?:"?([\w$]+)"?\.)?"?([\w$]+)"?\s*\((.*)\)\s+FROM\s+stdin;\s*$/i);
    if (!header) continue;
    const schema = header[1] || "public";
    const table = header[2];
    if (schema !== "public" || !Object.hasOwn(SOURCE_TABLES, table)) {
      while (++index < lines.length && lines[index] !== "\\.") { /* opaque provider COPY payload */ }
      if (index >= lines.length) throw new Error("unterminated COPY block");
      continue;
    }
    if (seen.has(table)) throw new Error("duplicate application COPY block");
    seen.add(table);
    const columns = splitColumnList(header[3]);
    const supported = new Set([...SOURCE_TABLES[table], ...CREDENTIAL_COLUMNS]);
    if (new Set(columns).size !== columns.length || columns.some((column) => !supported.has(column))) {
      throw new Error("unsupported or duplicate source column");
    }
    for (const required of SOURCE_TABLES[table]) {
      if (!columns.includes(required)) throw new Error("required source column is missing");
    }
    while (++index < lines.length && lines[index] !== "\\.") {
      const fields = lines[index].split("\t");
      if (fields.length !== columns.length) throw new Error("COPY field width mismatch");
      copiedRows += 1;
      const decoded = Object.fromEntries(columns.map((column, position) => [column, decodeCopyField(fields[position])]));
      // Projection is an allowlist: credential columns are never returned.
      rows[table].push(Object.fromEntries(SOURCE_TABLES[table].map((column) => [column, decoded[column]])));
    }
    if (index >= lines.length) throw new Error("unterminated COPY block");
  }
  if (seen.size !== Object.keys(SOURCE_TABLES).length) throw new Error("one or more expected application COPY blocks are missing");
  validateLegacyRows(rows);
  const counts = Object.fromEntries(Object.keys(SOURCE_TABLES).sort().map((table) => [table, rows[table].length]));
  return { rows, counts, copiedRows, fingerprint: createHash("sha256").update(raw).digest("hex") };
}

export function validateLegacyRows(rows) {
  for (const [table, records] of Object.entries(rows)) {
    const ids = new Set();
    for (const row of records) {
      if (!row || row.id == null) throw new Error("required source identifier is missing");
      const id = String(row.id);
      if (ids.has(id)) throw new Error("duplicate source identifier");
      ids.add(id);
      for (const required of table === "content" ? ["type"] : table === "media" ? ["url"] : table === "posts" ? ["title", "content"] : table === "users" ? ["username", "email"] : table === "bug_reports" ? ["description"] : []) {
        if (row[required] == null) throw new Error("required source field is missing");
      }
    }
  }
  const idsFor = (table) => new Set(rows[table].map((row) => String(row.id)));
  const foreignKeys = [
    ["content", "media_id", "media"],
    ["content_media", "content_id", "content"], ["content_media", "media_id", "media"],
    ["post_media", "post_id", "posts"], ["post_media", "media_id", "media"],
  ];
  for (const [child, field, parent] of foreignKeys) {
    const parents = idsFor(parent);
    if (rows[child].some((row) => row[field] != null && !parents.has(String(row[field])))) {
      throw new Error("source foreign-key reference is unresolved");
    }
  }
}

export function buildSafeInsertRow(table, sourceRow) {
  if (!Object.hasOwn(COLUMNS, table)) throw new Error("unsupported target table");
  const columns = COLUMNS[table];
  return { columns, values: columns.map((column) => sourceRow[column] ?? null) };
}

export function expectedColumnAllowlist(table) {
  return COLUMNS[table];
}

/** Validate the complete target-table count set, including excluded tables. */
export function assertLegacyStagingCounts(sourceRows, actualCounts) {
  for (const table of Object.keys(SOURCE_TABLES)) {
    const expectedCount = INSERT_ORDER.includes(table) ? sourceRows[table].length : 0;
    if (actualCounts[table] !== expectedCount) {
      throw new Error("legacy staging row count mismatch");
    }
  }
}

/** Return only rows admitted to legacy staging, in deterministic FK order. */
export function importedRowsForVerification(sourceRows) {
  return INSERT_ORDER.flatMap((table) => sourceRows[table].map((row) => ({ table, row })));
}
