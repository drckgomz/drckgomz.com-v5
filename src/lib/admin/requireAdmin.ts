// src/lib/admin/requireAdmin.ts
import "server-only";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/profile/getUserProfile";

export async function requireAdmin() {
  const profile = await getUserProfile();

  // Not signed in -> send to sign-in
  if (!profile) {
    redirect("/sign-in?redirect_url=/admin");
  }

  // Not admin -> send to blog (or a /403 page if you want)
  if (profile.role?.toLowerCase() !== "admin") {
    redirect("/blog");
  }

  return profile;
}
