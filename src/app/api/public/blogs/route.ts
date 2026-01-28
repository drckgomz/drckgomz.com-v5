// src/app/api/public/blogs/route.ts
import { NextResponse } from "next/server";
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
    return {
      userId: null,
      canViewPrivate: false,
      isBanned: false,
      isAdmin: false,
      isOwner: false,
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select("id,role,is_owner,is_banned,can_view_private")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      userId,
      canViewPrivate: false,
      isBanned: false,
      isAdmin: false,
      isOwner: false,
    };
  }

  const role = String(data.role || "").toLowerCase();
  const isOwner = !!data.is_owner;
  const isAdmin = isOwner || role === "admin";

  return {
    userId,
    canViewPrivate: !!data.can_view_private || isAdmin,
    isBanned: !!data.is_banned,
    isAdmin,
    isOwner,
  };
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    const access = await getViewerAccess(userId ?? null);

    // If they're banned, you can either:
    // - return empty list, or
    // - hard deny
    if (access.isBanned) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const { searchParams } = new URL(req.url);
    const requested = String(searchParams.get("status") || "public").toLowerCase();

    // 🔒 Never allow "all" unless user can view private
    const effectiveStatus =
      requested === "all" ? (access.canViewPrivate ? "all" : "public") : requested;

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from(POSTS_TABLE)
      .select(
        `
        id,
        slug,
        title,
        excerpt,
        content,
        status,
        date,
        thumbnail_url,
        created_at,
        media (
          id,
          type,
          url,
          caption,
          idx
        )
      `
      )
      .order("date", { ascending: false })
      .order("idx", { referencedTable: "media", ascending: true })
      .limit(25);

    if (effectiveStatus !== "all") {
      // default behavior = public-only
      query = query.eq("status", effectiveStatus === "public" ? "public" : effectiveStatus);
    } else {
      // allowed "all" still should not include drafts/archived unless you want it to
      // If you ONLY mean "public + private", uncomment this filter:
      // query = query.in("status", ["public", "private"]);
    }

    // If they cannot view private, hard filter private out (belt + suspenders)
    if (!access.canViewPrivate) {
      query = query.neq("status", "private");
    }

    const { data, error } = await query;

    if (error) {
      console.error("[BLOGS_API] Supabase error:", error);
      return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
    }

    const out = (data ?? []).map((p: any) => ({
      ...p,
      thumbnail_url: normalizeMaybeS3Url(p.thumbnail_url ?? null),
      media: Array.isArray(p.media)
        ? p.media.map((m: any) => ({
            ...m,
            url: normalizeMaybeS3Url(m.url ?? null),
          }))
        : [],
    }));

    return NextResponse.json({ items: out });
  } catch (err) {
    console.error("[BLOGS_API] Fatal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
