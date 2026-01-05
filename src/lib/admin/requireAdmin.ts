// src/lib/admin/requireAdmin.ts
import "server-only";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/profile/getUserProfile";

export async function requireAdmin() {
  const profile = await getUserProfile();

  if (!profile) {
    redirect("/sign-in?redirect_url=/admin");
  }

  if (profile.role?.toLowerCase() !== "admin") {
    redirect("/blog");
  }

  return profile;
}
