import { NextResponse } from "next/server";
import { fetchPublicProjects } from "@/lib/projects/public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 12);
  const requestedOffset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50) : 12;
  const offset = Number.isSafeInteger(requestedOffset) && requestedOffset >= 0 && Number.isSafeInteger(requestedOffset + limit) ? requestedOffset : 0;
  try {
    const page = await fetchPublicProjects(limit, offset);
    return NextResponse.json({ items: page.items, count: null, hasMore: page.hasMore, nextOffset: offset + page.items.length }, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "Projects are temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
