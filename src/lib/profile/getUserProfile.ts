// src/lib/profile/getUserProfile.ts
import "server-only";
import type { UserProfile } from "@/lib/profile/types";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin.server";

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const { userId } = await auth();
    if (!userId) return null;

    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from("user_profiles")
      .select(
        "id, username, email, role, avatar_color, first_name, last_name, enabled, is_owner, is_whitelist_admin"
      )
      .eq("id", userId)
      .eq("enabled", true)
      .maybeSingle();

    if (error) {
      console.error("[getUserProfile] supabase error:", error);
      return null;
    }
    if (!data) return null;

    return {
      id: String(data.id),
      username: String(data.username ?? ""),
      email: String(data.email ?? ""),
      role: String(data.role ?? "user"),
      avatar_color: String(data.avatar_color ?? ""),
      first_name: String(data.first_name ?? ""),
      last_name: String(data.last_name ?? ""),
      is_owner: Boolean(data.is_owner ?? false),
      is_whitelist_admin: Boolean(data.is_whitelist_admin ?? false),
    };
  } catch (err) {
    console.error("[getUserProfile] threw:", err);
    return null;
  }
}
