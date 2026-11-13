import "server-only";
import { getViewer } from "@/lib/auth/viewer";
import { isAdmin } from "@/lib/auth/policy";
import { privateJson } from "@/lib/auth/response";
import { isMissingConfigurationError } from "@/lib/db/config";
import { BackendConfigurationError, getBackendConfiguration } from "@/lib/backend-configuration";
import { isLocalPostgresIntegrationEnabled, verifyAllLocalPostgresTargets } from "@/lib/db/local-postgres-target";

export type LocalCmsOperation = "posts:read" | "posts:update";

/** Only the implemented local post operations may pass the otherwise-closed CMS gate. */
export async function requireAdminApi(localOperation?: LocalCmsOperation) {
  try {
    const backend = getBackendConfiguration();
    const localCms = localOperation !== undefined && isLocalPostgresIntegrationEnabled(process.env);
    if (localCms) verifyAllLocalPostgresTargets(process.env);
    if (backend.cmsMutations === "disabled" && !localCms) return privateJson({ error: "CMS administration is unavailable" }, 503);
    const { userId, profile } = await getViewer();
    if (!userId) return privateJson({ error: "Unauthorized" }, 401);
    if (localCms ? profile?.is_owner !== true : !isAdmin(profile)) return privateJson({ error: "Forbidden" }, 403);
    return null;
  } catch (error) {
    if (error instanceof BackendConfigurationError) {
      return privateJson({ error: "Backend integration is unavailable" }, 503);
    }
    if (isMissingConfigurationError(error)) {
      return privateJson({ error: "Authentication is not configured", missing: error.missing }, 503);
    }
    return privateJson({ error: "Auth check failed" }, 500);
  }
}
