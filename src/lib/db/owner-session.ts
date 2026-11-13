import "server-only";
import { sql } from "drizzle-orm";
import { getCurrentSessionTokenDigest, isSessionTokenDigest } from "@/lib/auth/session-token-digest";
import { getOwnerOperationDatabase } from "@/lib/db/client";

export type OwnerOperationTransaction = Parameters<Parameters<ReturnType<typeof getOwnerOperationDatabase>["transaction"]>[0]>[0];

/** Establish the transaction-local session proof consumed by the PostgreSQL owner RLS policy. */
export async function withOwnerSession<T>(
  sessionDigest: string | null,
  run: (tx: OwnerOperationTransaction) => Promise<T>,
): Promise<T> {
  const digest = isSessionTokenDigest(sessionDigest) ? sessionDigest.toLowerCase() : "";
  const db = getOwnerOperationDatabase();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_catalog.set_config('app.session_token_sha256', ${digest}, true)`);
    return run(tx);
  });
}

export async function withCurrentOwnerSession<T>(run: (tx: OwnerOperationTransaction) => Promise<T>) {
  return withOwnerSession(await getCurrentSessionTokenDigest(), run);
}
