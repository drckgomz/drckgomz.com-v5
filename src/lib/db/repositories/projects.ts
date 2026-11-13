import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { withCurrentContentSession } from "@/lib/db/content-session";
import { homeProjectMedia, homeProjects } from "@/lib/db/schema";
import { isPublicProject } from "@/lib/auth/policy";
import { sanitizeProjectHtml, safeProjectUrl } from "@/lib/content/projectHtml";

export async function getDrizzlePublicProjects(limit = 12, offset = 0) {
  return withCurrentContentSession(async (tx) => {
    const candidates = await tx.select().from(homeProjects).where(and(
      eq(homeProjects.publicationState, "published"), eq(homeProjects.visibility, "public"),
      isNull(homeProjects.deletedAt), isNull(homeProjects.deletionDate),
    )).orderBy(asc(homeProjects.idx), asc(homeProjects.createdAt)).limit(limit + 1).offset(offset);
    const hasMore = candidates.length > limit;
    const rows = candidates.slice(0, limit);
    if (!rows.length) return { items: [], hasMore: false };
    const mediaRows = await tx.select().from(homeProjectMedia)
      .where(inArray(homeProjectMedia.projectId, rows.map((row) => row.id)))
      .orderBy(asc(homeProjectMedia.idx), asc(homeProjectMedia.createdAt));
    const byProject = new Map<string, typeof mediaRows>();
    for (const row of mediaRows) byProject.set(row.projectId, [...(byProject.get(row.projectId) ?? []), row]);
    const items = rows.map((project) => {
      let media = (byProject.get(project.id) ?? []).map((item) => ({
        id: item.id, type: item.type, url: normalizeMediaUrl(item.url) ?? "", caption: item.caption,
        idx: item.idx, created_at: item.createdAt.toISOString(),
      })).filter((item) => item.url);
      const imageUrl = normalizeMediaUrl(project.imageUrl);
      if (!media.length && imageUrl) media = [{ id: "hero", type: "image", url: imageUrl, caption: project.title, idx: 0, created_at: project.createdAt.toISOString() }];
      return {
        id: project.id, idx: project.idx, slug: project.slug, title: project.title,
        excerpt: project.excerpt, href: safeProjectUrl(project.href, true), color: project.color,
        image_url: imageUrl, content: null, status: "public", media,
      };
    });
    return { items, hasMore };
  });
}

function normalizeMediaUrl(url: string | null): string | null {
  if (!url) return null;
  const safe = safeProjectUrl(url);
  if (!safe) return null;
  const base = process.env.NEXT_PUBLIC_S3_MEDIA_BASE;
  if (!base) return safe;
  return safe.replace(/^https:\/\/s3\.us-east-1\.amazonaws\.com\/www\.drckgomz\.com/i, base)
    .replace(/^https:\/\/www\.drckgomz\.com\.s3\.amazonaws\.com/i, base);
}

export async function getDrizzlePublicProjectAndMedia(slugOrId: string) {
  return withCurrentContentSession(async (tx) => {
    const publicProject = and(eq(homeProjects.publicationState, "published"), eq(homeProjects.visibility, "public"),
      isNull(homeProjects.deletedAt), isNull(homeProjects.deletionDate));
    let [project] = await tx.select().from(homeProjects).where(and(publicProject, eq(homeProjects.slug, slugOrId))).limit(1);
    if (!project && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId)) {
      [project] = await tx.select().from(homeProjects).where(and(publicProject, eq(homeProjects.id, slugOrId))).limit(1);
    }
    if (!project || !isPublicProject({ status: project.publicationState === "published" && project.visibility === "public" ? "public" : "private", deleted_at: project.deletedAt, deletion_date: project.deletionDate })) {
      return { project: null, media: [] };
    }
    const rows = await tx.select().from(homeProjectMedia).where(eq(homeProjectMedia.projectId, project.id))
      .orderBy(homeProjectMedia.idx, homeProjectMedia.createdAt);
  type CompatibleProjectMedia = { id: string; type: string; url: string; caption: string | null; idx: number; created_at: string | null; meta: null };
  let media: CompatibleProjectMedia[] = rows.map((row) => ({
    id: row.id, type: row.type, url: normalizeMediaUrl(row.url) ?? "", caption: row.caption,
    idx: row.idx, created_at: row.createdAt.toISOString(), meta: null,
  })).filter((row) => row.url);
  const imageUrl = normalizeMediaUrl(project.imageUrl);
  if (!media.length && imageUrl) media = [{ id: "hero", type: "image", url: imageUrl, caption: project.title, idx: 0, created_at: null, meta: null }];
    return {
    project: {
      id: project.id, idx: project.idx, slug: project.slug, title: project.title,
      excerpt: project.excerpt, href: safeProjectUrl(project.href, true), color: project.color,
      image_url: imageUrl, content: sanitizeProjectHtml(project.content), status: "public",
    },
    media,
    };
  });
}
