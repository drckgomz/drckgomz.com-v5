// src/app/api/admin/posts/[slug]/media/route.ts
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

function normalizeMaybeS3Url(u: string | null) {
  if (!u) return u;
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;

  const base = process.env.NEXT_PUBLIC_S3_MEDIA_BASE || "";
  if (!base) return u;

  return `${base.replace(/\/+$/, "")}/${u.replace(/^\/+/, "")}`;
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { slug } = await ctx.params;
  const slugParam = decodeURIComponent(slug);

  const supabase = getSupabaseAdmin();

  const { data: post, error: postErr } = await supabase
    .from(POSTS_TABLE)
    .select("id")
    .eq("slug", slugParam)
    .maybeSingle();

  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });
  if (!post?.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ✅ created_at removed (your table doesn't have it)
  const { data: media, error: mediaErr } = await supabase
    .from(MEDIA_TABLE)
    .select("id,type,url,caption,idx")
    .eq("post_id", post.id)
    .order("idx", { ascending: true });

  if (mediaErr) {
    console.error("[media GET] supabase error:", mediaErr);
    return NextResponse.json({ error: mediaErr.message }, { status: 500 });
  }

  const out = (media ?? []).map((m: any) => ({
    ...m,
    url: normalizeMaybeS3Url(m.url ?? null),
  }));

  return NextResponse.json({ media: out });
}
