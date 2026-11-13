import 'server-only';
import { sql } from 'drizzle-orm';
import { withCurrentOwnerSession } from '@/lib/db/owner-session';
import { isLocalPostgresIntegrationEnabled, verifyAllLocalPostgresTargets } from '@/lib/db/local-postgres-target';
import type { CmsSection, CmsMutation } from '@/lib/cms/contracts';
import type { CmsResult } from '@/lib/cms/resource-service';
export async function cmsResourcesAvailable() {
  if (!isLocalPostgresIntegrationEnabled(process.env)) return false;
  verifyAllLocalPostgresTargets(process.env);
  try { return await withCurrentOwnerSession(async tx => {
    const result=await tx.execute(sql`select coalesce(pg_catalog.has_function_privilege(current_user,to_regprocedure('app_private.phase8_cms_read(text,text,integer,integer)'),'EXECUTE'),false)
      and coalesce(pg_catalog.has_function_privilege(current_user,to_regprocedure('app_private.phase8_cms_write(text,jsonb)'),'EXECUTE'),false) as available`);
    return result.rows[0]?.available===true;
  }); } catch { return false; }
}
export async function readCmsResource(section: CmsSection,id: string|null,limit=25,offset=0): Promise<CmsResult> {
  if(!await cmsResourcesAvailable()) return {kind:'unavailable'};
  return withCurrentOwnerSession(async tx => {
    const result=await tx.execute(sql`select app_private.phase8_cms_read(${section},${id},${limit},${offset}) as payload`);
    return result.rows[0]?.payload as CmsResult || {kind:'unavailable'};
  });
}
export async function writeCmsResource(section: CmsSection,value: CmsMutation): Promise<CmsResult> {
  if(!await cmsResourcesAvailable()) return {kind:'unavailable'};
  return withCurrentOwnerSession(async tx => {
    const result=await tx.execute(sql`select app_private.phase8_cms_write(${section},${JSON.stringify(value)}::jsonb) as payload`);
    return result.rows[0]?.payload as CmsResult || {kind:'unavailable'};
  });
}
