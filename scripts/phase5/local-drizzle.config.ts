import { defineConfig } from "drizzle-kit";

/**
 * Disposable PostgreSQL 18 integration target only. This URL is hard-pinned
 * to the repository-local loopback cluster; it does not read environment
 * files or fall back to any Neon URL.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: "postgresql://phase5_local@127.0.0.1:55441/drckgomz_phase5_test?sslmode=disable",
  },
  migrations: { schema: "drizzle", table: "__drizzle_migrations" },
  strict: true,
  verbose: true,
});
