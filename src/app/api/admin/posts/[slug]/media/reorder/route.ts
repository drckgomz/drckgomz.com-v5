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
  if (Array.isArray(body?.order)) {
    const arr = body.order;
    if (arr.every((x: any) => typeof x === "string" || typeof x === "number")) {
      return arr.map((x: any) => String(x)).filter(Boolean);
    }
    return arr
      .map((x: any) => x && (x.id ?? x.mediaId ?? x.value))
      .map((x: any) => String(x ?? "").trim())
      .filter(Boolean);
  }

  if (Array.isArray(body) && body.every((x) => typeof x === "string" || typeof x === "number")) {
    return body.map((x) => String(x)).filter(Boolean);
  }

  if (Array.isArray(body) && body.length) {
    return body
      .map((x) => (x && (x.id ?? x.mediaId ?? x.value)) as any)
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);
  }

  const candidate =
    body?.ordered ??
    body?.items ??
    body?.list ??
    body?.media ??
    body?.data ??
    body?.payload ??
    null;

  if (Array.isArray(candidate)) {
    if (candidate.every((x: any) => typeof x === "string" || typeof x === "number")) {
      return candidate.map((x: any) => String(x)).filter(Boolean);
    }
    return candidate
      .map((x: any) => x && (x.id ?? x.mediaId ?? x.value))
      .map((x: any) => String(x ?? "").trim())
      .filter(Boolean);
  }

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
  const requestedIds = coerceIds(body);

  if (!requestedIds.length) {
    return NextResponse.json(
      {
        error: "Invalid reorder payload. Expected ids or list of {id}.",
        received: body,
        parsedIds: requestedIds,
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

  // Load ALL media rows for this post (current order)
  const { data: allRows, error: allErr } = await supabase
    .from(MEDIA_TABLE)
    .select("id, idx, created_at")
    .eq("post_id", post.id)
    .order("idx", { ascending: true })
    .order("created_at", { ascending: true });

  if (allErr) return NextResponse.json({ error: allErr.message }, { status: 500 });

  const allIds = (allRows ?? []).map((r: any) => String(r.id));
  const allSet = new Set(allIds);

  // keep only ids that belong to this post + dedupe
  const seen = new Set<string>();
  const validRequested = requestedIds
    .map((x) => String(x))
    .filter((id) => allSet.has(id))
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

  if (!validRequested.length) {
    return NextResponse.json({ error: "No valid media IDs for this post." }, { status: 400 });
  }

  // Final order = requested + remaining (preserve existing order for the rest)
  const remaining = allIds.filter((id) => !seen.has(id));
  const finalOrder = [...validRequested, ...remaining];

  // Single request: upsert idx for every media row (unique, sequential)
  const payload = finalOrder.map((id, idx) => ({ id, idx }));

  const { error: upErr } = await supabase
    .from(MEDIA_TABLE)
    .upsert(payload, { onConflict: "id" });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, ids: finalOrder });
}
