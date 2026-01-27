// src/app/api/admin/users/[id]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  return createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { id } = await ctx.params;
  const userId = decodeURIComponent(id);

  const body = (await request.json().catch(() => null)) as any;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Whitelist fields you allow to patch
  const patch: Record<string, any> = {};
  if ("role" in body) patch.role = String(body.role || "user");
  if ("can_view_private" in body) patch.can_view_private = !!body.can_view_private;
  if ("is_banned" in body) patch.is_banned = !!body.is_banned;
  if ("banned_reason" in body) patch.banned_reason = body.banned_reason ?? null;
  if ("is_owner" in body) patch.is_owner = !!body.is_owner;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No patch fields provided" }, { status: 400 });
  }

  // Optional: if banning, set banned_at timestamp
  if ("is_banned" in patch) {
    patch.banned_at = patch.is_banned ? new Date().toISOString() : null;
    if (!patch.is_banned) patch.banned_reason = null;
  }

  const supabase = getSupabaseAdmin();

  // Update "user_profiles" to match your schema
  const { error } = await supabase.from("user_profiles").update(patch).eq("id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
