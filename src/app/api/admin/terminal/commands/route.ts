// src/app/api/admin/terminal/commands/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin.server";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";

export async function GET(req: Request) {
  const authFail = await requireAdminApi();
  if (authFail) return authFail;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "200");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 200;
  const safeOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0;

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("terminal_commands")
    .select("id,name,aliases,description,actions,requires_auth,role,show_in_help,enabled,rate_limit_per_min,updated_at")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (error) {
    console.error("[admin/terminal/commands GET] error:", error);
    return NextResponse.json({ commands: [] }, { status: 500 });
  }

  return NextResponse.json({ commands: data ?? [] }, { status: 200 });
}

export async function POST(req: Request) {
  const authFail = await requireAdminApi();
  if (authFail) return authFail;

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "new-command").trim() || "new-command";

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("terminal_commands")
    .insert({
      name,
      description: String(body?.description ?? ""),
      aliases: Array.isArray(body?.aliases) ? body.aliases.map(String) : [],
      // store as stringified json by default (matches your existing data)
      actions: JSON.stringify(Array.isArray(body?.actions) ? body.actions : []),
      requires_auth: !!body?.requires_auth,
      role: body?.role === "admin" ? "admin" : "user",
      show_in_help: body?.show_in_help ?? true,
      enabled: body?.enabled ?? true,
      rate_limit_per_min: Number(body?.rate_limit_per_min ?? 0),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    console.error("[admin/terminal/commands POST] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ command: data }, { status: 200 });
}
