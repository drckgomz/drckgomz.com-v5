/** Hide Better Auth's bearer session token from browser-readable API output. */
export function withoutSessionToken(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const record = payload as Record<string, unknown>;
  const session = record.session;
  if (!session || typeof session !== "object" || Array.isArray(session)) return payload;
  const safeSession = Object.fromEntries(
    Object.entries(session as Record<string, unknown>).filter(([key]) => key !== "token"),
  );
  return { ...record, session: safeSession };
}
