// src/lib/admin/getAdminPost.ts
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin.server";
import { normalizeMaybeS3Url } from "@/lib/blog/media";

export type AdminPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  status: string | null;
  date: string | null;
  thumbnail_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  media?: any[];
};

export async function getAdminPostBySlug(slug: string): Promise<AdminPost | null> {
  const supabase = supabaseAdmin();

  // get post
  const { data: post, error } = await supabase
    .from("posts")
    .select("id, slug, title, excerpt, content, status, date, thumbnail_url, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !post) {
    console.error("[getAdminPostBySlug] post error", {
      message: (error as any)?.message,
      code: (error as any)?.code,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
      slug,
    });
    return null;
  }

  // get media
  const { data: media, error: mediaErr } = await supabase
    .from("media")
    .select("id, post_id, type, url, caption, idx")
    .eq("post_id", post.id)
    .order("idx", { ascending: true });

  if (mediaErr) {
    console.error("[getAdminPostBySlug] media error", {
      message: (mediaErr as any)?.message,
      code: (mediaErr as any)?.code,
      details: (mediaErr as any)?.details,
      hint: (mediaErr as any)?.hint,
      post_id: post.id,
    });
  }

  const normalizedPost = {
    ...(post as any),
    thumbnail_url: normalizeMaybeS3Url((post as any).thumbnail_url ?? null),
  };

  const normalizedMedia = Array.isArray(media)
    ? media.map((m: any) => ({
        ...m,
        url: normalizeMaybeS3Url(m.url ?? null),
      }))
    : [];

  return {
    ...(normalizedPost as any),
    media: normalizedMedia,
  };
}
