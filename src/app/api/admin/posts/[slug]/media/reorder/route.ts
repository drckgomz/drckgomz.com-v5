// src/app/api/admin/posts/[slug]/media/reorder/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";

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

function coerceIds(body: any): string[] {
  // Accept: { order: [...] } (string[] or object[])
  if (Array.isArray(body?.order)) {
    const arr = body.order;
    // string[] / number[]
    if (arr.every((x: any) => typeof x === "string" || typeof x === "number")) {
      return arr.map((x: any) => String(x)).filter(Boolean);
    }
    // object[] like [{id}]
    return arr
      .map((x: any) => x && (x.id ?? x.mediaId ?? x.value))
      .map((x: any) => String(x ?? "").trim())
      .filter(Boolean);
  }

  // Accept: raw array of ids: ["a","b"]
  if (Array.isArray(body) && body.every((x) => typeof x === "string" || typeof x === "number")) {
    return body.map((x) => String(x)).filter(Boolean);
  }

  // Accept: raw array of objects: [{id},{...}]
  if (Array.isArray(body) && body.length) {
    return body
      .map((x) => (x && (x.id ?? x.mediaId ?? x.value)) as any)
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);
  }

  // Accept common wrappers
  const candidate =
    body?.ordered ??
    body?.items ??
    body?.list ??
    body?.media ??
    body?.data ??
    body?.payload ??
    null;

  if (Array.isArray(candidate)) {
    // string[] / number[]
    if (candidate.every((x: any) => typeof x === "string" || typeof x === "number")) {
      return candidate.map((x: any) => String(x)).filter(Boolean);
    }

    return candidate
      .map((x: any) => x && (x.id ?? x.mediaId ?? x.value))
      .map((x: any) => String(x ?? "").trim())
      .filter(Boolean);
  }

  // Accept: { ids: [...] }
  if (Array.isArray(body?.ids)) {
    return body.ids.map((x: any) => String(x ?? "").trim()).filter(Boolean);
  }

  return [];
}




export async function PATCH(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { slug } = await ctx.params;
  const slugParam = decodeURIComponent(slug);

  const body = await request.json().catch(() => null);

  const ids = coerceIds(body);

  if (!ids.length) {
  return NextResponse.json(
    {
      error: "Invalid reorder payload. Expected ids or list of {id}.",
      received: body,
      parsedIds: ids,
      example: { order: ["media-id-1", "media-id-2"] },
    },
    { status: 400 }
  );
}


  const supabase = getSupabaseAdmin();

  const { data: post, error: postErr } = await supabase
    .from(POSTS_TABLE)
    .select("id")
    .eq("slug", slugParam)
    .maybeSingle();

  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });
  if (!post?.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Safety: only reorder ids that belong to this post
  const { data: rows, error: rowsErr } = await supabase
    .from(MEDIA_TABLE)
    .select("id")
    .eq("post_id", post.id)
    .in("id", ids);

  if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 500 });

  const allowed = new Set((rows ?? []).map((r: any) => String(r.id)));
  const filtered = ids.filter((id) => allowed.has(id));

  if (!filtered.length) {
    return NextResponse.json({ error: "No valid media IDs for this post." }, { status: 400 });
  }

  // Update idx in order
  for (let i = 0; i < filtered.length; i++) {
    const id = filtered[i];
    const { error: updErr } = await supabase
      .from(MEDIA_TABLE)
      .update({ idx: i })
      .eq("post_id", post.id)
      .eq("id", id);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ids: filtered });
}
