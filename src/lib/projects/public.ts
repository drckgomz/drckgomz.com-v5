import "server-only";
import { redirect } from "next/navigation";
import { isMissingConfigurationError } from "@/lib/db/config";

/** Public project reads are routed through the Drizzle content-reader role. */
export async function fetchProjectAndMedia(slugOrId: string) {
  try {
    const { getDrizzlePublicProjectAndMedia } = await import("@/lib/db/repositories/projects");
    return await getDrizzlePublicProjectAndMedia(slugOrId);
  } catch (error) {
    if (isMissingConfigurationError(error)) redirect("/service-unavailable?service=database");
    throw error;
  }
}

export async function fetchPublicProjects(limit = 12, offset = 0) {
  try {
    const { getDrizzlePublicProjects } = await import("@/lib/db/repositories/projects");
    return await getDrizzlePublicProjects(limit, offset);
  } catch (error) {
    if (isMissingConfigurationError(error)) redirect("/service-unavailable?service=database");
    throw error;
  }
}
