/** Single, fail-closed contract for runtime data and authentication backends. */
export type BackendEnvironment = Record<string, string | undefined>;
export type BackendConfiguration = Readonly<{
  auth: "better-auth";
  blogReads: "drizzle";
  projectReads: "drizzle";
  privateMedia: "drizzle";
  cmsMutations: "disabled";
}>;

export class BackendConfigurationError extends Error {
  constructor(message = "Backend configuration is unsupported") {
    super(message);
    this.name = "BackendConfigurationError";
  }
}

const EXPECTED = Object.freeze({
  AUTH_PROVIDER: "better-auth",
  BLOG_READ_BACKEND: "drizzle",
  PROJECT_READ_BACKEND: "drizzle",
  PRIVATE_MEDIA_BACKEND: "drizzle",
  CMS_MUTATION_BACKEND: "disabled",
} as const);

/**
 * The application no longer selects Clerk or Supabase at runtime. CMS writes
 * remain disabled until their Neon repository implementation is available;
 * they never fall back to a legacy service role.
 */
export function parseBackendConfiguration(env: BackendEnvironment): BackendConfiguration {
  for (const [name, expected] of Object.entries(EXPECTED)) {
    const value = env[name];
    if (value !== undefined && value !== "" && value !== expected) {
      throw new BackendConfigurationError();
    }
  }
  return Object.freeze({
    auth: "better-auth",
    blogReads: "drizzle",
    projectReads: "drizzle",
    privateMedia: "drizzle",
    cmsMutations: "disabled",
  });
}

export function getBackendConfiguration(): BackendConfiguration {
  return parseBackendConfiguration({
    AUTH_PROVIDER: process.env.AUTH_PROVIDER,
    BLOG_READ_BACKEND: process.env.BLOG_READ_BACKEND,
    PROJECT_READ_BACKEND: process.env.PROJECT_READ_BACKEND,
    PRIVATE_MEDIA_BACKEND: process.env.PRIVATE_MEDIA_BACKEND,
    CMS_MUTATION_BACKEND: process.env.CMS_MUTATION_BACKEND,
  });
}
