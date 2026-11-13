import { validateProjectMedia } from "@/lib/cms/projectMediaInput";
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
  const body: unknown = await req.json().catch(() => null);
  const db = supabaseAdmin();
  const { data: existing, error: lookupError } = await db.from("home_project_media")
    .select("id,type,url").eq("id", mediaId).eq("project_id", projectId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Media lookup failed." }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = validateProjectMedia(body, existing);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  let update = db.from("home_project_media").update(parsed.fields).eq("id", mediaId).eq("project_id", projectId);
  if ("type" in parsed.fields || "url" in parsed.fields) update = update.eq("type", existing.type).eq("url", existing.url);
  const { data: saved, error } = await update.select("id").maybeSingle();

  if (error) return NextResponse.json({ error: "Project media operation failed." }, { status: 500 });
  if (!saved) return NextResponse.json({ error: "Media changed. Reload before retrying." }, { status: 409 });
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

  if (error) return NextResponse.json({ error: "Project media operation failed." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
