import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { isMissingConfigurationError } from "@/lib/db/config";

export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  try {
    const { userId, profile } = await getViewer();
    if (!userId || !profile) return NextResponse.json({ me: null }, { status: 401 });
    const role = profile.role || "user";
    return NextResponse.json({
      me: {
        id: profile.id,
        email: profile.email.toLowerCase(),
        role,
        is_admin: role.toLowerCase() === "admin" || profile.is_owner === true || role.toLowerCase() === "content_admin",
        is_owner: profile.is_owner === true,
        is_banned: profile.is_banned,
        can_view_private: profile.can_view_private,
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (isMissingConfigurationError(error)) {
      return NextResponse.json({ error: "Authentication is not configured", missing: error.missing }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Profile lookup failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
