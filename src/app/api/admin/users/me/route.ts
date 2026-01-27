// src/app/api/admin/users/me/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { requireAdminApi } from "@/lib/admin/requireAdminApi";

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Missing Supabase env");
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  // still enforce "must be admin to use this endpoint"
  const denied = await requireAdminApi();
  if (denied) return denied;

  // ✅ this is the *current* signed-in clerk user
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ me: null }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id,email,role,is_owner,is_banned,can_view_private")
    .eq("id", userId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ me: null }, { status: 404 });

  const role = String(data.role || "user");
  const me = {
    id: String(data.id),
    email: String(data.email || "").toLowerCase(),
    role,
    is_admin: role.toLowerCase() === "admin" || !!data.is_owner,
    is_owner: !!data.is_owner,
    is_banned: !!data.is_banned,
    can_view_private: !!data.can_view_private,
  };

  return NextResponse.json({ me });
}
