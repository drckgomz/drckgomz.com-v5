// src/app/api/home/projects/[id]/media/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const id = decodeURIComponent(params.id);

  const { data, error } = await supabase
    .from("home_project_media")
    .select("id, type, url, caption, idx, meta, created_at")
    .eq("project_id", id)
    .order("idx", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[GET /api/home/projects/[id]/media] error", error);
    return NextResponse.json({ media: [] }, { status: 500 });
  }

  return NextResponse.json({ media: data ?? [] });
}
