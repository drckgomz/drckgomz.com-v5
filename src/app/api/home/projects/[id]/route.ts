// src/app/api/home/projects/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const id = decodeURIComponent(params.id);

  const { data, error } = await supabase
    .from("home_projects")
    .select(
      "id, idx, title, slug, excerpt, href, color, image_url, content, status"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[GET /api/home/projects/[id]] error", error);
    return NextResponse.json({ project: null }, { status: 500 });
  }

  return NextResponse.json({ project: data });
}
