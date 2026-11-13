import { getReadablePost } from "@/lib/blog/read";
import { privateJson } from "@/lib/auth/response";
import { isMissingConfigurationError } from "@/lib/db/config";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const post = await getReadablePost(slug);
    return post ? privateJson({ post }) : privateJson({ error: "Not found" }, 404);
  } catch (error) {
    if (isMissingConfigurationError(error)) {
      return privateJson({ error: "Database is not configured", missing: error.missing }, 503);
    }
    return privateJson({ error: "Failed to fetch post" }, 500);
  }
}
