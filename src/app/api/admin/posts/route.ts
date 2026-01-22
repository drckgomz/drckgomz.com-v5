// src/app/api/admin/posts/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";

const POSTS_TABLE = "posts";

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

export async function GET(request: NextRequest) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let q = supabase
    .from(POSTS_TABLE)
    .select(
      `
      id,slug,title,excerpt,status,date,thumbnail_url,created_at,updated_at,
      media ( id,type,url,caption,idx )
    `
    )
    .order("updated_at", { ascending: false })
    .order("idx", { ascending: true, foreignTable: "media" });

  if (status && status !== "all") {
    q = q.eq("status", status);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const posts = (data ?? []).map((p: any) => ({
    ...p,
    thumbnail_url: normalizeMaybeS3Url(p.thumbnail_url),
    media: Array.isArray(p.media)
      ? p.media.map((m: any) => ({ ...m, url: normalizeMaybeS3Url(m.url) }))
      : [],
  }));

  return NextResponse.json({ posts });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const supabase = getSupabaseAdmin();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const payload = {
    slug: String((body as any).slug || "").trim(),
    title: String((body as any).title || "").trim(),
    excerpt: (body as any).excerpt ?? null,
    content: (body as any).content ?? null,
    status: (body as any).status ?? "draft",
    date: (body as any).date ?? null,
    thumbnail_url: (body as any).thumbnail_url ?? null,
    updated_at: now,
  } as const;

  if (!payload.slug || !payload.title) {
    return NextResponse.json({ error: "slug and title are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from(POSTS_TABLE)
    .insert(payload)
    .select("id,slug,title,excerpt,status,date,thumbnail_url,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ post: data }, { status: 201 });
}
