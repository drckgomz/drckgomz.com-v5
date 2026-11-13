import { privateJson } from "@/lib/auth/response";
import { isMissingConfigurationError } from "@/lib/db/config";
import { BackendConfigurationError, getBackendConfiguration } from "@/lib/backend-configuration";

async function ownerDenied() {
  const { getViewer } = await import("@/lib/auth/viewer");
  const { userId, profile } = await getViewer();
  if (!userId) return privateJson({ error: "Unauthorized" }, 401);
  if (!profile?.enabled || profile.is_banned || !profile.is_owner) return privateJson({ error: "Forbidden" }, 403);
  return null;
}

async function getAuthenticatedUserId(): Promise<string | null> {
  const [{ headers }, { getBetterAuth }] = await Promise.all([
    import("next/headers"),
    import("@/lib/auth/better-auth"),
  ]);
  const session = await getBetterAuth().api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

async function handlers() {
  const [{ createPrivateAudienceHandlers }, { listPrivateAudienceUsers, setPrivateAudienceGrant }, { getBetterAuth }] = await Promise.all([
    import("@/lib/auth/private-audience-api"),
    import("@/lib/auth/private-audience-store"),
    import("@/lib/auth/better-auth"),
  ]);
  // Validate auth/database configuration before the dependency-injected handler catches errors.
  getBetterAuth();
  return createPrivateAudienceHandlers({
    getUserId: getAuthenticatedUserId,
    list: listPrivateAudienceUsers,
    setGrant: setPrivateAudienceGrant,
  });
}

function unavailable() {
  try {
    if (getBackendConfiguration().auth !== "better-auth") return privateJson({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof BackendConfigurationError) return privateJson({ error: "Authentication integration is unavailable" }, 503);
    throw error;
  }
  return null;
}

function configurationFailure(error: unknown) {
  if (isMissingConfigurationError(error)) {
    return privateJson({ error: "Authentication is not configured", missing: error.missing }, 503);
  }
  return privateJson({ error: "Private access service unavailable" }, 503);
}

export async function GET(request: Request) {
  const disabled = unavailable();
  if (disabled) return disabled;
  try {
    const denied = await ownerDenied();
    if (denied) return denied;
    return await (await handlers()).GET(request);
  } catch (error) {
    return configurationFailure(error);
  }
}

export async function PATCH(request: Request) {
  const disabled = unavailable();
  if (disabled) return disabled;
  try {
    const denied = await ownerDenied();
    if (denied) return denied;
    return await (await handlers()).PATCH(request);
  } catch (error) {
    return configurationFailure(error);
  }
}
