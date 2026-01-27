// src/app/api/public/blogs/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeMaybeS3Url } from "@/lib/blog/media";

export async function GET(req: Request) {
  try {
    const supabase = createSupabaseServerClient();
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");

    let query = supabase
      .from("posts")
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
      // ✅ IMPORTANT: ensure media[0] is always the smallest idx
      .order("idx", { referencedTable: "media", ascending: true })
      .limit(25);

    // Public users only see public posts
    if (status !== "all") {
      query = query.eq("status", "public");
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

    return NextResponse.json(out);
  } catch (err) {
    console.error("[BLOGS_API] Fatal error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
