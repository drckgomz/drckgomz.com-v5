import { sanitizeProjectHtml } from "@/lib/content/projectHtml";
import { requireAdminApi } from '@/lib/admin/requireAdminApi';
import { createResourceHandlers } from '@/lib/cms/resource-service';
import { readCmsResource,writeCmsResource } from '@/lib/db/repositories/cms-resources';
const handlers=createResourceHandlers({ authorize:()=>requireAdminApi('posts:update'),read:readCmsResource,mutate:writeCmsResource,sanitizeProjectContent:sanitizeProjectHtml });
export async function GET(request:Request,context:{params:Promise<{section:string}>}) {return handlers.GET(request,(await context.params).section);}
export async function PUT(request:Request,context:{params:Promise<{section:string}>}) {return handlers.PUT(request,(await context.params).section);}
