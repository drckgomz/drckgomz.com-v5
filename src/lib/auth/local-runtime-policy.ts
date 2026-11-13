export function hasValidLocalAuthRuntimeConfiguration(env: Record<string, string | undefined>): env is Record<string, string | undefined> & {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: "http://localhost:3000";
} {
  return env.NODE_ENV === "development" && typeof env.BETTER_AUTH_SECRET === "string" && env.BETTER_AUTH_SECRET.length >= 32 &&
    env.BETTER_AUTH_URL === "http://localhost:3000";
}
