import "server-only";
import { sql } from "drizzle-orm";
import { getCurrentSessionTokenDigest } from "@/lib/auth/session-token-digest";
import { getOwnerOperationDatabase } from "@/lib/db/client";
import type { AudienceChangeResult, AudienceListResult, PrivateAudienceUser } from "@/lib/auth/private-audience-api";

type AudienceListPayload = { forbidden: boolean; total: number; users: PrivateAudienceUser[] };

/**
 * This role has EXECUTE on two narrowly scoped SECURITY DEFINER functions
 * only. actorId is retained for the current API dependency contract; SQL
 * derives the actor from the verified session digest, never this argument.
 */
export async function listPrivateAudienceUsers(_actorId: string, limit: number, offset: number): Promise<AudienceListResult> {
  const sessionDigest = await getCurrentSessionTokenDigest();
  if (!sessionDigest) return { kind: "forbidden" };
  const db = getOwnerOperationDatabase();
  const result = await db.execute(sql`
    select app_private.list_private_audience_users(${sessionDigest}, ${limit}, ${offset}) as payload
  `);
  const payload = result.rows[0]?.payload as AudienceListPayload | undefined;
  if (!payload || payload.forbidden === true || !Array.isArray(payload.users) || !Number.isSafeInteger(payload.total)) {
    return { kind: "forbidden" };
  }
  return { kind: "ok", users: payload.users, total: payload.total };
}

export async function setPrivateAudienceGrant(
  _actorId: string,
  targetId: string,
  grant: boolean,
): Promise<AudienceChangeResult> {
  const sessionDigest = await getCurrentSessionTokenDigest();
  if (!sessionDigest) return { kind: "forbidden" };
  const db = getOwnerOperationDatabase();
  const result = await db.execute(sql`
    select app_private.set_private_journal_access(${sessionDigest}, ${targetId}, ${grant}) as outcome
  `);
  const outcome = result.rows[0]?.outcome;
  switch (outcome) {
    case "forbidden": return { kind: "forbidden" };
    case "self-change": return { kind: "self-change" };
    case "not-found": return { kind: "not-found" };
    case "blocked": return { kind: "blocked" };
    case "ok-changed": return { kind: "ok", changed: true };
    case "ok-unchanged": return { kind: "ok", changed: false };
    default: return { kind: "forbidden" };
  }
}
