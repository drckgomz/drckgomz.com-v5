import "server-only";
import { eq, sql } from "drizzle-orm";
import { media, posts } from "@/lib/db/schema";
import { withCurrentOwnerSession } from "@/lib/db/owner-session";

export async function addOwnerPostMedia(input: { slug: string; id: string; key: string; type: "image" | "video"; caption: string | null; title: string | null }) {
  return withCurrentOwnerSession(async (tx) => {
    const [post] = await tx.execute(sql`select id from app.posts where slug=${input.slug} for update`).then((r) => r.rows as Array<{ id: string }>);
    if (!post) return null;
    const [last] = await tx.select({ idx: media.idx }).from(media).where(eq(media.postId, post.id)).orderBy(sql`${media.idx} desc`).limit(1);
    const idx = last ? last.idx + 1 : 0;
    const result = await tx.execute(sql`
      insert into app.media (id, post_id, type, url, caption, idx, title, created_at)
      values (${input.id}, ${post.id}, ${input.type}, ${input.key}, ${input.caption}, ${idx}, ${input.title}, now())
      returning id, post_id, type, url, caption, idx, title
    `);
    return result.rows[0] ?? null;
  });
}

export async function addOwnerPostEmbed(input: { slug: string; id: string; type: "youtube" | "instagram"; url: string; caption: string | null }) {
  return withCurrentOwnerSession(async (tx) => {
    const [post] = await tx.execute(sql`select id from app.posts where slug=${input.slug} for update`).then((r) => r.rows as Array<{ id: string }>);
    if (!post) return null;
    const [last] = await tx.select({ idx: media.idx }).from(media).where(eq(media.postId, post.id)).orderBy(sql`${media.idx} desc`).limit(1);
    const result = await tx.execute(sql`
      insert into app.media (id, post_id, type, url, caption, idx, created_at)
      values (${input.id}, ${post.id}, ${input.type}, ${input.url}, ${input.caption}, ${last ? last.idx + 1 : 0}, now())
      returning id, post_id, type, url, caption, idx
    `);
    return result.rows[0] ?? null;
  });
}

export async function updateOwnerMediaCaption(id: string, caption: string | null) {
  return withCurrentOwnerSession(async (tx) => {
    const rows = await tx.update(media).set({ caption }).where(eq(media.id, id)).returning({ id: media.id, postId: media.postId, type: media.type, url: media.url, caption: media.caption, idx: media.idx });
    return rows[0] ?? null;
  });
}

export async function reorderOwnerPostMedia(slug: string, ids: string[]) {
  return withCurrentOwnerSession(async (tx) => {
    const [post] = await tx.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).for("update").limit(1);
    if (!post) return "missing" as const;
    const existing = await tx.select({ id: media.id }).from(media).where(eq(media.postId, post.id)).orderBy(media.idx, media.id).for("update");
    const existingIds = existing.map((item) => item.id);
    if (new Set(ids).size !== ids.length || ids.length !== existingIds.length || ids.some((id) => !existingIds.includes(id))) return "conflict" as const;
    for (const [idx, id] of ids.entries()) {
      await tx.update(media).set({ idx }).where(sql`${media.id} = ${id} and ${media.postId} = ${post.id}`);
    }
    return "saved" as const;
  });
}

export async function deleteOwnerMediaRecord(id: string) {
  return withCurrentOwnerSession(async (tx) => {
    const [item] = await tx.select({ id: media.id, url: media.url }).from(media).where(eq(media.id, id)).for("update").limit(1);
    if (!item) return null;
    if (!item.url?.startsWith("journal-private/")) return { key: null, deleted: false };
    const result = await tx.delete(media).where(eq(media.id, id)).returning({ id: media.id });
    return result.length ? { key: item.url, deleted: true } : { key: null, deleted: false };
  });
}
