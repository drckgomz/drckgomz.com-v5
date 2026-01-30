// src/lib/admin/requireAdmin.ts
import "server-only";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/profile/getUserProfile";

export async function requireAdmin() {
  const profile = await getUserProfile();

  if (!profile) {
    redirect("/sign-in?redirect_url=/admin");
  }

  const role = (profile.role || "").toLowerCase();
  const isAdmin = role === "admin" || Boolean((profile as any).is_owner) || Boolean((profile as any).is_whitelist_admin);

  if (!isAdmin) {
    redirect("/blog");
  }

  return profile;
}
