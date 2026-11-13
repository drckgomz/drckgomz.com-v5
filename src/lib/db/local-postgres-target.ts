export const PHASE6_LOCAL_TARGET = Object.freeze({
  selector: "phase6-local",
  host: "127.0.0.1",
  port: "55441",
  database: "drckgomz_phase5_test",
  authRole: "drckgomz_local_auth",
  contentRole: "drckgomz_local_content",
  ownerRole: "drckgomz_local_owner",
});

export type LocalPostgresEnvironment = Record<string, string | undefined>;
export type LocalDatabaseKind = "auth" | "content" | "owner";

export class UnverifiedLocalPostgresTargetError extends Error {
  constructor() {
    super("Local PostgreSQL integration target is missing or does not match the approved disposable target");
    this.name = "UnverifiedLocalPostgresTargetError";
  }
}

const TARGET_URLS: Record<LocalDatabaseKind, { variable: string; role: string }> = {
  auth: { variable: "LOCAL_PG_AUTH_DATABASE_URL", role: PHASE6_LOCAL_TARGET.authRole },
  content: { variable: "LOCAL_PG_CONTENT_DATABASE_URL", role: PHASE6_LOCAL_TARGET.contentRole },
  owner: { variable: "LOCAL_PG_OWNER_DATABASE_URL", role: PHASE6_LOCAL_TARGET.ownerRole },
};

/** A separate local opt-in. It never changes or falls through to the Neon guard. */
export function isLocalPostgresIntegrationEnabled(env: LocalPostgresEnvironment): boolean {
  return env.LOCAL_PG_INTEGRATION === "1";
}

export function parseLocalPostgresTarget(env: LocalPostgresEnvironment, kind: LocalDatabaseKind) {
  const target = PHASE6_LOCAL_TARGET;
  const required = TARGET_URLS[kind];
  if (env.NODE_ENV !== "development" || env.OFFLINE_DESIGN_MODE === "1" ||
      env.LOCAL_PG_INTEGRATION !== "1" || env.LOCAL_PG_TARGET !== target.selector || !env[required.variable]) {
    throw new UnverifiedLocalPostgresTargetError();
  }

  try {
    const url = new URL(env[required.variable]!);
    const parameters = [...url.searchParams.entries()];
    if (!new Set(["postgres:", "postgresql:"]).has(url.protocol) ||
        url.hostname !== target.host || url.port !== target.port ||
        decodeURIComponent(url.username) !== required.role || url.password !== "" ||
        decodeURIComponent(url.pathname.slice(1)) !== target.database || url.hash ||
        parameters.length !== 1 || parameters[0][0] !== "sslmode" || parameters[0][1] !== "disable") {
      throw new Error();
    }
    return Object.freeze({ databaseUrl: env[required.variable]!, target, role: required.role, connectionVariable: required.variable });
  } catch {
    throw new UnverifiedLocalPostgresTargetError();
  }
}

export function verifyAllLocalPostgresTargets(env: LocalPostgresEnvironment) {
  return Object.freeze({
    auth: parseLocalPostgresTarget(env, "auth"),
    content: parseLocalPostgresTarget(env, "content"),
    owner: parseLocalPostgresTarget(env, "owner"),
  });
}
