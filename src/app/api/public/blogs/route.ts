import { getReadablePosts, hasLockedPrivatePosts } from "@/lib/blog/read";
import { privateJson } from "@/lib/auth/response";
import { isMissingConfigurationError } from "@/lib/db/config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requested = (new URL(req.url).searchParams.get("status") || "public").toLowerCase();
  // The public collection endpoint is intentionally not a general CMS query.
  // Restricted content is available only through per-post server checks.
  if (requested !== "public") {
    return privateJson({ error: "Only published public posts are available in this collection." }, 400);
  }
  try {
    const items = await getReadablePosts("public");
    let lockedPosts = false;
    try { lockedPosts = await hasLockedPrivatePosts(); }
    catch { /* A generic locked teaser is optional; public results remain available. */ }
    return privateJson({ items, lockedPosts });
  } catch (error) {
    if (isMissingConfigurationError(error)) {
      return privateJson({ error: "Database is not configured", missing: error.missing }, 503);
    }
    return privateJson({ error: "Failed to fetch posts" }, 500);
  }
}
