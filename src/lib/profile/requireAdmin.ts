// src/lib/profile/requireAdmin.ts
import "server-only";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/profile/getUserProfile";

export async function requireAdmin() {
  const profile = await getUserProfile();

  // If middleware protects /admin, profile should exist when signed in.
  // But keep it safe anyway.
  if (!profile) {
    redirect("/sign-in?redirect_url=/admin");
  }

  const role = (profile.role || "").toLowerCase();
  if (role !== "admin") {
    return { profile, isAdmin: false as const };
  }

  return { profile, isAdmin: true as const };
}
