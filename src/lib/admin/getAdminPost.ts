import "server-only";
import { isLocalPostgresIntegrationEnabled, verifyAllLocalPostgresTargets } from "@/lib/db/local-postgres-target";
import { getOwnerPostBySlug } from "@/lib/db/repositories/admin-posts";

export type { AdminPost } from "@/lib/admin/types";

/** There is intentionally no Supabase fallback for owner draft reads. */
export async function getAdminPostBySlug(slug: string) {
  if (!isLocalPostgresIntegrationEnabled(process.env)) return null;
  verifyAllLocalPostgresTargets(process.env);
  return getOwnerPostBySlug(slug);
}
