import { defineConfig } from "drizzle-kit";

// `generate` uses this fixed loopback placeholder and never reads DATABASE_URL.
// A future separately approved development procedure must supply an attested
// development branch before any migration command is run.
const offlineUrl = "postgresql://offline:offline@127.0.0.1:1/phase3e_offline";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: offlineUrl },
  migrations: { schema: "drizzle", table: "__drizzle_migrations" },
  strict: true,
  verbose: true,
});
