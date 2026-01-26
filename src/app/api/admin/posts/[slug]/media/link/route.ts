// src/app/api/admin/posts/[slug]/media/link/route.ts
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

function inferType(url: string): "youtube" | "instagram" | "image" | "link" {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("instagram.com")) return "instagram";
  if (u.match(/\.(png|jpg|jpeg|webp|gif)(\?|#|$)/)) return "image";
  return "link";
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { slug } = await ctx.params;
  const slugParam = decodeURIComponent(slug);

  const body = await request.json().catch(() => null);
  const urlRaw = body?.url;
  const captionRaw = body?.caption ?? null;

  const url = typeof urlRaw === "string" ? urlRaw.trim() : "";
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  const caption =
    captionRaw === null || captionRaw === undefined
      ? null
      : String(captionRaw).trim() || null;

  const supabase = getSupabaseAdmin();

  const { data: post, error: postErr } = await supabase
    .from(POSTS_TABLE)
    .select("id")
    .eq("slug", slugParam)
    .maybeSingle();

  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });
  if (!post?.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // pick next idx
  const { data: last, error: lastErr } = await supabase
    .from(MEDIA_TABLE)
    .select("idx")
    .eq("post_id", post.id)
    .order("idx", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastErr) return NextResponse.json({ error: lastErr.message }, { status: 500 });

  const nextIdx = typeof last?.idx === "number" ? last.idx + 1 : 0;

  const type = (body?.type ? String(body.type) : inferType(url)) as string;

  const { data: created, error: insErr } = await supabase
    .from(MEDIA_TABLE)
    .insert({
      post_id: post.id,
      type,
      url,
      caption,
      idx: nextIdx,
    })
    .select("id,type,url,caption,idx,post_id")
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ media: created }, { status: 201 });
}
