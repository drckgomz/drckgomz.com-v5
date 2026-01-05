// src/app/api/admin/projects/[id]/media/route.ts
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { supabaseAdmin } from "@/lib/supabase/admin.server";

type InsertRow = {
  project_id: string;
  type: string;
  url: string;
  caption: string | null;
  idx: number | null;
  meta: any;
};

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id: projectId } = await props.params;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("home_project_media")
    .select("id, project_id, type, url, caption, idx, meta, created_at")
    .eq("project_id", projectId)
    .order("idx", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ media: data ?? [] });
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id: projectId } = await props.params;
  const body = await req.json().catch(() => ({}));

  const items = Array.isArray(body?.items) ? body.items : [];
  const mode: "append" | "replace" = body?.mode === "replace" ? "replace" : "append";

  const db = supabaseAdmin();

  if (mode === "replace") {
    await db.from("home_project_media").delete().eq("project_id", projectId);
  }

  const toInsert: InsertRow[] = items
    .map((it: any): InsertRow => ({
      project_id: projectId,
      type: typeof it.type === "string" ? it.type : "image",
      url: String(it.url || ""),
      caption: typeof it.caption === "string" ? it.caption : null,
      idx: Number.isFinite(it.idx) ? Number(it.idx) : null,
      meta: it.meta ?? null,
    }))
    .filter((row: InsertRow) => row.url.length > 0);


  if (toInsert.length === 0) {
    return NextResponse.json({ media: [] });
  }

  const { data, error } = await db
    .from("home_project_media")
    .insert(toInsert)
    .select("id, project_id, type, url, caption, idx, meta, created_at");

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ media: data ?? [] });
}
