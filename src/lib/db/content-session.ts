import "server-only";
import { sql } from "drizzle-orm";
import { getContentDatabase } from "@/lib/db/client";
import { getCurrentSessionTokenDigest, isSessionTokenDigest } from "@/lib/auth/session-token-digest";

export type ContentReadTransaction = Parameters<Parameters<ReturnType<typeof getContentDatabase>["transaction"]>[0]>[0];

/**
 * Run all RLS-protected reads on one connection and transaction. PostgreSQL
 * policies validate this digest against the live Better Auth session row;
 * setting it is context only, never authorization evidence by itself.
 */
export async function withContentSession<T>(
  sessionDigest: string | null,
  read: (tx: ContentReadTransaction) => Promise<T>,
): Promise<T> {
  const safeDigest = isSessionTokenDigest(sessionDigest) ? sessionDigest.toLowerCase() : "";
  const db = getContentDatabase();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_catalog.set_config('app.session_token_sha256', ${safeDigest}, true)`);
    return read(tx);
  });
}

export async function withCurrentContentSession<T>(
  read: (tx: ContentReadTransaction) => Promise<T>,
): Promise<T> {
  return withContentSession(await getCurrentSessionTokenDigest(), read);
}
