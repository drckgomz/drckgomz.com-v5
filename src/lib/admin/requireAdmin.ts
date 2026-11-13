import "server-only";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { isAdmin } from "@/lib/auth/policy";

export async function requireAdmin() {
  const { userId, profile } = await getViewer();
  if (!userId) redirect("/sign-in?redirect_url=/admin");
  if (profile?.is_banned) redirect("/banned");
  if (!profile || !isAdmin(profile)) redirect("/blog");
  return profile;
}
