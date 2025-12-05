// src/app/api/terminal/commands/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 0;

type DbCommandRow = {
  id: string;
  name: string;
  aliases?: string[] | null;
  description?: string | null;
  actions: any;
  requires_auth?: boolean | null;
  role?: "user" | "admin" | null;
  show_in_help?: boolean | null;
  enabled?: boolean | null;
  rate_limit_per_min?: number | null;
};

export async function GET() {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("terminal_commands")
    .select("*"); // 👈 safest, no column mismatch

  if (error) {
    console.error("[api/terminal/commands] supabase error", error);
    return NextResponse.json({ items: [] }, { status: 500 });
  }

  const items: DbCommandRow[] = (data ?? []) as DbCommandRow[];

  return NextResponse.json({ items }, { status: 200 });
}
