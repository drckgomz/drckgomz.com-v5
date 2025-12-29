// src/app/api/admin/profile/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    // NOTE: This is "good enough" for now.
    // It returns a profile based on email if you store it in Clerk,
    // but we don't have the Clerk JWT verification wired here yet.
    //
    // For now, just return cached values if you want, OR return a default.
    // Best next step is: verify Clerk token -> get userId -> query user_profiles by id.

    return NextResponse.json({ profile: null }, { status: 200 });
  } catch (e) {
    console.error("[/api/admin/profile] error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
