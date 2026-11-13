import { type NextRequest } from "next/server";
import { privateJson } from "@/lib/auth/response";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { deleteOwnerPost, getOwnerPostBySlug, postMetadataAvailable, updateOwnerPostStatus, updateOwnerPostText, type OwnerPostStatus } from "@/lib/db/repositories/admin-posts";
import { sanitizeBlogHtml } from "@/lib/blog/content.server";
import { isSameOriginRequest } from "@/lib/auth/same-origin";

import { boundedJson, CmsInputError } from "@/lib/cms/request";
import { validatePostInput } from "@/lib/cms/postInput";

const MAX_CONTENT_LENGTH = 2_000_000;

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const denied = await requireAdminApi("posts:read");
  if (denied) return denied;
  const { slug } = await ctx.params;
  try {
    const post = await getOwnerPostBySlug(slug);
    return post ? privateJson({ post }) : privateJson({ error: "Not found" }, 404);
  } catch {
    return privateJson({ error: "Unable to load the post." }, 503);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const denied = await requireAdminApi("posts:update");
  if (denied) return denied;
  if (!isSameOriginRequest(request)) return privateJson({ error: "Same-origin request required." }, 403);
  let body: unknown;
  try { body = await boundedJson(request, 12_100_000); }
  catch (error) { return privateJson({ error: error instanceof CmsInputError ? error.message : "Invalid request body." }, error instanceof CmsInputError ? error.status : 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return privateJson({ error: "Invalid JSON body." }, 400);
  const record = body as Record<string, unknown>;
  if (Object.hasOwn(record, "status")) {
    if (Object.keys(record).length !== 2 || !["draft", "public", "private", "archived"].includes(String(record.status))) {
      return privateJson({ error: "Provide only a supported status and expected_revision." }, 400);
    }
    if (!Number.isSafeInteger(record.expected_revision) || Number(record.expected_revision) < 1) {
      return privateJson({ error: "Reload the post before changing its status." }, 428);
    }
    try {
      const result = await updateOwnerPostStatus({ slug: (await ctx.params).slug, status: record.status as OwnerPostStatus, expectedRevision: Number(record.expected_revision) });
      if (result === "missing") return privateJson({ error: "Post not found." }, 404);
      if (result === "conflict") return privateJson({ error: "This post changed in another session. Reload before changing its status." }, 409);
      return privateJson({ ok: true });
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      if (process.env.LOCAL_PG_INTEGRATION === "1") console.warn("[phase6-cms] post-status-update-failed", { code: typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : null });
      return privateJson({ error: "Post status change failed; no changes were confirmed." }, 503);
    }
  }
  const allowed = new Set(["expected_revision", "title", "content", "excerpt", "date"]);
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    return privateJson({ error: "Unsupported post editing fields." }, 501);
  }
  if (!Number.isSafeInteger(record.expected_revision) || Number(record.expected_revision) < 1) {
    return privateJson({ error: "Reload the post before saving; a valid revision is required." }, 428);
  }
  if (!["title", "content", "excerpt", "date"].some(key => Object.hasOwn(record, key))) {
    return privateJson({ error: "Provide a title, content, excerpt, or date change." }, 400);
  }
  if (Object.hasOwn(record, "title") && (typeof record.title !== "string" || !record.title.trim() || record.title.length > 240 || /[\u0000-\u001f\u007f]/.test(record.title))) {
    return privateJson({ error: "Title must contain 1–240 printable characters." }, 400);
  }
  if (Object.hasOwn(record, "content") && (typeof record.content !== "string" || record.content.length > MAX_CONTENT_LENGTH)) {
    return privateJson({ error: "Content must be text under 2 MB." }, 400);
  }

  const metadata = Object.fromEntries(["excerpt", "date"].filter(key => Object.hasOwn(record, key)).map(key => [key, record[key]]));
  if (Object.keys(metadata).length) {
    const validated = validatePostInput(metadata);
    if (validated.error || (typeof record.date === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(record.date))) return privateJson({ error: validated.error || "Date must use YYYY-MM-DD." }, 400);
    if (!await postMetadataAvailable()) return privateJson({ error: "Post metadata editing requires the approved local metadata grant. No changes were made." }, 503);
    Object.assign(metadata, validated.fields);
  }
  const { slug } = await ctx.params;
  try {
    const result = await updateOwnerPostText({
      slug,
      expectedRevision: Number(record.expected_revision),
      ...metadata as { excerpt?: string | null; date?: string | null },
      ...(typeof record.title === "string" ? { title: record.title.trim() } : {}),
      ...(typeof record.content === "string" ? { content: sanitizeBlogHtml(record.content) } : {}),
    });
    if (result.kind === "legacy-protected") return privateJson({ error: "Recovered source content is protected. Create a new draft to adapt it; the original remains unchanged." }, 409);
    if (result.kind === "missing") return privateJson({ error: "Post not found." }, 404);
    if (result.kind === "conflict") return privateJson({ error: "This post changed in another session. Reload before saving." }, 409);
    return privateJson({ post: result.post });
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (process.env.LOCAL_PG_INTEGRATION === "1") console.warn("[phase6-cms] post-text-update-failed", { code: typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : null });
    return privateJson({ error: "Post save failed; no changes were confirmed." }, 503);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const denied = await requireAdminApi("posts:update");
  if (denied) return denied;
  if (!isSameOriginRequest(request)) return privateJson({ error: "Same-origin request required." }, 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 1 ||
      !Number.isSafeInteger((body as Record<string, unknown>).expected_revision) || Number((body as Record<string, unknown>).expected_revision) < 1) {
    return privateJson({ error: "A current expected_revision is required." }, 428);
  }
  try {
    const result = await deleteOwnerPost({ slug: (await ctx.params).slug, expectedRevision: Number((body as Record<string, unknown>).expected_revision) });
    if (result === "missing") return privateJson({ error: "Post not found." }, 404);
    if (result === "conflict") return privateJson({ error: "This post changed in another session. Reload before deleting." }, 409);
    if (result === "has-media") return privateJson({ error: "Remove or replace linked media through the media manager before deleting this post." }, 409);
    return privateJson({ ok: true });
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (code === "23503") return privateJson({ error: "This post is still linked to other content and cannot be deleted." }, 409);
    if (process.env.LOCAL_PG_INTEGRATION === "1") console.warn("[phase6-cms] post-delete-failed", { code: typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : null });
    return privateJson({ error: "Post deletion failed; no changes were confirmed." }, 503);
  }
}
