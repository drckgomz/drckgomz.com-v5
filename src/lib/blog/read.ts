import "server-only";
import { sql } from "drizzle-orm";
import { getViewer } from "@/lib/auth/viewer";
import { publicBlogReadableStatuses } from "@/lib/auth/policy";
import { withCurrentContentSession } from "@/lib/db/content-session";

/** Public reader entry points use only the RLS-protected Drizzle content role. */
export async function getReadablePosts(requested: string) {
  const { profile } = await getViewer();
  const allowed = publicBlogReadableStatuses(profile);
  const statuses = requested === "all" ? allowed : allowed.filter((status) => status === requested);
  if (!statuses.length) return [];
  const { getDrizzleReadablePosts } = await import("@/lib/db/repositories/blog");
  return getDrizzleReadablePosts(requested, profile);
}

export async function getReadablePost(slug: string) {
  const { profile } = await getViewer();
  if (!publicBlogReadableStatuses(profile).length) return null;
  const { getDrizzleReadablePost } = await import("@/lib/db/repositories/blog");
  return getDrizzleReadablePost(slug, profile);
}

/** Expose only a boolean: never return or serialize restricted post metadata. */
export async function hasLockedPrivatePosts() {
  const { profile } = await getViewer();
  if (publicBlogReadableStatuses(profile).includes("private")) return false;
  return withCurrentContentSession(async (tx) => {
    const result = await tx.execute(sql`select app_private.has_published_restricted_posts() as has_restricted`);
    return result.rows?.[0]?.has_restricted === true;
  });
}
