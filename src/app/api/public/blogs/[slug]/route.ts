// src/app/api/public/blogs/[slug]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const POSTS_TABLE = "posts";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Missing Supabase env");
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

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const slugParam = decodeURIComponent(slug);

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .select(
      `
      id,slug,title,excerpt,content,status,date,thumbnail_url,created_at,updated_at,
      media ( id,type,url,caption,idx,created_at,title )
    `
    )
    .eq("slug", slugParam)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const post = {
    ...data,
    thumbnail_url: normalizeMaybeS3Url(data.thumbnail_url),
    media: Array.isArray((data as any).media)
      ? (data as any).media.map((m: any) => ({ ...m, url: normalizeMaybeS3Url(m.url) }))
      : [],
  };

  return NextResponse.json({ post });
}
