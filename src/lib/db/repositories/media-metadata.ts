import 'server-only';
import { isLocalPostgresIntegrationEnabled, verifyAllLocalPostgresTargets } from '@/lib/db/local-postgres-target';
import { sql } from 'drizzle-orm';
import { withCurrentOwnerSession } from '@/lib/db/owner-session';
import type { MediaMetadataPatch, MetadataResult } from '@/lib/cms/media-metadata';

export async function mediaMetadataAvailable() {
  if (!isLocalPostgresIntegrationEnabled(process.env)) return false;
  verifyAllLocalPostgresTargets(process.env);
  try { return await withCurrentOwnerSession(async tx => {
    const result = await tx.execute(sql`select coalesce(pg_catalog.has_function_privilege(current_user,
      pg_catalog.to_regprocedure('app_private.phase8_media_metadata(text,jsonb)'), 'EXECUTE'), false) as available`);
    return result.rows[0]?.available === true;
  }); } catch { return false; }
}
export async function ownerMediaMetadata(id: string, patch: MediaMetadataPatch | null): Promise<MetadataResult> {
  if (!await mediaMetadataAvailable()) return { kind: 'unavailable' };
  return withCurrentOwnerSession(async tx => {
    const result = await tx.execute(sql`select app_private.phase8_media_metadata(${id}, ${patch ? JSON.stringify(patch) : null}::jsonb) as payload`);
    const value = result.rows[0]?.payload as MetadataResult | undefined;
    if (!value || !['ok','missing','conflict'].includes(value.kind)) return { kind: 'unavailable' };
    return value;
  });
}
