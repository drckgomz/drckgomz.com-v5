import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getBetterAuth } from "@/lib/auth/better-auth";
import { getAuthDatabase } from "@/lib/db/client";
import { userCapabilities, userProfiles, userRoles } from "@/lib/db/schema";
import type { UserProfile } from "@/lib/profile/types";
import { resolveProfileDisplayName } from "@/lib/profile/display-name";

export async function getBetterAuthViewer(): Promise<{ userId: string | null; profile: UserProfile | null }> {
  const session = await getBetterAuth().api.getSession({ headers: await headers() });
  if (!session?.user?.id) return { userId: null, profile: null };

  const db = getAuthDatabase();
  const [profile] = await db.select({
    id: userProfiles.id,
    username: userProfiles.username,
    firstName: userProfiles.firstName,
    lastName: userProfiles.lastName,
    avatarColor: userProfiles.avatarColor,
    enabled: userProfiles.enabled,
    bannedAt: userProfiles.bannedAt,
  }).from(userProfiles).where(eq(userProfiles.id, session.user.id)).limit(1);
  if (!profile) return { userId: session.user.id, profile: null };

  const [roles, capabilities] = await Promise.all([
    db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, session.user.id)),
    db.select({ capability: userCapabilities.capability }).from(userCapabilities).where(eq(userCapabilities.userId, session.user.id)),
  ]);
  const roleSet = new Set(roles.map(({ role }) => role));
  const profileDto: UserProfile = {
    id: profile.id,
    username: profile.username,
    display_name: resolveProfileDisplayName(session.user.name, profile.firstName, profile.lastName),
    email: session.user.email,
    role: roleSet.has("owner") || roleSet.has("content_admin") ? "admin" : "user",
    avatar_color: profile.avatarColor ?? "",
    first_name: profile.firstName ?? "",
    last_name: profile.lastName ?? "",
    enabled: profile.enabled,
    is_banned: profile.bannedAt !== null,
    is_owner: roleSet.has("owner"),
    is_whitelist_admin: roleSet.has("whitelist_manager"),
    can_view_private: capabilities.some(({ capability }) => capability === "private_blog.read"),
  };
  return { userId: session.user.id, profile: profileDto };
}
