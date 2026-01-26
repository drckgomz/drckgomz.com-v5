// src/app/api/admin/media/[mediaId]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";

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

async function resequenceIdx(supabase: ReturnType<typeof getSupabaseAdmin>, postId: string) {
  const { data: rows, error } = await supabase
    .from(MEDIA_TABLE)
    .select("id,idx")
    .eq("post_id", postId)
    .order("idx", { ascending: true });

  if (error) throw new Error(error.message);

  const list = rows ?? [];
  for (let i = 0; i < list.length; i++) {
    const { error: updErr } = await supabase
      .from(MEDIA_TABLE)
      .update({ idx: i })
      .eq("post_id", postId)
      .eq("id", list[i].id);

    if (updErr) throw new Error(updErr.message);
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ mediaId: string }> }
) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { mediaId } = await ctx.params;
  const id = decodeURIComponent(mediaId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Only allow caption updates for now
  const raw = (body as any).caption;
  const caption =
    raw === null || raw === undefined ? null : String(raw).trim() || null;

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(MEDIA_TABLE)
    .update({ caption })
    .eq("id", id)
    .select("id,post_id,type,url,caption,idx")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ media: data });
}

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ mediaId: string }> }
) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { mediaId } = await ctx.params;
  const id = decodeURIComponent(mediaId);

  const supabase = getSupabaseAdmin();

  // Find post_id for cleanup + reindex
  const { data: existing, error: findErr } = await supabase
    .from(MEDIA_TABLE)
    .select("id,post_id")
    .eq("id", id)
    .maybeSingle();

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
  if (!existing?.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const postId = existing.post_id as string | null;

  const { error: delErr } = await supabase.from(MEDIA_TABLE).delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // keep ordering consistent
  if (postId) {
    try {
      await resequenceIdx(supabase, postId);
    } catch (e: any) {
      // deletion succeeded; reindex failed (rare) — still return ok
      return NextResponse.json({ ok: true, id, warning: String(e?.message ?? e) });
    }
  }

  return NextResponse.json({ ok: true, id });
}
