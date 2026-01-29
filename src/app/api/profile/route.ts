// src/app/api/profile/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "id,username,email,role,avatar_color,first_name,last_name,enabled,is_owner,is_whitelist_admin,is_banned,banned_reason,can_view_private"
    )
    .eq("id", userId)
    .eq("enabled", true)
    .maybeSingle();

  if (error) {
    console.error("[api/profile] supabase error:", error);
    return NextResponse.json({ error: "Profile lookup failed" }, { status: 500 });
  }

  if (!data) {
    // Signed into Clerk but no profile row
    return NextResponse.json({ profile: null }, { status: 200 });
  }

  // Optional: if banned, still return profile (client can decide) or block:
  // if (data.is_banned) return NextResponse.json({ error: "Banned" }, { status: 403 });

  return NextResponse.json({ profile: data }, { status: 200 });
}
