import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { withCurrentContentSession } from '@/lib/db/content-session';
import { isLocalPostgresIntegrationEnabled,verifyAllLocalPostgresTargets } from '@/lib/db/local-postgres-target';
import { appearanceSchema,homepageSchema,navigationSchema,siteSettingsSchema } from '@/lib/cms/contracts';
export type PublishedConfiguration = { appearance?: z.infer<typeof appearanceSchema>; homepage?: z.infer<typeof homepageSchema>; navigation?: z.infer<typeof navigationSchema>; settings?: z.infer<typeof siteSettingsSchema> };
const schemas={appearance:appearanceSchema,homepage:homepageSchema,navigation:navigationSchema,settings:siteSettingsSchema};
/** Only validated published public fields; never a runtime/env or draft settings dump. */
export const readPublishedConfiguration=cache(async ():Promise<PublishedConfiguration>=>{
  if(!isLocalPostgresIntegrationEnabled(process.env)) return {};
  verifyAllLocalPostgresTargets(process.env);
  try { return await withCurrentContentSession(async tx=>{
    const ready=await tx.execute(sql`select to_regclass('app.site_configuration') is not null as ready`);
    if(ready.rows[0]?.ready!==true)return {};
    const result=await tx.execute(sql`select key,published from app.site_configuration where published is not null order by key limit 4`);
    const output:PublishedConfiguration={};
    for(const row of result.rows as Array<{key:string;published:unknown}>){
      if(!Object.hasOwn(schemas,row.key))continue;
      const parsed=schemas[row.key as keyof typeof schemas].safeParse(row.published);
      if(parsed.success)Object.assign(output,{[row.key]:parsed.data});
    }
    return output;
  }); }catch{return {};}
});
