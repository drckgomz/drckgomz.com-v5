// src/app/api/admin/users/route.ts
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  return createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const supabase = getSupabaseAdmin();

  // Update "user_profiles" to match your real table name
  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "id,email,username,first_name,last_name,role,can_view_private,is_owner,is_banned,banned_at,banned_reason,enabled,created_at,updated_at,avatar_color"
    )
    .order("email", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ users: data ?? [] });
}
