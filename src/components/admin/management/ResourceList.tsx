import Link from 'next/link';
import UserAccessList from './UserAccessList';
import ManagementPage,{Unavailable} from './ManagementPage';
import {readCmsResource} from '@/lib/db/repositories/cms-resources';
import {resourceEditor} from '@/lib/admin/resource-editor';
export default async function ResourceList({section,offset=0}:{section:'projects'|'users';offset?:number}) {
  const result=await readCmsResource(section,null,25,offset);
  return <ManagementPage title={section==='projects'?'Manage Projects':'Users and access'} description="Real records from the owner-authorized management repository.">
    {section==='projects'&&<Link href="/admin/projects/new" className="inline-block rounded border border-border p-3">Create project</Link>}
    {result.kind!=='ok'?<Unavailable>The management list could not load. No empty collection is implied.</Unavailable>:<>
      {!result.items?.length?<p>No records on this page.</p>:section==='users'?<UserAccessList accounts={await Promise.all(result.items.map(async value=>{
        const item=value as {id:string;name?:string;email?:string;roles?:string[];is_owner?:boolean;enabled?:boolean;banned?:boolean};
        return {id:item.id,name:item.name??'',email:item.email??'',roles:item.roles??[],owner:item.is_owner===true,enabled:item.enabled===true,banned:item.banned===true,editor:await resourceEditor('users',item.id,{roles:[],enabled:true,banned:false})};
      }))}/>:<ul className="space-y-4">{result.items.map(value=>{
        const item=value as {id:string;title?:string};
        return <li key={item.id} className="space-y-3 rounded border border-border p-4"><h2 className="break-words text-lg">{item.title||'Project'}</h2><Link href={`/admin/projects/${encodeURIComponent(item.id)}`} className="underline">Edit project</Link></li>;
      })}</ul>}
      <nav aria-label="Management pages" className="flex gap-4">{offset>0&&<Link className="underline" href={`/admin/${section}?offset=${Math.max(0,offset-25)}`}>Previous</Link>}{offset+25<(result.total??0)&&<Link className="underline" href={`/admin/${section}?offset=${offset+25}`}>Next</Link>}</nav>
    </>}
  </ManagementPage>;
}
