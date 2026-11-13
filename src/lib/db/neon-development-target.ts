export const NEON_DEVELOPMENT_TARGET = Object.freeze({
  target: "development",
  project: "jolly-poetry-87664309",
  branch: "br-nameless-dust-bewpmr4r",
  endpoint: "ep-sparkling-sun-bedq0ozn",
  hostname: "ep-sparkling-sun-bedq0ozn.c-9.us-east-2.aws.neon.tech",
  database: "neondb",
  runtimeRole: "drckgomz_runtime",
});

export type NeonTargetEnvironment = Record<string, string | undefined>;

export class UnverifiedNeonDevelopmentTargetError extends Error {
  constructor() {
    super("Neon development database target is missing or does not match the reviewed target");
    this.name = "UnverifiedNeonDevelopmentTargetError";
  }
}

/** Exact local guard; branch/project IDs must be freshly attested in Neon Console. */
export function parseNeonDevelopmentRuntimeTarget(
  env: NeonTargetEnvironment,
  expectedRole: string = NEON_DEVELOPMENT_TARGET.runtimeRole,
  connectionVariable: string = "DATABASE_URL",
) {
  const required = [connectionVariable, "NEON_TARGET", "NEON_PROJECT_ID", "NEON_BRANCH_ID", "NEON_ENDPOINT_ID"] as const;
  if (required.some((key) => !env[key])) throw new UnverifiedNeonDevelopmentTargetError();

  const target = NEON_DEVELOPMENT_TARGET;
  if (env.NEON_TARGET !== target.target || env.NEON_PROJECT_ID !== target.project ||
      env.NEON_BRANCH_ID !== target.branch || env.NEON_ENDPOINT_ID !== target.endpoint) {
    throw new UnverifiedNeonDevelopmentTargetError();
  }

  let url: URL;
  let username: string;
  let database: string;
  try {
    url = new URL(env[connectionVariable]!);
    username = decodeURIComponent(url.username);
    database = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new UnverifiedNeonDevelopmentTargetError();
  }

  const sslmode = url.searchParams.get("sslmode");
  if (!new Set(["postgres:", "postgresql:"]).has(url.protocol) ||
      url.hostname !== target.hostname || !new Set(["", "5432"]).has(url.port) ||
      database !== target.database || username !== expectedRole || !url.password ||
      !new Set(["require", "verify-full"]).has(sslmode ?? "") ||
      url.hash || url.searchParams.has("host")) {
    throw new UnverifiedNeonDevelopmentTargetError();
  }
  const allowedParameters = new Set(["sslmode", "channel_binding", "application_name", "connect_timeout", "pool_timeout"]);
  const seenParameters = new Set<string>();
  for (const [key] of url.searchParams) {
    if (!allowedParameters.has(key) || seenParameters.has(key)) throw new UnverifiedNeonDevelopmentTargetError();
    seenParameters.add(key);
  }

  return Object.freeze({ databaseUrl: env[connectionVariable]!, target, connectionVariable, role: expectedRole });
}
