import "server-only";
import type { UserProfile } from "@/lib/profile/types";
import { getViewer } from "@/lib/auth/viewer";
import { isActive } from "@/lib/auth/policy";

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const { profile } = await getViewer();
    return isActive(profile) ? profile : null;
  } catch {
    return null;
  }
}
