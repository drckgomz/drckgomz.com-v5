import { NextResponse } from "next/server";

/** The interactive terminal uses a local fixed allowlist; database commands are disabled. */
export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({ error: "Terminal command registry is disabled" }, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}
