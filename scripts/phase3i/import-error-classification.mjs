const POST_COMMIT_PHASES = new Set(["post-commit-verification"]);
const SAFE_ERROR_CODES = new Set([
  "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET", "UND_ERR_CONNECT", "UND_ERR_HEADERS_TIMEOUT",
  "28P01", "28000", "42501", "3F000", "42P01", "42703", "42804", "42883",
  "40001", "40P01", "55P03", "57014", "ERR_TLS_CERT_ALTNAME_INVALID",
  "ERR_TLS_CERT_SIGNATURE_ALGORITHM_UNSUPPORTED", "ERR_SSL_WRONG_VERSION_NUMBER",
  "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "DEPTH_ZERO_SELF_SIGNED_CERT",
]);

/** Return a bounded diagnostic suitable for logs; never return driver messages. */
export function classifyImportFailure(error, phase) {
  const codes = collectErrorCodes(error);
  const names = collectErrorNames(error);
  let category = "precondition-or-unknown";

  if (POST_COMMIT_PHASES.has(phase)) category = "post-commit-verification";
  else if (hasCode(codes, "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH")) category = "dns-or-host-resolution";
  else if (hasCode(codes, "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ECONN timeout", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET", "UND_ERR_CONNECT", "UND_ERR_HEADERS_TIMEOUT")) category = "network-connectivity";
  else if (hasCode(codes, "28P01", "28000") || names.some((name) => /auth/i.test(name))) category = "authentication";
  else if (hasCode(codes, "42501")) category = "permissions";
  else if (hasCode(codes, "3F000", "42P01", "42703", "42804", "42883")) category = "schema-or-query-mismatch";
  else if (codes.some((code) => code.startsWith("23"))) category = "constraint-violation";
  else if (hasCode(codes, "40001", "40P01", "55P03", "57014")) category = "transaction-or-timeout";
  else if (codes.some((code) => code.startsWith("08") || code.startsWith("28"))) category = "connection-or-authentication";
  else if (codes.some((code) => code.startsWith("ERR_TLS_") || code.startsWith("CERT_") || code.startsWith("ERR_SSL_") || code.startsWith("UNABLE_TO_"))) category = "tls-or-certificate";
  else if (phase === "connect") category = "client-acquisition-unclassified";

  return Object.freeze({ phase: normalizePhase(phase), category });
}

/** Extract only explicitly allowlisted machine codes from bounded nested errors. */
export function collectSafeImportErrorCodes(error) {
  return [...new Set(collectErrorCodes(error).filter((code) => SAFE_ERROR_CODES.has(code)))].sort();
}

// pg-compatible drivers can wrap socket failures in AggregateError, `cause`,
// or an `errors` array. Inspect only bounded machine-readable fields; never
// copy driver messages, hosts, query text, or credentials into diagnostics.
function collectErrorCodes(root) {
  const codes = [];
  const seen = new Set();
  const pending = [{ value: root, depth: 0 }];
  while (pending.length && seen.size < 16) {
    const { value, depth } = pending.pop();
    if (!value || (typeof value !== "object" && typeof value !== "function") || seen.has(value)) continue;
    seen.add(value);
    if (typeof value.code === "string" && value.code.length <= 64) codes.push(value.code);
    if (depth >= 4) continue;
    if (value.cause) pending.push({ value: value.cause, depth: depth + 1 });
    if (Array.isArray(value.errors)) {
      for (const nested of value.errors.slice(0, 8)) pending.push({ value: nested, depth: depth + 1 });
    }
  }
  return codes;
}

function collectErrorNames(root) {
  const names = [];
  if (typeof root?.name === "string" && root.name.length <= 64) names.push(root.name);
  if (root?.cause && typeof root.cause.name === "string" && root.cause.name.length <= 64) names.push(root.cause.name);
  return names;
}

function hasCode(codes, ...expected) {
  return expected.some((code) => codes.includes(code));
}

function normalizePhase(phase) {
  const allowed = new Set([
    "connect", "connection-identity", "begin-transaction", "migration-ledger",
    "staging-schema", "advisory-lock", "existing-run-check", "empty-target-check",
    "staging-write", "pre-commit-verification", "commit", "post-commit-verification",
  ]);
  return allowed.has(phase) ? phase : "unknown-phase";
}
