import 'server-only';
import ResourceEditor from '@/components/admin/management/ResourceEditor';
import { Unavailable } from '@/components/admin/management/ManagementPage';
import { cmsResourcesAvailable,readCmsResource } from '@/lib/db/repositories/cms-resources';
import { requireManagementOwner } from './management';
import { resourceSchemas,type CmsSection } from '@/lib/cms/contracts';
export async function resourceEditor(section:CmsSection,id:string,defaults:Record<string,unknown>,create=false) {
  await requireManagementOwner();
  if(!await cmsResourcesAvailable())return null;
  if(create)return <ResourceEditor section={section} id={id} initial={defaults} create/>;
  const result=await readCmsResource(section,id,1,0);
  if(result.kind!=='ok')return <Unavailable>The management repository could not load this record. No changes were made.</Unavailable>;
  const item=result.items?.[0] as Record<string,unknown>|undefined;
  if(!item&&['projects','users'].includes(section))return <Unavailable>The requested record does not exist.</Unavailable>;
  const source=(item?.data??item??defaults) as Record<string,unknown>;
  const fields=Object.fromEntries(Object.keys(defaults).map(key=>[key,source[key]]));
  const parsed=resourceSchemas[section].safeParse(fields);
  if(!parsed.success)return <Unavailable>The stored record does not match the supported editing contract. It has been preserved without conversion.</Unavailable>;
  return <ResourceEditor section={section} id={id} initial={parsed.data} revision={typeof item?.revision==='number'?item.revision:1} protectedAccount={item?.is_owner===true}/>;
}
export const projectDefaults={title:'',slug:'',excerpt:'',content:'',href:'',idx:0,publication_state:'draft',visibility:'private',technologies:[],media_ids:[],featured_media_id:null};
