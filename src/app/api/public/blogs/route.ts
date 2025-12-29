// src/app/api/public/blogs/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
      .limit(25);

    // Public users only see public posts
    if (status !== "all") {
      query = query.eq("status", "public");
    }

    const { data, error } = await query;

    if (error) {
      console.error("[BLOGS_API] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch posts" },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[BLOGS_API] Fatal error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
