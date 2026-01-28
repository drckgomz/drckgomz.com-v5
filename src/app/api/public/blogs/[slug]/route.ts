// src/app/api/public/blogs/[slug]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeMaybeS3Url } from "@/lib/blog/media";

const POSTS_TABLE = "posts";
const PROFILES_TABLE = "user_profiles";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Missing Supabase env");
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getViewerAccess(userId: string | null) {
  if (!userId) {
    return { canViewPrivate: false, isBanned: false };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select("role,is_owner,is_banned,can_view_private")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return { canViewPrivate: false, isBanned: false };

  const role = String(data.role || "").toLowerCase();
  const isAdmin = !!data.is_owner || role === "admin";

  return {
    canViewPrivate: !!data.can_view_private || isAdmin,
    isBanned: !!data.is_banned,
  };
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  try {
    const { userId } = await auth();
    const access = await getViewerAccess(userId ?? null);

    // If banned, treat as not found (prevents probing)
    if (access.isBanned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { slug } = await ctx.params;
    const slugParam = decodeURIComponent(slug);

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from(POSTS_TABLE)
      .select(
        `
        id,slug,title,excerpt,content,status,date,thumbnail_url,created_at,updated_at,
        media ( id,type,url,caption,idx,created_at,title )
      `
      )
      .eq("slug", slugParam)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // 🔒 Protect private posts
    const status = String((data as any).status || "").toLowerCase();
    if (status === "private" && !access.canViewPrivate) {
      // recommended: 404 so users can’t confirm it exists
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const post = {
      ...data,
      thumbnail_url: normalizeMaybeS3Url((data as any).thumbnail_url),
      media: Array.isArray((data as any).media)
        ? (data as any).media.map((m: any) => ({ ...m, url: normalizeMaybeS3Url(m.url) }))
        : [],
    };

    return NextResponse.json({ post });
  } catch (e) {
    console.error("[BLOG_SLUG_API] Fatal error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
