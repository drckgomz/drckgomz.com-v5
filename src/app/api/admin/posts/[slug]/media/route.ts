import { privateJson } from "@/lib/auth/response";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { getOwnerPostBySlug } from "@/lib/db/repositories/admin-posts";

/** Read-only media metadata for the local CMS slice; URLs remain quarantined. */
export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const denied = await requireAdminApi("posts:read");
  if (denied) return denied;
  const { slug } = await ctx.params;
  try {
    const post = await getOwnerPostBySlug(slug);
    if (!post) return privateJson({ error: "Not found" }, 404);
    return privateJson({ media: post.media ?? [] });
  } catch {
    return privateJson({ error: "Unable to load media references." }, 503);
  }
}
