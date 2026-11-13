import { validateProjectMedia } from "@/lib/cms/projectMediaInput";
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
  meta: Record<string, unknown> | null;
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

  if (error) return NextResponse.json({ error: "Project media operation failed." }, { status: 500 });
  return NextResponse.json({ media: data ?? [] });
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id: projectId } = await props.params;
  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Expected a media object." }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (!Array.isArray(input.items) || input.items.length > 100 || (input.mode !== undefined && !["append", "replace"].includes(String(input.mode)))) {
    return NextResponse.json({ error: "Expected up to 100 media items and append/replace mode." }, { status: 400 });
  }
  const toInsert: InsertRow[] = [];
  for (const item of input.items) {
    const parsed = validateProjectMedia(item);
    if (parsed.error || !parsed.fields.url) return NextResponse.json({ error: parsed.error ?? "Missing media URL." }, { status: 400 });
    toInsert.push({ project_id: projectId, type: parsed.fields.type ?? "image", url: parsed.fields.url,
      caption: parsed.fields.caption ?? null, idx: parsed.fields.idx ?? null, meta: parsed.fields.meta ?? null });
  }
  const db = supabaseAdmin();
  // Validate the complete replacement before any deletion. This is still not a transaction.
  if (input.mode === "replace") {
    const { error } = await db.from("home_project_media").delete().eq("project_id", projectId);
    if (error) return NextResponse.json({ error: "Media replacement failed; insertion was not attempted." }, { status: 500 });
  }
  if (!toInsert.length) return NextResponse.json({ media: [] });

  const { data, error } = await db
    .from("home_project_media")
    .insert(toInsert)
    .select("id, project_id, type, url, caption, idx, meta, created_at");

  if (error) return NextResponse.json({ error: "Project media operation failed." }, { status: 500 });
  return NextResponse.json({ media: data ?? [] });
}
