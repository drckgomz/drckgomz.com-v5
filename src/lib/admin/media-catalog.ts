import "server-only";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { posts, media } from "@/lib/db/schema";
import { withCurrentOwnerSession } from "@/lib/db/owner-session";
import { requireManagementOwner } from "@/lib/admin/management";
import { isLocalPostgresIntegrationEnabled, verifyAllLocalPostgresTargets } from "@/lib/db/local-postgres-target";
import { localLegacyBlogImagePreviewUrl } from "@/lib/blog/legacy-media-preview";

export type CatalogMedia = { id: string; type: string; caption: string | null; title: string | null; postTitle: string; postSlug: string; previewUrl: string | null };
export async function readMediaCatalog(options: { search: string; type: string; offset: number }) {
  await requireManagementOwner();
  if (!isLocalPostgresIntegrationEnabled(process.env)) return { available: false as const, items: [], hasMore: false };
  verifyAllLocalPostgresTargets(process.env);
  try {
    return await withCurrentOwnerSession(async tx => {
      const term = options.search.replace(/[\\%_]/g, "\\$&");
      const rows = await tx.select({ id: media.id, type: media.type, caption: media.caption, title: media.title, sourceUrl: media.url, postTitle: posts.title, postSlug: posts.slug })
        .from(media).innerJoin(posts, eq(media.postId, posts.id))
        .where(and(options.type === "all" ? undefined : eq(media.type, options.type), term ? or(ilike(media.caption, `%${term}%`), ilike(media.title, `%${term}%`), ilike(posts.title, `%${term}%`)) : undefined))
        .orderBy(asc(media.id)).limit(25).offset(options.offset);
      const items: CatalogMedia[] = rows.slice(0, 24).map(({ sourceUrl, ...item }) => ({ ...item,
        previewUrl: item.type === "image" ? localLegacyBlogImagePreviewUrl(item.id, sourceUrl) : null,
      }));
      return { available: true as const, items, hasMore: rows.length > 24 };
    });
  } catch {
    return { available: false as const, items: [], hasMore: false };
  }
}
