import { sanitizeProjectHtml, safeProjectUrl } from "@/lib/content/projectHtml";
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

  if (error) return NextResponse.json({ error: "Project operation failed." }, { status: 500 });
  if (!data) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json({ project: { ...data, content: sanitizeProjectHtml(data.content), href: safeProjectUrl(data.href, true), image_url: safeProjectUrl(data.image_url) } });
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await props.params;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Expected a project object." }, { status: 400 });
  if ("status" in body && !["draft", "private", "public", "archived"].includes(body.status)) return NextResponse.json({ error: "Invalid project status." }, { status: 400 });

  const patch: Record<string, string | null> = {};
  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.slug === "string" || body.slug === null) patch.slug = body.slug;
  if (typeof body.excerpt === "string" || body.excerpt === null) patch.excerpt = body.excerpt;
  if (typeof body.href === "string" || body.href === null) patch.href = safeProjectUrl(body.href, true);
  if (typeof body.color === "string" || body.color === null) patch.color = body.color;
  if (typeof body.image_url === "string" || body.image_url === null) patch.image_url = safeProjectUrl(body.image_url);
  if (typeof body.content === "string") patch.content = sanitizeProjectHtml(body.content);

  patch.updated_at = new Date().toISOString();

  const db = supabaseAdmin();
  const { error } = await db.from("home_projects").update(patch).eq("id", id);

  if (error) return NextResponse.json({ error: "Project operation failed." }, { status: 500 });
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

  const removal = await db.from("home_project_media").delete().eq("project_id", id);
  if (removal.error) return NextResponse.json({ error: "Media removal failed; project retained." }, { status: 500 });

  const { error } = await db.from("home_projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Project operation failed." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
