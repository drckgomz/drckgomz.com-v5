// src/app/api/profile/route.ts
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getViewer } from "@/lib/auth/viewer";
import { getCurrentSessionTokenDigest } from "@/lib/auth/session-token-digest";
import { getContentDatabase } from "@/lib/db/client";
import { parseProfileUpdateInput } from "@/lib/profile/profile-input";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  let viewer: Awaited<ReturnType<typeof getViewer>>;
  try { viewer = await getViewer(); }
  catch {
    return NextResponse.json({ error: "Profile lookup failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  const { userId } = viewer;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = viewer.profile;
  if (!profile) return NextResponse.json({ profile: null }, { status: 200 });
  if (profile.is_banned || !profile.enabled) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ profile }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  let requestOrigin: string;
  try { requestOrigin = new URL(request.url).origin; }
  catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (!origin || origin !== requestOrigin || (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")) {
    return NextResponse.json({ error: "Cross-site profile updates are not allowed" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 16_384) {
    return NextResponse.json({ error: "Profile update is too large." }, { status: 413, headers: { "Cache-Control": "no-store" } });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 16_384) return NextResponse.json({ error: "Profile update is too large." }, { status: 413, headers: { "Cache-Control": "no-store" } });
    body = JSON.parse(rawBody);
  }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const input = parseProfileUpdateInput(body);
  if (!input) return NextResponse.json({ error: "Check the display name, first name, last name, and avatar color." }, { status: 400 });

  const viewer = await getViewer();
  if (!viewer.userId || !viewer.profile || !viewer.profile.enabled || viewer.profile.is_banned) {
    return NextResponse.json({ error: "Sign in with an active account to update your profile." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const tokenDigest = await getCurrentSessionTokenDigest();
  if (!tokenDigest) return NextResponse.json({ error: "Your session could not be verified. Sign in again and retry." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  try {
    // The content role can execute this narrowly scoped function but cannot
    // enumerate Better Auth session hashes as the auth adapter role can.
    const result = await getContentDatabase().execute(sql`
      select app_private.update_current_profile(
        ${tokenDigest}, ${input.display_name}, ${input.first_name}, ${input.last_name}, ${input.avatar_color}
      ) as updated_user_id
    `);
    if ((result.rows?.[0] as { updated_user_id?: unknown } | undefined)?.updated_user_id !== viewer.userId) {
      return NextResponse.json({ error: "Your session is no longer authorized to update this profile." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const refreshed = await getViewer();
    if (refreshed.userId !== viewer.userId || !refreshed.profile) {
      return NextResponse.json({ error: "Profile was saved, but could not be reloaded. Refresh the page." }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ profile: refreshed.profile }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    // Do not expose SQL, connection, or session details to the browser.
    return NextResponse.json({ error: "Profile saving is temporarily unavailable. Please try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
