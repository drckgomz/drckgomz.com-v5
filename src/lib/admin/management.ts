import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { withCurrentOwnerSession } from "@/lib/db/owner-session";
import { isLocalPostgresIntegrationEnabled, verifyAllLocalPostgresTargets } from "@/lib/db/local-postgres-target";

export async function requireManagementOwner() {
  const profile = await requireAdmin();
  if (!profile.is_owner) notFound();
  return profile;
}

export type StoredAppearance = { key: string; publication: string; version: number; updated_at: string };
export type AppearanceRead = { available: true; rows: StoredAppearance[] } | { available: false; reason: string };
export async function readAppearanceStatus(): Promise<AppearanceRead> {
  await requireManagementOwner();
  if (!isLocalPostgresIntegrationEnabled(process.env)) return { available: false, reason: "The appearance repository is unavailable in this runtime." };
  verifyAllLocalPostgresTargets(process.env);
  try {
    return await withCurrentOwnerSession(async tx => {
      // Do not expose arbitrary settings JSON, infrastructure values, or media keys.
      const result = await tx.execute(sql`select key, publication, version, updated_at::text from app.appearance_settings order by key limit 10`);
      return { available: true, rows: result.rows as StoredAppearance[] };
    });
  } catch {
    return { available: false, reason: "Stored appearance settings cannot be read by the configured owner repository. The public site still uses the effective source configuration shown here. Editing and publication are unavailable." };
  }
}

export async function readBugBackend(): Promise<{ available: boolean; reason: string }> {
  await requireManagementOwner();
  if (!isLocalPostgresIntegrationEnabled(process.env)) return { available: false, reason: "The bug-report repository is unavailable in this runtime." };
  verifyAllLocalPostgresTargets(process.env);
  try {
    const exists = await withCurrentOwnerSession(async tx => {
      const result = await tx.execute(sql`select pg_catalog.to_regclass('app.bug_reports') is not null as present`);
      return result.rows[0]?.present === true;
    });
    return { available: false, reason: exists
      ? "A bug-report table exists, but a reviewed owner read/update repository is not configured. Reports cannot be loaded or triaged."
      : "No application bug-report table is installed. The legacy reports were intentionally excluded from recovery. No reports have been loaded; this is not an empty inbox." };
  } catch {
    return { available: false, reason: "The bug-report backend check failed. No reports have been loaded." };
  }
}

export async function readCanonicalTheme() {
  await requireManagementOwner();
  try {
    const css = await readFile(resolve(process.cwd(), "src/styles/themes.css"), "utf8");
    // Fixed source path; never read a path or arbitrary CSS supplied by a request.
    const tokens = [...css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)].map(match => ({ name: match[1], value: match[2].trim() }));
    return { available: true as const, tokens };
  } catch {
    return { available: false as const, tokens: [] };
  }
}

export async function readPrivateAccessAvailability() {
  await requireManagementOwner();
  if (!isLocalPostgresIntegrationEnabled(process.env)) return false;
  verifyAllLocalPostgresTargets(process.env);
  try {
    return await withCurrentOwnerSession(async tx => {
      const result = await tx.execute(sql`select
        coalesce(pg_catalog.has_function_privilege(current_user,
          pg_catalog.to_regprocedure('app_private.list_private_audience_users(text,integer,integer)'), 'EXECUTE'), false)
        and coalesce(pg_catalog.has_function_privilege(current_user,
          pg_catalog.to_regprocedure('app_private.set_private_journal_access(text,text,boolean)'), 'EXECUTE'), false) as available`);
      return result.rows[0]?.available === true;
    });
  } catch { return false; }
}
