import "server-only";
import { requireAdmin as requireAdminProfile } from "@/lib/admin/requireAdmin";

/** Compatibility wrapper for the dashboard; authorization is identical to its children. */
export async function requireAdmin() {
  return { profile: await requireAdminProfile(), isAdmin: true as const };
}
