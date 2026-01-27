// src/lib/profile/requireUser.ts
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUserProfile(opts?: { allowBanned?: boolean }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = createSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("id,email,role,is_owner,is_banned,banned_reason,can_view_private")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  // If no row exists yet, you can either create one here or treat as denied.
  if (!profile) redirect("/sign-in");

  if (!opts?.allowBanned && profile.is_banned) {
    // choose your own banned page
    redirect("/banned");
  }

  return profile;
}
