import "server-only";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { isMissingConfigurationError } from "@/lib/db/config";

export async function requireUserProfile() {
  let profile;
  try {
    ({ profile } = await getViewer());
  } catch (error) {
    if (isMissingConfigurationError(error)) redirect("/service-unavailable?service=auth");
    throw error;
  }
  if (!profile) redirect("/sign-in");
  if (profile.is_banned) redirect("/banned");
  if (!profile.enabled) redirect("/sign-in");
  return profile;
}
