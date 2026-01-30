// src/app/api/terminal/commands/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin.server";

export const revalidate = 0;

// Public route: use service role + enforce "public view" rules in code.
// This avoids the current RLS/policy function causing "permission denied for schema app".
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "200");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 200;
  const safeOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0;

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("terminal_commands")
    .select("id,name,aliases,description,actions,requires_auth,role,show_in_help,enabled,rate_limit_per_min,updated_at")
    .eq("enabled", true)
    .eq("role", "user")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (error) {
    console.error("[api/terminal/commands] error:", error);
    return NextResponse.json({ items: [] }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] }, { status: 200 });
}
