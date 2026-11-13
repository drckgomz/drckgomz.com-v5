import "server-only";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { withCurrentContentSession, type ContentReadTransaction } from "@/lib/db/content-session";
import { media, posts } from "@/lib/db/schema";
import type { UserProfile } from "@/lib/profile/types";
import { canReadPost, publicBlogReadableStatuses } from "@/lib/auth/policy";
import { prepareBlogContent, preparePrivateBlogContent } from "@/lib/blog/content.server";
import { normalizeMaybeS3Url } from "@/lib/blog/media";
import { isPrivateJournalKey, isPrivateJournalObjectReference, privateMediaUrl, visibleJournalMediaUrl } from "@/lib/blog/private-media";
import { localLegacyBlogImagePreviewUrl } from "@/lib/blog/legacy-media-preview";

type ReadablePost = Pick<typeof posts.$inferSelect,
  "id" | "slug" | "title" | "excerpt" | "content" | "publicationState" | "visibility" |
  "publishedAt" | "date" | "thumbnailUrl" | "deletedAt" | "deletionDate" | "createdAt" | "updatedAt" | "revision">;
const readablePostColumns = {
  id: posts.id, slug: posts.slug, title: posts.title, excerpt: posts.excerpt, content: posts.content,
  publicationState: posts.publicationState, visibility: posts.visibility, publishedAt: posts.publishedAt,
  date: posts.date, thumbnailUrl: posts.thumbnailUrl, deletedAt: posts.deletedAt,
  deletionDate: posts.deletionDate, createdAt: posts.createdAt, updatedAt: posts.updatedAt, revision: posts.revision,
};

function statusWhere(status: string) {
  if (status === "public") return and(eq(posts.publicationState, "published"), eq(posts.visibility, "public"));
  if (status === "private") return and(eq(posts.publicationState, "published"), eq(posts.visibility, "private"));
  if (status === "draft") return eq(posts.publicationState, "draft");
  if (status === "archived") return eq(posts.publicationState, "archived");
  return undefined;
}

function legacyStatus(row: ReadablePost) {
  if (row.publicationState === "published") return row.visibility;
  return row.publicationState;
}

function serialize(row: ReadablePost, attachments: (typeof media.$inferSelect)[], profile: UserProfile | null) {
  const status = legacyStatus(row);
  const compatibleMedia = attachments.map((attachment) => ({
    id: attachment.id,
    type: attachment.type,
    url: status !== "public" && profile?.is_owner === true && attachment.type === "image"
      ? localLegacyBlogImagePreviewUrl(attachment.id, attachment.url)
      : visibleJournalMediaUrl({ id: attachment.id, postId: row.id, url: attachment.url }, status, normalizeMaybeS3Url),
    caption: attachment.caption,
    idx: attachment.idx,
    title: attachment.title,
    created_at: attachment.createdAt?.toISOString() ?? null,
  })).filter((item): item is typeof item & {
    url: string;
    type: "image" | "youtube" | "instagram";
  } => typeof item.url === "string" && ["image", "youtube", "instagram"].includes(item.type));
  const thumbnailMedia = attachments.find((item) => item.url === row.thumbnailUrl && isPrivateJournalKey(item.url, row.id, item.id));
  const ownerLegacyThumbnail = status !== "public" && profile?.is_owner === true
    ? attachments.find((item) => item.type === "image" && localLegacyBlogImagePreviewUrl(item.id, item.url))
    : undefined;
  const thumbnail = thumbnailMedia ? privateMediaUrl(thumbnailMedia.id)
    : status === "public" && !isPrivateJournalObjectReference(row.thumbnailUrl) ? normalizeMaybeS3Url(row.thumbnailUrl)
      : ownerLegacyThumbnail ? localLegacyBlogImagePreviewUrl(ownerLegacyThumbnail.id, ownerLegacyThumbnail.url) : null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: status === "public" ? prepareBlogContent(row.content, compatibleMedia.map((item) => ({ ...item, url: item.url! })))
      : preparePrivateBlogContent(row.content, compatibleMedia.map((item) => ({ ...item, url: item.url! }))),
    status,
    date: row.date,
    thumbnail_url: thumbnail,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    media: compatibleMedia,
  };
}

async function getAttachments(tx: ContentReadTransaction, postIds: string[]) {
  if (!postIds.length) return new Map<string, (typeof media.$inferSelect)[]>();
  const rows = await tx.select().from(media).where(inArray(media.postId, postIds)).orderBy(media.idx, media.createdAt);
  const grouped = new Map<string, (typeof media.$inferSelect)[]>();
  for (const row of rows) grouped.set(row.postId, [...(grouped.get(row.postId) ?? []), row]);
  return grouped;
}

export async function getDrizzleReadablePosts(requested: string, profile: UserProfile | null) {
  const allowed = publicBlogReadableStatuses(profile);
  const statuses = requested === "all" ? allowed : allowed.filter((status) => status === requested);
  const clauses = statuses.map(statusWhere).filter((clause): clause is NonNullable<typeof clause> => clause !== undefined);
  if (!clauses.length) return [];
  return withCurrentContentSession(async (tx) => {
    const rows = await tx.select(readablePostColumns).from(posts).where(and(
      or(...clauses), isNull(posts.deletedAt), isNull(posts.deletionDate),
    )).orderBy(desc(posts.date), desc(posts.createdAt)).limit(25);
    const grouped = await getAttachments(tx, rows.map((row) => row.id));
    return rows.filter((row) => canReadPost({ status: legacyStatus(row), deleted_at: row.deletedAt, deletion_date: row.deletionDate }, profile))
      .map((row) => serialize(row, grouped.get(row.id) ?? [], profile));
  });
}

export async function getDrizzleReadablePost(slug: string, profile: UserProfile | null) {
  const allowed = publicBlogReadableStatuses(profile);
  if (!allowed.length) return null;
  const clauses = allowed.map(statusWhere).filter((clause): clause is NonNullable<typeof clause> => clause !== undefined);
  if (!clauses.length) return null;
  return withCurrentContentSession(async (tx) => {
    let [row] = await tx.select(readablePostColumns).from(posts).where(and(
      eq(posts.slug, slug), or(...clauses), isNull(posts.deletedAt), isNull(posts.deletionDate),
    )).limit(1);
    // Preserve UUID detail links from legacy routes without changing the canonical slug.
    if (!row && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)) {
      [row] = await tx.select(readablePostColumns).from(posts).where(and(
        eq(posts.id, slug), or(...clauses), isNull(posts.deletedAt), isNull(posts.deletionDate),
      )).limit(1);
    }
    if (!row || !canReadPost({ status: legacyStatus(row), deleted_at: row.deletedAt, deletion_date: row.deletionDate }, profile)) return null;
    const grouped = await getAttachments(tx, [row.id]);
    return serialize(row, grouped.get(row.id) ?? [], profile);
  });
}
