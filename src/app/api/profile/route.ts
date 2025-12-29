// src/app/api/profile/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/;

export async function GET() {
  const { userId } = await auth(); // ✅ await
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, username, email, role, avatar_color, first_name, last_name, enabled")
    .eq("id", userId)
    .eq("enabled", true)
    .single();

  if (error) return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });

  return NextResponse.json({ profile: data }, { status: 200 });
}

export async function PUT(req: Request) {
  const { userId } = await auth(); // ✅ await
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const username = String(body.username ?? "").trim();
  const first_name = String(body.first_name ?? "").trim();
  const last_name = String(body.last_name ?? "").trim();
  const avatar_color = String(body.avatar_color ?? "").trim();

  if (!username || username.length > 32) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }
  if (avatar_color && !HEX_COLOR_RE.test(avatar_color)) {
    return NextResponse.json(
      { error: "avatar_color must be a 6-digit hex like #4A90E2" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .update({
      username,
      first_name,
      last_name,
      avatar_color: avatar_color || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .eq("enabled", true)
    .select("id, username, email, role, avatar_color, first_name, last_name")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ profile: data }, { status: 200 });
}
