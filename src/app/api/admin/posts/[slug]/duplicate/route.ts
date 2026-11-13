import {requireAdminApi} from '@/lib/admin/requireAdminApi';
import {isSameOriginRequest} from '@/lib/auth/same-origin';
import {boundedJson,cmsJson,CmsInputError} from '@/lib/cms/request';
import {duplicateOwnerDraft} from '@/lib/db/repositories/admin-posts';
export async function POST(request:Request,context:{params:Promise<{slug:string}>}) {
  const denied=await requireAdminApi('posts:update');if(denied)return denied;
  if(!isSameOriginRequest(request))return cmsJson({error:'Same-origin request required.'},403);
  try{const body=await boundedJson(request);if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||!('expected_revision'in body)||!Number.isSafeInteger(body.expected_revision)||Number(body.expected_revision)<1)return cmsJson({error:'A current revision is required.'},428);
    const result=await duplicateOwnerDraft({slug:(await context.params).slug,expectedRevision:Number(body.expected_revision)});
    if(result.kind==='missing')return cmsJson({error:'Post not found.'},404);
    if(result.kind==='conflict')return cmsJson({error:'The source changed. Reload before duplicating.'},409);
    if(result.kind==='too-large')return cmsJson({error:'Source content exceeds the editor limit.'},413);
    return cmsJson(result,201);
  }catch(error){return cmsJson({error:error instanceof CmsInputError?error.message:'Draft copy failed; no changes confirmed.'},error instanceof CmsInputError?error.status:503);}
}
