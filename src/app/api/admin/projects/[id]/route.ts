// src/app/api/admin/projects/[id]/route.ts
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { supabaseAdmin } from "@/lib/supabase/admin.server";

export async function GET(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await props.params;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("home_projects")
    .select(
      `
      id, idx, title, slug, excerpt, href, color, image_url,
      created_at, updated_at, content, status
    `
    )
    .eq("id", id)
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });
  if (!data) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json({ project: data });
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await props.params;

  const body = await req.json().catch(() => ({}));

  const patch: Record<string, any> = {};
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.slug === "string" || body.slug === null) patch.slug = body.slug;
  if (typeof body.excerpt === "string" || body.excerpt === null) patch.excerpt = body.excerpt;
  if (typeof body.href === "string" || body.href === null) patch.href = body.href;
  if (typeof body.color === "string" || body.color === null) patch.color = body.color;
  if (typeof body.image_url === "string" || body.image_url === null) patch.image_url = body.image_url;
  if (typeof body.content === "string") patch.content = body.content;

  patch.updated_at = new Date().toISOString();

  const db = supabaseAdmin();
  const { error } = await db.from("home_projects").update(patch).eq("id", id);

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await props.params;

  const db = supabaseAdmin();

  await db.from("home_project_media").delete().eq("project_id", id);

  const { error } = await db.from("home_projects").delete().eq("id", id);
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ ok: true });
}
