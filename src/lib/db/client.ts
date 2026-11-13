import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { drizzle as nodePostgresDrizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { parseDatabaseConfiguration } from "./config";
import { NEON_DEVELOPMENT_TARGET, parseNeonDevelopmentRuntimeTarget } from "./neon-development-target";
import { isLocalPostgresIntegrationEnabled, parseLocalPostgresTarget, type LocalDatabaseKind } from "./local-postgres-target";

type Database = ReturnType<typeof drizzle<typeof schema>>;
type DatabasePool = Pool | pg.Pool;
const databases = new Map<string, { pool: DatabasePool; database: Database }>();

function getVerifiedDatabase(expectedRole: string, connectionVariable: string): Database {
  // Validate the explicit role-specific URL before consulting a cached pool.
  const { databaseUrl } = parseNeonDevelopmentRuntimeTarget(process.env, expectedRole, connectionVariable);
  const cached = databases.get(expectedRole);
  if (cached) return cached.database;
  const pool = new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000 });
  const database = drizzle({ client: pool, schema });
  databases.set(expectedRole, { pool, database });
  return database;
}

function getLocalDatabase(kind: LocalDatabaseKind): Database {
  const target = parseLocalPostgresTarget(process.env, kind);
  const cacheKey = `local:${kind}:${target.role}`;
  const cached = databases.get(cacheKey);
  if (cached) return cached.database;
  const pool = new pg.Pool({ connectionString: target.databaseUrl, max: 4, connectionTimeoutMillis: 3_000, idleTimeoutMillis: 10_000 });
  // Both drivers implement the same PostgreSQL Drizzle schema/query surface;
  // the cast is confined to this adapter boundary.
  const database = nodePostgresDrizzle(pool, { schema }) as unknown as Database;
  databases.set(cacheKey, { pool, database });
  return database;
}

/** Construct lazily: importing a route or running a build never requires DATABASE_URL. */
export function getDatabase(expectedRole: string = NEON_DEVELOPMENT_TARGET.runtimeRole) {
  parseDatabaseConfiguration(process.env);
  return getVerifiedDatabase(expectedRole, "DATABASE_URL");
}

/** Better Auth identity/session adapter pool; never falls back to DATABASE_URL. */
export function getAuthDatabase() {
  if (isLocalPostgresIntegrationEnabled(process.env)) return getLocalDatabase("auth");
  return getVerifiedDatabase("drckgomz_auth_runtime", "NEON_AUTH_DATABASE_URL");
}

/** RLS-protected content read pool; access must occur in withContentSession(). */
export function getContentDatabase() {
  if (isLocalPostgresIntegrationEnabled(process.env)) return getLocalDatabase("content");
  return getVerifiedDatabase("drckgomz_content_reader", "NEON_CONTENT_DATABASE_URL");
}

/** EXECUTE-only owner-management function pool; no direct table access. */
export function getOwnerOperationDatabase() {
  if (isLocalPostgresIntegrationEnabled(process.env)) return getLocalDatabase("owner");
  return getVerifiedDatabase("drckgomz_owner_runtime", "NEON_OWNER_DATABASE_URL");
}

export async function closeDatabasePool() {
  const current = [...databases.values()];
  databases.clear();
  await Promise.all(current.map(({ pool }) => pool.end()));
}
