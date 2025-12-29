// src/lib/profile/getUserProfile.ts
import "server-only";
import type { UserProfile } from "@/lib/profile/types";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getUserProfile(): Promise<UserProfile | null> {
  const { userId } = await auth(); // ✅ await
  if (!userId) return null;

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, username, email, role, avatar_color, first_name, last_name")
    .eq("id", userId)
    .eq("enabled", true)
    .single();

  if (error) {
    console.error("[getUserProfile]", error);
    return null;
  }

  return data as UserProfile;
}
