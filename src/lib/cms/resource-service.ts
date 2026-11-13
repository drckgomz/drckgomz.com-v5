import { boundedJson, cmsJson, CmsInputError } from './request';
import { isSameOriginRequest } from '@/lib/auth/same-origin';
import { isCmsSection, parseCmsMutation, type CmsSection, type CmsMutation } from './contracts';
export type CmsResult = { kind: 'ok'; items?: unknown[]; item?: unknown; total?: number } | { kind: 'unavailable'|'missing'|'conflict'|'protected' };
export function createResourceHandlers(deps: {
  authorize: () => Promise<Response | null>;
  sanitizeProjectContent: (html: string) => string;
  read: (section: CmsSection, id: string | null, limit: number, offset: number) => Promise<CmsResult>;
  mutate: (section: CmsSection, value: CmsMutation) => Promise<CmsResult>;
}) {
  function respond(result: CmsResult) {
    if (result.kind === 'ok') return cmsJson(result);
    const status = { unavailable:503, missing:404, conflict:409, protected:403 }[result.kind];
    return cmsJson({ error: result.kind === 'unavailable' ? 'This management backend is not installed. No changes were saved.' : result.kind === 'conflict' ? 'The record changed. Reload before saving.' : result.kind === 'protected' ? 'This account or record is protected.' : 'Record not found.' },status);
  }
  return {
    async GET(request: Request, section: string) {
      try { const denied=await deps.authorize(); if(denied) return denied; if(!isCmsSection(section)) return cmsJson({error:'Unknown section.'},404);
        const params=new URL(request.url).searchParams; const limit=Number(params.get('limit')??25), offset=Number(params.get('offset')??0), id=params.get('id');
        if(!Number.isInteger(limit)||limit<1||limit>50||!Number.isSafeInteger(offset)||offset<0||offset>1_000_000|| (id!==null&&!/^[A-Za-z0-9_-]{1,128}$/.test(id))) return cmsJson({error:'Invalid query.'},400);
        return respond(await deps.read(section,id,limit,offset));
      } catch { return cmsJson({error:'Management backend unavailable.'},503); }
    },
    async PUT(request: Request, section: string) {
      let denied: Response | null;
      try { denied=await deps.authorize(); } catch { return cmsJson({error:"Authorization unavailable."},503); }
      if(denied) return denied;
      if(!isSameOriginRequest(request)) return cmsJson({error:'Same-origin request required.'},403);
      if(!isCmsSection(section)) return cmsJson({error:'Unknown section.'},404);
      let value: CmsMutation;
      try { value=parseCmsMutation(section,await boundedJson(request,2_100_000)); }
      catch(error) { return cmsJson({error:error instanceof CmsInputError ? error.message : 'Invalid management input. Check supported fields and revision.'},error instanceof CmsInputError?error.status:400); }
      if(section === "projects" && value.data) value={ ...value, data: { ...value.data as object, content:deps.sanitizeProjectContent((value.data as {content:string}).content) } };
      try { return respond(await deps.mutate(section,value)); }
      catch { return cmsJson({error:'Save failed; no changes confirmed.'},503); }
    },
  };
}
