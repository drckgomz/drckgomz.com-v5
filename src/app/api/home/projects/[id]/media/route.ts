// src/app/api/home/projects/[id]/media/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 0;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> } // Next 16 params is a Promise
) {
  const { id } = await context.params;
  const supabase = createSupabaseServerClient();

  // ✅ Guard: only return media if project is public
  const { data: proj, error: projErr } = await supabase
    .from("home_projects")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (projErr) {
    console.error("[api/home/projects/[id]/media] project lookup error", projErr);
    return NextResponse.json(
      { media: [], error: "Failed to load project" },
      { status: 500 }
    );
  }

  if (!proj || proj.status !== "public") {
    return NextResponse.json({ media: [] }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("home_project_media")
    .select("id, type, url, caption, idx, meta, created_at")
    .eq("project_id", id)
    .order("idx", { ascending: true });

  if (error) {
    console.error("[api/home/projects/[id]/media] supabase error", error);
    return NextResponse.json(
      { media: [], error: "Failed to load project media" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      media: (data ?? []).map((row) => ({
        id: row.id,
        type: row.type,
        url: row.url,
        caption: row.caption,
        idx: row.idx,
        meta: row.meta,
        created_at: row.created_at,
      })),
    },
    { status: 200 }
  );
}
