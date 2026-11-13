import { type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { listOwnerPosts, type AdminPostFilter } from "@/lib/db/repositories/admin-posts";
import { privateJson } from "@/lib/auth/response";
import { createOwnerDraft } from "@/lib/db/repositories/admin-posts";
import { isSameOriginRequest } from "@/lib/auth/same-origin";

const FILTERS = new Set<AdminPostFilter>(["all", "public", "private", "draft", "archived"]);

export async function GET(request: NextRequest) {
  const denied = await requireAdminApi("posts:read");
  if (denied) return denied;
  const params = request.nextUrl.searchParams;
  const status = params.get("status") ?? "all";
  if (!FILTERS.has(status as AdminPostFilter)) return privateJson({ error: "Invalid status filter." }, 400);
  const rawLimit = Number(params.get("limit") ?? 25);
  const rawOffset = Number(params.get("offset") ?? 0);
  if (!Number.isSafeInteger(rawLimit) || !Number.isSafeInteger(rawOffset) || rawOffset < 0) {
    return privateJson({ error: "Invalid pagination." }, 400);
  }
  const search = params.get("q")?.trim() ?? "";
  if (search.length > 200) return privateJson({ error: "Search must be under 200 characters." }, 400);
  try {
    return privateJson(await listOwnerPosts({ limit: Math.min(50, Math.max(1, rawLimit)), offset: rawOffset, status: status as AdminPostFilter, search }));
  } catch {
    return privateJson({ error: "Unable to load the owner post list." }, 503);
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdminApi("posts:update");
  if (denied) return denied;
  if (!isSameOriginRequest(request)) return privateJson({ error: "Same-origin request required." }, 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return privateJson({ error: "Invalid JSON body." }, 400);
  const data = body as Record<string, unknown>;
  if (Object.keys(data).some((key) => !["title", "slug", "excerpt"].includes(key))) return privateJson({ error: "Only title, slug, and excerpt are accepted." }, 400);
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const slug = typeof data.slug === "string" ? data.slug.trim().toLowerCase() : "";
  const excerpt = data.excerpt === null || data.excerpt === undefined ? null : typeof data.excerpt === "string" ? data.excerpt.trim() : undefined;
  if (!title || title.length > 240 || /[\u0000-\u001f\u007f]/.test(title)) return privateJson({ error: "Title must contain 1–240 printable characters." }, 400);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 240) return privateJson({ error: "Slug must use lowercase letters, numbers, and single hyphens." }, 400);
  if (excerpt === undefined || (excerpt !== null && excerpt.length > 2000)) return privateJson({ error: "Excerpt must be text up to 2000 characters." }, 400);
  try {
    const post = await createOwnerDraft({ title, slug, excerpt });
    return privateJson({ post }, 201);
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    const cause = error && typeof error === "object" ? (error as { cause?: { code?: unknown; constraint?: unknown } }).cause : undefined;
    const causeCode = cause?.code;
    if (code === "23505" || causeCode === "23505") return privateJson({ error: "A post with this slug already exists." }, 409);
    if (process.env.LOCAL_PG_INTEGRATION === "1") console.warn("[phase6-cms] post-create-failed", {
      code: typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : null,
      causeCode: typeof causeCode === "string" && /^[0-9A-Z]{5}$/.test(causeCode) ? causeCode : null,
      constraint: typeof cause?.constraint === "string" && /^app_[a-z0-9_]{1,80}$/.test(cause.constraint) ? cause.constraint : null,
    });
    return privateJson({ error: "Post creation failed; no changes were confirmed." }, 503);
  }
}
