import { NextRequest, NextResponse } from "next/server";
import { fetchProjectAndMedia } from "@/lib/projects/public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const result = await fetchProjectAndMedia(id);
    if (!result.project) return NextResponse.json({ media: [] }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ media: result.media }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ error: "Project media is temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
