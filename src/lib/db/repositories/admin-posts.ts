import "server-only";
import { and, desc, eq, getTableColumns, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { media, posts } from "@/lib/db/schema";
import { withCurrentOwnerSession, type OwnerOperationTransaction } from "@/lib/db/owner-session";
import { preparePrivateBlogContent } from "@/lib/blog/content.server";
import { localLegacyBlogImagePreviewUrl } from "@/lib/blog/legacy-media-preview";
import type { AdminPost, PostStatus } from "@/lib/admin/types";

export type AdminPostFilter = "all" | PostStatus;

function adminStatus(row: typeof posts.$inferSelect): PostStatus {
  if (row.publicationState === "draft") return "draft";
  if (row.publicationState === "archived") return "archived";
  return row.visibility === "public" ? "public" : "private";
}

function formatPost(row: typeof posts.$inferSelect, attachments: Array<typeof media.$inferSelect> = [], includeBody = true): AdminPost {
  const status = adminStatus(row);
  const previewAttachments = attachments.flatMap((item) => {
    const url = item.type === "image" ? localLegacyBlogImagePreviewUrl(item.id, item.url) : null;
    return url ? [{ id: item.sourceMediaId || item.id, type: "image" as const, url, caption: item.caption, title: item.title }] : [];
  });
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: includeBody ? preparePrivateBlogContent(row.content, previewAttachments) : null,
    editor_content: includeBody && row.legacyStatus === null ? row.content : null,
    legacy_content: row.legacyStatus !== null,
    status,
    date: row.date,
    published_at: row.publishedAt?.toISOString() ?? null,
    thumbnail_url: null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    revision: row.revision,
    publication_state: row.publicationState,
    visibility: row.visibility,
    media: attachments.map((item) => ({
      id: item.id,
      post_id: item.postId,
      type: item.type,
      // Local draft previews use an owner-only, no-store proxy. The raw legacy
      // S3 URL is never returned by the admin API.
      url: item.type === "image" ? localLegacyBlogImagePreviewUrl(item.id, item.url) : null,
      caption: item.caption,
      idx: item.idx,
      title: item.title,
    })),
  };
}

export async function getOwnerLegacyMediaSourceById(id: string) {
  return withCurrentOwnerSession(async (tx) => {
    const [row] = await tx.select({ id: media.id, url: media.url, postId: posts.id,
      publicationState: posts.publicationState, visibility: posts.visibility,
      deletedAt: posts.deletedAt, deletionDate: posts.deletionDate,
    }).from(media).innerJoin(posts, eq(media.postId, posts.id)).where(eq(media.id, id)).limit(1);
    if (!row || row.deletedAt !== null || row.deletionDate !== null) return null;
    return row;
  });
}

function filterCondition(filter: AdminPostFilter) {
  if (filter === "draft") return eq(posts.publicationState, "draft");
  if (filter === "archived") return eq(posts.publicationState, "archived");
  if (filter === "public") return and(eq(posts.publicationState, "published"), eq(posts.visibility, "public"));
  if (filter === "private") return and(eq(posts.publicationState, "published"), sql`${posts.visibility} <> 'public'`);
  return undefined;
}

async function selectMedia(tx: OwnerOperationTransaction, postIds: string[]) {
  if (postIds.length === 0) return new Map<string, Array<typeof media.$inferSelect>>();
  const records = await tx.select().from(media).where(inArray(media.postId, postIds)).orderBy(media.postId, media.idx, media.id);
  const map = new Map<string, Array<typeof media.$inferSelect>>();
  for (const item of records) map.set(item.postId, [...(map.get(item.postId) ?? []), item]);
  return map;
}

export async function listOwnerPosts(options: { limit: number; offset: number; status: AdminPostFilter; search?: string }) {
  const limit = Math.min(50, Math.max(1, Math.trunc(options.limit)));
  const offset = Math.max(0, Math.trunc(options.offset));
  return withCurrentOwnerSession(async (tx) => {
    const filters = [filterCondition(options.status)];
    const search = options.search?.trim();
    if (search) {
      const term = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      filters.push(or(ilike(posts.title, term), ilike(posts.slug, term), ilike(posts.excerpt, term)));
    }
    const columns = getTableColumns(posts);
    const projection = { ...columns };
    // The list must never select a potentially multi-megabyte HTML body.
    const { content: _body, ...summaryColumns } = projection;
    void _body;
    const records = await tx.select(summaryColumns).from(posts).where(and(...filters)).orderBy(desc(posts.updatedAt), posts.id).limit(limit + 1).offset(offset);
    const hasMore = records.length > limit;
    const page = records.slice(0, limit);
    const mediaByPost = await selectMedia(tx, page.map((post) => post.id));
    return { posts: page.map((post) => formatPost({ ...post, content: "" }, mediaByPost.get(post.id), false)), hasMore, nextOffset: offset + page.length };
  });
}

export async function getOwnerPostBySlug(slug: string): Promise<AdminPost | null> {
  return withCurrentOwnerSession(async (tx) => {
    const [row] = await tx.select().from(posts).where(eq(posts.slug, slug)).limit(1);
    if (!row) return null;
    const attachments = await selectMedia(tx, [row.id]);
    return formatPost(row, attachments.get(row.id));
  });
}

/** Narrow readiness check; never enables controls by assuming a migration ran. */
export async function postMetadataAvailable(): Promise<boolean> {
  try {
    return await withCurrentOwnerSession(async tx => {
      const result = await tx.execute(sql`select
        pg_catalog.has_column_privilege(current_user, 'app.posts', 'excerpt', 'UPDATE')
        and pg_catalog.has_column_privilege(current_user, 'app.posts', 'date', 'UPDATE') as available`);
      return result.rows[0]?.available === true;
    });
  } catch { return false; }
}

export async function updateOwnerPostText(input: {
  slug: string;
  expectedRevision: number;
  title?: string;
  content?: string;
  excerpt?: string | null;
  date?: string | null;
}): Promise<{ kind: "saved"; post: AdminPost } | { kind: "conflict" } | { kind: "missing" } | { kind: "legacy-protected" }> {
  return withCurrentOwnerSession(async (tx) => {
    const update: Partial<typeof posts.$inferInsert> = {
      updatedAt: new Date(),
      revision: sql`${posts.revision} + 1` as unknown as number,
    };
    if (input.title !== undefined) update.title = input.title;
    if (input.content !== undefined) update.content = input.content;
    if (input.excerpt !== undefined) update.excerpt = input.excerpt;
    if (input.date !== undefined) update.date = input.date;
    const [row] = await tx.update(posts).set(update)
      .where(and(eq(posts.slug, input.slug), eq(posts.revision, input.expectedRevision), input.content !== undefined ? isNull(posts.legacyStatus) : undefined))
      .returning();
    if (row) {
      const attachments = await selectMedia(tx, [row.id]);
      return { kind: "saved", post: formatPost(row, attachments.get(row.id)) };
    }
    const [existing] = await tx.select({ id: posts.id, legacyStatus: posts.legacyStatus }).from(posts).where(eq(posts.slug, input.slug)).limit(1);
    if (existing && input.content !== undefined && existing.legacyStatus !== null) return { kind: "legacy-protected" };
    return existing ? { kind: "conflict" } : { kind: "missing" };
  });
}

export async function createOwnerDraft(input: { title: string; slug: string; excerpt: string | null }) {
  return withCurrentOwnerSession(async (tx) => {
    const now = new Date();
    const id = crypto.randomUUID();
    // Use an explicit INSERT column list. Drizzle's generic insert builder emits
    // every table column (using DEFAULT for omitted properties), which would
    // require broad table-level INSERT instead of the narrow column grants.
    const result = await tx.execute(sql`
      INSERT INTO app.posts (id, slug, title, excerpt, content, publication_state, visibility, date, created_at, updated_at, revision)
      VALUES (${id}, ${input.slug}, ${input.title}, ${input.excerpt}, '', 'draft', 'private', ${now.toISOString().slice(0, 10)}, ${now}, ${now}, 1)
      RETURNING id, slug
    `);
    const [row] = result.rows as Array<{ id: string; slug: string }>;
    return row;
  });
}

export type OwnerPostStatus = "draft" | "public" | "private" | "archived";

export async function updateOwnerPostStatus(input: {
  slug: string; status: OwnerPostStatus; expectedRevision: number;
}): Promise<"saved" | "conflict" | "missing"> {
  return withCurrentOwnerSession(async (tx) => {
    const now = new Date();
    const update: Partial<typeof posts.$inferInsert> = {
      updatedAt: now,
      revision: sql`${posts.revision} + 1` as unknown as number,
    };
    if (input.status === "draft") update.publicationState = "draft";
    if (input.status === "archived") update.publicationState = "archived";
    if (input.status === "public") {
      update.publicationState = "published";
      update.visibility = "public";
      update.publishedAt = sql`coalesce(${posts.publishedAt}, ${now})` as unknown as Date;
    }
    if (input.status === "private") {
      update.publicationState = "published";
      update.visibility = "private";
      update.publishedAt = sql`coalesce(${posts.publishedAt}, ${now})` as unknown as Date;
    }
    const rows = await tx.update(posts).set(update)
      .where(and(eq(posts.slug, input.slug), eq(posts.revision, input.expectedRevision)))
      .returning({ id: posts.id });
    if (rows.length) return "saved";
    const [existing] = await tx.select({ id: posts.id }).from(posts).where(eq(posts.slug, input.slug)).limit(1);
    return existing ? "conflict" : "missing";
  });
}

export async function deleteOwnerPost(input: { slug: string; expectedRevision: number }): Promise<"deleted" | "conflict" | "missing" | "has-media"> {
  return withCurrentOwnerSession(async (tx) => {
    const [post] = await tx.select({ id: posts.id, revision: posts.revision }).from(posts)
      .where(eq(posts.slug, input.slug)).limit(1);
    if (!post) return "missing";
    if (post.revision !== input.expectedRevision) return "conflict";
    const [attachment] = await tx.select({ id: media.id }).from(media).where(eq(media.postId, post.id)).limit(1);
    if (attachment) return "has-media";
    const deleted = await tx.delete(posts).where(and(eq(posts.id, post.id), eq(posts.revision, input.expectedRevision))).returning({ id: posts.id });
    return deleted.length ? "deleted" : "conflict";
  });
}

/** Duplicate stored text, never rendered preview HTML or media origin metadata. */
export async function duplicateOwnerDraft(input: { slug: string; expectedRevision: number }) {
  return withCurrentOwnerSession(async tx => {
    const [source] = await tx.select().from(posts).where(eq(posts.slug,input.slug)).for('share').limit(1);
    if (!source) return { kind: 'missing' as const };
    if (source.revision !== input.expectedRevision) return { kind: 'conflict' as const };
    if (source.content.length > 2_000_000) return { kind: 'too-large' as const };
    const id=crypto.randomUUID(),now=new Date();
    const slug=`${source.slug.slice(0,210).replace(/-+$/,'')}-copy-${id.slice(0,8)}`;
    const title=`${source.title.slice(0,233)} (copy)`;
    await tx.execute(sql`insert into app.posts(id,slug,title,excerpt,content,publication_state,visibility,date,created_at,updated_at,revision)
      values(${id},${slug},${title},${source.excerpt},${source.content},'draft','private',${now.toISOString().slice(0,10)},${now},${now},1)`);
    return {kind:'created' as const,post:{id,slug},notice:'Created a private text-only draft copy. Media associations and featured images were not copied; the original was not changed.'};
  });
}
