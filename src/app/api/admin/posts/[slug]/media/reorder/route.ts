import { parseMediaOrder } from "@/lib/cms/mediaOrder";
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

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { slug } = await ctx.params;
  const slugParam = slug;

  const body = await request.json().catch(() => null);
  const requestedIds = parseMediaOrder(body);

  if (!requestedIds) {
    return NextResponse.json(
      {
        error: "Invalid reorder payload. Expected ids or list of {id}.",
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

  if (postErr) return NextResponse.json({ error: "Media order operation failed." }, { status: 500 });
  if (!post?.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Load ALL media rows for this post (current order)
  const { data: allRows, error: allErr } = await supabase
    .from(MEDIA_TABLE)
    .select("id, idx, created_at")
    .eq("post_id", post.id)
    .order("idx", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1001);

  if (allErr) return NextResponse.json({ error: "Media order operation failed." }, { status: 500 });

  if ((allRows?.length ?? 0) > 1000) return NextResponse.json({ error: "Media list exceeds the reorder limit." }, { status: 400 });

  const allIds = (allRows ?? []).map((r) => String(r.id));
  const allSet = new Set(allIds);

  if (requestedIds.some(id => !allSet.has(id))) {
    return NextResponse.json({ error: "Media list changed or contains IDs outside this post. Reload before reordering." }, { status: 409 });
  }
  const seen = new Set(requestedIds);
  const validRequested = requestedIds;

  // Final order = requested + remaining (preserve existing order for the rest)
  const remaining = allIds.filter((id) => !seen.has(id));
  const finalOrder = [...validRequested, ...remaining];

  // Scoped updates cannot insert a deleted row or modify a row moved to another post.
  // These writes are not atomic; a failure may leave a partially applied order.
  for (const [idx, id] of finalOrder.entries()) {
    const { data, error } = await supabase.from(MEDIA_TABLE).update({ idx })
      .eq("post_id", post.id).eq("id", id).select("id").maybeSingle();
    if (error) return NextResponse.json({ error: "Media order was only partially saved. Reload before retrying." }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Media list changed. Reload before retrying." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, ids: finalOrder });
}
