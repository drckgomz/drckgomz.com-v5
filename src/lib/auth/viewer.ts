import "server-only";
import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { getBackendConfiguration } from "@/lib/backend-configuration";
import { getBetterAuth } from "@/lib/auth/better-auth";
import { digestSessionToken } from "@/lib/auth/session-token-digest-policy";
import { withContentSession } from "@/lib/db/content-session";
import type { UserProfile } from "@/lib/profile/types";
import { resolveProfileDisplayName } from "@/lib/profile/display-name";

type ViewerRow = {
  id?: unknown; username?: unknown; display_name?: unknown; email?: unknown; first_name?: unknown; last_name?: unknown; avatar_color?: unknown;
  role?: unknown; enabled?: unknown; is_banned?: unknown; is_owner?: unknown;
  is_whitelist_admin?: unknown; can_view_private?: unknown;
};

function asProfile(value: unknown): UserProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as ViewerRow;
  if (typeof row.id !== "string" || row.enabled !== true || row.is_banned === true) return null;
  return {
    id: row.id,
    username: typeof row.username === "string" ? row.username : "",
    display_name: typeof row.display_name === "string" ? row.display_name : "",
    email: typeof row.email === "string" ? row.email : "",
    first_name: typeof row.first_name === "string" ? row.first_name : "",
    last_name: typeof row.last_name === "string" ? row.last_name : "",
    role: typeof row.role === "string" ? row.role : "user",
    enabled: true,
    is_banned: row.is_banned === true,
    is_owner: row.is_owner === true,
    is_whitelist_admin: row.is_whitelist_admin === true,
    can_view_private: row.can_view_private === true,
    avatar_color: typeof row.avatar_color === "string" ? row.avatar_color : "",
  };
}

/** Resolve mutable profile permissions from the database on every request. */
export async function getViewer(): Promise<{ userId: string | null; displayName: string | null; profile: UserProfile | null }> {
  getBackendConfiguration();
  let session: Awaited<ReturnType<ReturnType<typeof getBetterAuth>["api"]["getSession"]>>;
  try {
    session = await getBetterAuth().api.getSession({ headers: await headers() });
  } catch (error) {
    // Auth configuration or storage failures never grant a viewer identity.
    if (process.env.LOCAL_PG_INTEGRATION === "1") console.warn("[phase6-auth] session-read-failed", { code: (error as { code?: unknown })?.code ?? null });
    return { userId: null, displayName: null, profile: null };
  }
  const token = session?.session?.token;
  const userId = typeof session?.user?.id === "string" ? session.user.id : null;
  if (!token || !userId) {
    if (process.env.LOCAL_PG_INTEGRATION === "1") console.warn("[phase6-auth] session-missing", { hasToken: Boolean(token), hasUserId: Boolean(userId) });
    return { userId: null, displayName: null, profile: null };
  }

  try {
    const digest = digestSessionToken(token);
    const profile = await withContentSession(digest, async (tx) => {
      const result = await tx.execute(sql`select app_private.current_viewer_profile() as profile`);
      const row = result.rows?.[0] as { profile?: unknown } | undefined;
      return asProfile(row?.profile);
    });
    if (profile?.id !== userId) {
      if (process.env.LOCAL_PG_INTEGRATION === "1") console.warn("[phase6-auth] profile-session-mismatch", { hasProfile: Boolean(profile), matches: false });
      return { userId, displayName: typeof session?.user?.name === "string" ? session.user.name : null, profile: null };
    }
    const displayName = typeof session?.user?.name === "string" ? session.user.name : "";
    if (profile) {
      profile.display_name = resolveProfileDisplayName(displayName, profile.first_name, profile.last_name);
    }
    return { userId, displayName: displayName || null, profile };
  } catch (error) {
    // Missing database function, stale session, or target failure denies all
    // application roles and private access; it never falls back to another DB.
    if (process.env.LOCAL_PG_INTEGRATION === "1") console.warn("[phase6-auth] profile-resolution-failed", { code: (error as { code?: unknown })?.code ?? null });
    return { userId, displayName: typeof session?.user?.name === "string" ? session.user.name : null, profile: null };
  }
}
