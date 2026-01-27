// src/app/api/admin/posts/[slug]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { normalizeMaybeS3Url } from "@/lib/blog/media";

const POSTS_TABLE = "posts";
const MEDIA_TABLE = "media";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizePostForClient(p: any) {
  if (!p || typeof p !== "object") return p;
  return {
    ...p,
    thumbnail_url: normalizeMaybeS3Url(p.thumbnail_url ?? null),
  };
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { slug } = await ctx.params;
  const slugParam = decodeURIComponent(slug);

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .select("id,slug,title,excerpt,content,status,date,thumbnail_url,created_at,updated_at")
    .eq("slug", slugParam)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ post: normalizePostForClient(data) });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { slug } = await ctx.params;
  const slugParam = decodeURIComponent(slug);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing, error: findErr } = await supabase
    .from(POSTS_TABLE)
    .select("id,slug")
    .eq("slug", slugParam)
    .maybeSingle();

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });

  const updates: Record<string, any> = { updated_at: now };

  if ((body as any).title !== undefined) updates.title = (body as any).title ?? "";
  if ((body as any).slug !== undefined) updates.slug = (body as any).slug ?? slugParam;
  if ((body as any).excerpt !== undefined) updates.excerpt = (body as any).excerpt ?? null;
  if ((body as any).content !== undefined) updates.content = (body as any).content ?? null;
  if ((body as any).status !== undefined) updates.status = (body as any).status ?? "draft";
  if ((body as any).date !== undefined) updates.date = (body as any).date ?? null;
  if ((body as any).thumbnail_url !== undefined)
    updates.thumbnail_url = (body as any).thumbnail_url ?? null;

  if (existing?.id) {
    const { data: updated, error } = await supabase
      .from(POSTS_TABLE)
      .update(updates)
      .eq("id", existing.id)
      .select("id,slug,title,excerpt,content,status,date,thumbnail_url,created_at,updated_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ post: normalizePostForClient(updated) });
  }

  const insertPayload = {
    slug: String(updates.slug ?? slugParam).trim(),
    title: String(updates.title ?? "").trim(),
    excerpt: updates.excerpt ?? null,
    content: updates.content ?? null,
    status: updates.status ?? "draft",
    date: updates.date ?? null,
    thumbnail_url: updates.thumbnail_url ?? null,
    updated_at: now,
  };

  if (!insertPayload.slug || !insertPayload.title) {
    return NextResponse.json(
      { error: "title and slug are required to create a post" },
      { status: 400 }
    );
  }

  const { data: created, error } = await supabase
    .from(POSTS_TABLE)
    .insert(insertPayload)
    .select("id,slug,title,excerpt,content,status,date,thumbnail_url,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ post: normalizePostForClient(created) }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { slug } = await ctx.params;
  const slugParam = decodeURIComponent(slug);

  const supabase = getSupabaseAdmin();

  const { data: existing, error: findErr } = await supabase
    .from(POSTS_TABLE)
    .select("id")
    .eq("slug", slugParam)
    .maybeSingle();

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
  if (!existing?.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await supabase.from(MEDIA_TABLE).delete().eq("post_id", existing.id);

  const { error } = await supabase.from(POSTS_TABLE).delete().eq("id", existing.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
