// src/app/api/admin/terminal/commands/[id]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin.server";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";

type Ctx = { params: Promise<{ id: string }> };

// Your DB currently stores `actions` as TEXT (stringified JSON) in many rows.
// We'll store it as a string to be consistent.
// If you later migrate to jsonb, you can remove JSON.stringify and store arrays directly.
function normalizeActionsForDb(actions: unknown): string {
  if (Array.isArray(actions)) return JSON.stringify(actions);
  if (typeof actions === "string") return actions;
  return "[]";
}

export async function GET(_req: Request, ctx: Ctx) {
  const authFail = await requireAdminApi();
  if (authFail) return authFail;

  const { id } = await ctx.params;
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("terminal_commands")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("[admin/terminal/commands/:id GET] error:", error);
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  }

  return NextResponse.json({ command: data }, { status: 200 });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const authFail = await requireAdminApi();
  if (authFail) return authFail;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const supabase = supabaseAdmin();

  const payload = {
    name: String(body.name ?? "").trim(),
    description: String(body.description ?? ""),
    role: body.role === "admin" ? "admin" : "user",
    requires_auth: !!body.requires_auth,
    show_in_help: !!body.show_in_help,
    enabled: !!body.enabled,
    rate_limit_per_min: Number(body.rate_limit_per_min ?? 0),
    aliases: Array.isArray(body.aliases) ? body.aliases.map(String) : [],
    actions: normalizeActionsForDb(body.actions),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("terminal_commands")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("[admin/terminal/commands/:id PATCH] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ command: data }, { status: 200 });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const authFail = await requireAdminApi();
  if (authFail) return authFail;

  const { id } = await ctx.params;
  const supabase = supabaseAdmin();

  const { error } = await supabase.from("terminal_commands").delete().eq("id", id);

  if (error) {
    console.error("[admin/terminal/commands/:id DELETE] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
