// src/app/api/admin/projects/route.ts
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { supabaseAdmin } from "@/lib/supabase/admin.server";

export async function GET(req: Request) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // "public" | "private" | "draft" | null

  const db = supabaseAdmin();

  let q = db
    .from("home_projects")
    .select(
      `
      id, idx, title, slug, excerpt, href, color, image_url,
      created_at, updated_at, content, status
    `
    )
    .order("idx", { ascending: true });

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ projects: data ?? [] });
}
