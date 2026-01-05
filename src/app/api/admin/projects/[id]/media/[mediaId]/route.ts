// src/app/api/admin/projects/[id]/media/[mediaId]/route.ts
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { supabaseAdmin } from "@/lib/supabase/admin.server";

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string; mediaId: string }> }
) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id: projectId, mediaId } = await props.params;
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, any> = {};
  if (typeof body.caption === "string" || body.caption === null) patch.caption = body.caption;
  if (typeof body.idx === "number" || body.idx === null) patch.idx = body.idx;
  if (typeof body.type === "string") patch.type = body.type;
  if (typeof body.url === "string") patch.url = body.url;
  if (typeof body.meta === "object") patch.meta = body.meta;

  const db = supabaseAdmin();
  const { error } = await db
    .from("home_project_media")
    .update(patch)
    .eq("id", mediaId)
    .eq("project_id", projectId);

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string; mediaId: string }> }
) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id: projectId, mediaId } = await props.params;

  const db = supabaseAdmin();
  const { error } = await db
    .from("home_project_media")
    .delete()
    .eq("id", mediaId)
    .eq("project_id", projectId);

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
