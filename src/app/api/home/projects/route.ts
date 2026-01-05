// src/app/api/home/projects/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LEGACY_BASES = [
  /^https:\/\/s3\.us-east-1\.amazonaws\.com\/www\.drckgomz\.com/i,
  /^https:\/\/www\.drckgomz\.com\.s3\.amazonaws\.com/i,
];

const MEDIA_BASE = process.env.NEXT_PUBLIC_S3_MEDIA_BASE || "";

function normalizeMediaUrl(url: string | null): string | null {
  if (!url) return null;

  let out = url;

  // Only rewrite if we actually have a MEDIA_BASE configured
  if (MEDIA_BASE) {
    for (const rx of LEGACY_BASES) {
      out = out.replace(rx, MEDIA_BASE);
    }
  }

  return out;
}

export const revalidate = 0; // always fresh (you can tweak later)

export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);

  const limit = Math.min(Number(searchParams.get("limit") ?? 6) || 6, 50);
  const offset = Number(searchParams.get("offset") ?? 0) || 0;

  const { data, error, count } = await supabase
    .from("home_projects")
    .select(
      `
      id,
      idx,
      title,
      slug,
      excerpt,
      href,
      color,
      image_url,
      status,
      home_project_media (
        type,
        url,
        caption,
        idx
      )
      `,
      { count: "exact" }
    )
    // ✅ ONLY PUBLIC projects for the home grid
    .eq("status", "public")
    .order("idx", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[api/home/projects] list error:", error);
    return NextResponse.json({ items: [], count: 0 }, { status: 500 });
  }

  const items =
    data?.map((row: any) => {
      const mediaRaw = Array.isArray(row.home_project_media)
        ? [...row.home_project_media]
        : [];

      // sort by idx so top media is consistent
      const media = mediaRaw.sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));
      const topImage = media.find((m) => m.type === "image");

      // pick in this order:
      // 1. explicit image_url on project
      // 2. first image media url
      const display_thumb_url =
        normalizeMediaUrl(row.image_url) ||
        (topImage ? normalizeMediaUrl(topImage.url) : null);

      return {
        id: row.id,
        idx: row.idx,
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        href: row.href,
        color: row.color,
        image_url: normalizeMediaUrl(row.image_url),
        // status is always public here, but keeping it is fine
        status: row.status,
        display_thumb_url,
      };
    }) ?? [];

  return NextResponse.json(
    { items, count: count ?? items.length },
    { status: 200 }
  );
}
