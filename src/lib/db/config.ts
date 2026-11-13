import { parseNeonDevelopmentRuntimeTarget } from "./neon-development-target";
import { isLocalPostgresIntegrationEnabled, parseLocalPostgresTarget } from "./local-postgres-target";
import { hasValidLocalAuthRuntimeConfiguration } from "../auth/local-runtime-policy";

export type RuntimeEnvironment = Record<string, string | undefined>;

export type DatabaseConfiguration = { databaseUrl: string };
export type SocialProviderConfiguration = {
  google?: { clientId: string; clientSecret: string; requireEmailVerification: true };
  apple?: { clientId: string; clientSecret: string; requireEmailVerification: true };
};
export type AuthConfiguration = DatabaseConfiguration & {
  secret: string;
  baseURL: string;
  socialProviders: SocialProviderConfiguration;
  localDevelopment?: boolean;
};

export class MissingConfigurationError extends Error {
  readonly missing: readonly string[];
  constructor(missing: readonly string[]) {
    super(`Service configuration is missing: ${missing.join(", ")}`);
    this.name = "MissingConfigurationError";
    this.missing = missing;
  }
}

export class InvalidConfigurationError extends Error {
  constructor() {
    super("Service configuration is invalid");
    this.name = "InvalidConfigurationError";
  }
}

export function configuredSocialProviderIds(env: RuntimeEnvironment): Array<"apple" | "google"> {
  if (isLocalPostgresIntegrationEnabled(env)) return [];
  const providers: Array<"apple" | "google"> = [];
  if (env.BETTER_AUTH_APPLE_CLIENT_ID && env.BETTER_AUTH_APPLE_CLIENT_SECRET) providers.push("apple");
  if (env.BETTER_AUTH_GOOGLE_CLIENT_ID && env.BETTER_AUTH_GOOGLE_CLIENT_SECRET) providers.push("google");
  return providers;
}

export function parseDatabaseConfiguration(env: RuntimeEnvironment): DatabaseConfiguration {
  if (!env.DATABASE_URL) throw new MissingConfigurationError(["DATABASE_URL"]);
  let databaseURL: URL;
  try { databaseURL = new URL(env.DATABASE_URL); }
  catch { throw new InvalidConfigurationError(); }
  if (!["postgres:", "postgresql:"].includes(databaseURL.protocol) || !databaseURL.hostname || !databaseURL.pathname || databaseURL.pathname === "/") {
    throw new InvalidConfigurationError();
  }
  return { databaseUrl: env.DATABASE_URL };
}

export function parseAuthConfiguration(env: RuntimeEnvironment): AuthConfiguration {
  const providerPairs = [
    ["BETTER_AUTH_GOOGLE_CLIENT_ID", "BETTER_AUTH_GOOGLE_CLIENT_SECRET"],
    ["BETTER_AUTH_APPLE_CLIENT_ID", "BETTER_AUTH_APPLE_CLIENT_SECRET"],
  ] as const;
  // The isolated launcher explicitly clears provider variables to empty strings.
  if (isLocalPostgresIntegrationEnabled(env)) {
    if (providerPairs.some(([clientId, clientSecret]) => env[clientId] || env[clientSecret])) throw new InvalidConfigurationError();
    const { databaseUrl } = parseLocalPostgresTarget(env, "auth");
    if (!hasValidLocalAuthRuntimeConfiguration(env)) throw new InvalidConfigurationError();
    return { databaseUrl, secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL, socialProviders: {}, localDevelopment: true };
  }
  if (providerPairs.some(([clientId, clientSecret]) => {
    const id = env[clientId];
    const secret = env[clientSecret];
    return Boolean(id) !== Boolean(secret) || (id !== undefined && !id.trim()) || (secret !== undefined && !secret.trim());
  })) {
    throw new InvalidConfigurationError();
  }
  const missing = [
    ...(!env.NEON_AUTH_DATABASE_URL ? ["NEON_AUTH_DATABASE_URL"] : []),
    ...(!env.NEON_TARGET ? ["NEON_TARGET"] : []),
    ...(!env.NEON_PROJECT_ID ? ["NEON_PROJECT_ID"] : []),
    ...(!env.NEON_BRANCH_ID ? ["NEON_BRANCH_ID"] : []),
    ...(!env.NEON_ENDPOINT_ID ? ["NEON_ENDPOINT_ID"] : []),
    ...(!env.BETTER_AUTH_SECRET ? ["BETTER_AUTH_SECRET"] : []),
    ...(!env.BETTER_AUTH_URL ? ["BETTER_AUTH_URL"] : []),
  ];
  if (missing.length) throw new MissingConfigurationError(missing);
  const { databaseUrl } = parseNeonDevelopmentRuntimeTarget(env, "drckgomz_auth_runtime", "NEON_AUTH_DATABASE_URL");
  let baseURL: URL;
  try { baseURL = new URL(env.BETTER_AUTH_URL!); }
  catch { throw new InvalidConfigurationError(); }
  if (!new Set(["http:", "https:"]).has(baseURL.protocol) || baseURL.username || baseURL.password ||
      baseURL.pathname !== "/" || baseURL.search || baseURL.hash) {
    throw new InvalidConfigurationError();
  }
  if (env.NODE_ENV === "production" && baseURL.protocol !== "https:") throw new InvalidConfigurationError();
  if (env.BETTER_AUTH_SECRET!.length < 32) throw new InvalidConfigurationError();
  const socialProviders: SocialProviderConfiguration = {};
  if (env.BETTER_AUTH_GOOGLE_CLIENT_ID && env.BETTER_AUTH_GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID,
      clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
      requireEmailVerification: true,
    };
  }
  if (env.BETTER_AUTH_APPLE_CLIENT_ID && env.BETTER_AUTH_APPLE_CLIENT_SECRET) {
    socialProviders.apple = {
      clientId: env.BETTER_AUTH_APPLE_CLIENT_ID,
      clientSecret: env.BETTER_AUTH_APPLE_CLIENT_SECRET,
      requireEmailVerification: true,
    };
  }
  return {
    databaseUrl,
    secret: env.BETTER_AUTH_SECRET!,
    baseURL: baseURL.origin,
    socialProviders,
  };
}

export function isMissingConfigurationError(error: unknown): error is MissingConfigurationError {
  return error instanceof MissingConfigurationError;
}
