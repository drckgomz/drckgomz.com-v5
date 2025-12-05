// src/app/api/home/projects/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 0;

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> } // 👈 Next 16 expects params to be a Promise
) {
  // params is a Promise<{ id: string }>
  const { id } = await context.params;

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("home_projects")
    .select(
      "id, idx, title, slug, excerpt, href, color, image_url, content, status"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[api/home/projects/[id]] supabase error", error);
    return NextResponse.json(
      { project: null, error: "Failed to load project" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      project: data ?? null,
    },
    { status: 200 }
  );
}
