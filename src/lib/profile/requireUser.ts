// src/lib/profile/requireUser.ts
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin.server";

export async function requireUserProfile(opts?: { allowBanned?: boolean }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = supabaseAdmin();

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("id,email,role,is_owner,is_banned,banned_reason,can_view_private")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!profile) redirect("/sign-in");

  if (!opts?.allowBanned && profile.is_banned) {
    redirect("/banned");
  }

  return profile;
}
