'use client';
import { useEffect,useState } from 'react';
import type { CmsSection } from '@/lib/cms/contracts';
import { resourceSchemas } from '@/lib/cms/contracts';
import { publicDestinations } from '@/lib/site/public-config';
import BlogContent from '@/components/blog/BlogContent';
import Editor from '@/components/admin/editor/Editor';

type Values=Record<string,unknown>;
function canonicalPalette(theme:string) {
  const node=document.createElement('div');node.dataset.theme=theme;node.style.position='absolute';node.style.visibility='hidden';document.body.append(node);
  const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;const context=canvas.getContext('2d')!;
  const color=(token:string)=>{node.style.color=`var(${token})`;context.fillStyle=getComputedStyle(node).color;context.fillRect(0,0,1,1);const rgb=context.getImageData(0,0,1,1).data;return '#'+[...rgb].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');};
  const value={background:color('--background'),foreground:color('--foreground'),primary:color('--primary'),primary_foreground:color('--primary-foreground')};node.remove();return value;
}
export default function ResourceEditor({section,id,initial,revision=1,create=false,protectedAccount=false}:{section:CmsSection;id:string;initial:Values;revision?:number;create?:boolean;protectedAccount?:boolean}) {
  const [data,setData]=useState(initial),[saved,setSaved]=useState(JSON.stringify(initial)),[version,setVersion]=useState(revision),[isCreate,setIsCreate]=useState(create);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[deleted,setDeleted]=useState(false),[preview,setPreview]=useState(false);
  const dirty=JSON.stringify(data)!==saved;
  useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  const set=(key:string,value:unknown)=>setData(previous=>({...previous,[key]:value}));
  const input=(key:string,label:string,multiline=false,maxLength=2000)=><label key={key} className="block">{label}{multiline?<textarea maxLength={maxLength} value={String(data[key]??'')} onChange={e=>set(key,e.target.value)} className="mt-1 block min-h-24 w-full rounded border border-border bg-background p-3"/>:<input maxLength={maxLength} value={String(data[key]??'')} onChange={e=>set(key,e.target.value)} className="mt-1 block w-full rounded border border-border bg-background p-3"/>}</label>;
  async function mutate(operation:'create'|'update'|'delete',publication?:'draft'|'published') {
    if(busy||protectedAccount||deleted)return;
    if(operation==='delete'&&!window.confirm('Delete this project? Projects with gallery references cannot be deleted.'))return;
    if((publication==='published'||(section==='projects'&&data.publication_state==='published'))&&!window.confirm('Publish these changes to the public website?'))return;
    if(section==='users'&&!window.confirm('Apply these account access changes?'))return;
    setError('');setMessage('');
    if(operation!=='delete'){const parsed=resourceSchemas[section].safeParse(data);if(!parsed.success){setError(parsed.error.issues.map(issue=>issue.message).join(' '));return;}}
    setBusy(true);
    try{const response=await fetch(`/api/admin/cms/${section}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation,id,...(operation==='create'?{}:{expected_revision:version}),...(operation==='delete'?{}:{data}),...(publication?{publication}:{})})});
      const json=await response.json();if(!response.ok)throw new Error(json.error||'Save failed.');
      if(operation==='delete'){setDeleted(true);setMessage('Project deleted.');setSaved(JSON.stringify(data));return;}
      const fresh=await fetch(`/api/admin/cms/${section}?id=${encodeURIComponent(id)}`,{cache:'no-store'});const body=await fresh.json();if(!fresh.ok||!body.items?.[0])throw new Error('Saved, but refresh could not confirm the latest version. Reload before editing.');
      const item=body.items[0];const source=item.data??item;const normalized=Object.fromEntries(Object.keys(initial).map(key=>[key,source[key]]));const parsed=resourceSchemas[section].safeParse(normalized);if(!parsed.success)throw new Error('Saved record could not be validated on refresh. Reload before editing.');setData(parsed.data);setVersion(item.revision);setSaved(JSON.stringify(parsed.data));setIsCreate(false);setMessage(publication==='published'?'Changes published.':'Changes saved.');
    }catch(cause){setError(cause instanceof Error?cause.message:'Save failed.');}finally{setBusy(false);}
  }
  const configurations=['appearance','navigation','homepage','settings'].includes(section);
  return <form className="space-y-5 rounded-xl border border-border p-4" onSubmit={event=>{event.preventDefault();void mutate(isCreate?'create':'update',configurations?'draft':undefined);}}>
    <p role="status">{busy?'Saving…':message|| (dirty?'Unsaved changes':'Ready')}</p>{error&&<p role="alert">{error}</p>}
    {protectedAccount&&<p>This owner account is protected. Role and account changes are unavailable.</p>}
    <fieldset disabled={busy||protectedAccount||deleted} className="min-w-0 space-y-4">
      {section==='projects'&&<>{input('title','Project title',false,240)}{input('slug','Slug',false,240)}{input('excerpt','Summary',true)}{input('href','External link',false,2048)}
        <label className="block">Display order<input type="number" min={0} max={100000} value={Number(data.idx)} onChange={e=>set('idx',Number(e.target.value))} className="ml-3 rounded border border-border bg-background p-3"/></label>
        <label className="block">Technology tags<input value={(data.technologies as string[]).join(', ')} onChange={e=>set('technologies',e.target.value.split(',').map(v=>v.trim()).filter(Boolean))} className="mt-1 w-full rounded border border-border bg-background p-3"/></label>
        <label className="block">Publication<select value={String(data.publication_state)} onChange={e=>set('publication_state',e.target.value)} className="ml-3 rounded border border-border bg-background p-3">{['draft','published','archived'].map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="block">Visibility<select value={String(data.visibility)} onChange={e=>set('visibility',e.target.value)} className="ml-3 rounded border border-border bg-background p-3"><option>private</option><option>public</option></select></label>
        <Editor value={String(data.content)} onChange={value=>set('content',value)}/>
        <button type="button" onClick={()=>setPreview(!preview)} className="rounded border border-border p-3">{preview?'Hide project preview':'Preview project'}</button>
        {preview&&<section aria-label="Project preview" className="min-w-0 rounded border border-border p-4"><h2>{String(data.title)}</h2><BlogContent content={String(data.content)} media={[]}/></section>}
        <section aria-label="Project gallery" className="space-y-3">
          <h2>Existing project images</h2>
          {(data.media_ids as string[]).length === 0 ? <p>No images are attached to this project.</p> : <>
            <label className="block">Featured image<select aria-label="Featured project image" value={String(data.featured_media_id ?? '')} onChange={e=>set('featured_media_id',e.target.value || null)} className="mt-1 block w-full rounded border border-border bg-background p-3">
              <option value="">No featured image</option>{(data.media_ids as string[]).map((mediaId,index)=><option key={mediaId} value={mediaId}>Image {index+1}: {mediaId}</option>)}
            </select></label>
            <ol className="space-y-2">{(data.media_ids as string[]).map((mediaId,index)=><li key={mediaId} className="flex flex-wrap items-center gap-3 rounded border border-border p-3">
              <span className="min-w-0 break-all">Image {index+1}: {mediaId}</span>
              <button type="button" aria-label={`Move image ${index+1} up`} disabled={index===0} onClick={()=>{const ids=[...data.media_ids as string[]];[ids[index-1],ids[index]]=[ids[index],ids[index-1]];set('media_ids',ids);}}>Move up</button>
              <button type="button" aria-label={`Move image ${index+1} down`} disabled={index===(data.media_ids as string[]).length-1} onClick={()=>{const ids=[...data.media_ids as string[]];[ids[index+1],ids[index]]=[ids[index],ids[index+1]];set('media_ids',ids);}}>Move down</button>
            </li>)}</ol>
          </>}
          <p className="text-sm text-muted-foreground">Only images already attached to this project can be reordered or featured. Adding gallery objects requires the media-storage rollout.</p>
        </section>
      </>}
      {section==='users'&&<><p>No selected administrative roles means ordinary-member access. Owner assignment is not editable.</p>{[['content_admin','Content administrator'],['whitelist_manager','Audience administrator']].map(([role,label])=><label key={role} className="block"><input type="checkbox" checked={(data.roles as string[]).includes(role)} onChange={e=>set('roles',e.target.checked?[...data.roles as string[],role]:(data.roles as string[]).filter(value=>value!==role))}/> {label}</label>)}{['enabled','banned'].map(key=><label key={key} className="block"><input type="checkbox" checked={data[key]===true} onChange={e=>set(key,e.target.checked)}/> {key==='enabled'?'Account enabled':'Block account'}</label>)}</>}
      {section==='homepage'&&<>{input('title','Homepage title',false,120)}{input('description','Homepage description',true)}<label className="block"><input type="checkbox" checked={data.enabled===true} onChange={e=>set('enabled',e.target.checked)}/> Show homepage hero</label></>}
      {section==='settings'&&<>{input('title','Website title',false,120)}{input('description','SEO description',true,320)}{input('profile_name','Public profile name',false,120)}{input('bio','Public profile biography',true)}
        <div className="space-y-2"><h2>Social links</h2>{(data.social_links as Array<{label:string;href:string}>).map((link,index)=><div key={index} className="space-y-2 rounded border border-border p-3"><label className="block">Label<input value={link.label} onChange={e=>set('social_links',(data.social_links as typeof link[]).map((v,i)=>i===index?{...v,label:e.target.value}:v))} className="block w-full rounded border border-border bg-background p-2"/></label><label className="block">HTTPS URL<input value={link.href} onChange={e=>set('social_links',(data.social_links as typeof link[]).map((v,i)=>i===index?{...v,href:e.target.value}:v))} className="block w-full rounded border border-border bg-background p-2"/></label><button type="button" onClick={()=>set('social_links',(data.social_links as typeof link[]).filter((_,i)=>i!==index))}>Remove social link</button></div>)}<button type="button" disabled={(data.social_links as unknown[]).length>=12} onClick={()=>set('social_links',[...data.social_links as object[],{label:'',href:''}])} className="rounded border border-border p-3">Add social link</button></div>
      </>}
      {section==='navigation'&&<div className="space-y-3">{(data.items as Array<{label:string;href:string}>).map((link,index)=><div key={index} className="space-y-2 rounded border border-border p-3"><label className="block">Navigation label<input value={link.label} onChange={e=>set('items',(data.items as typeof link[]).map((v,i)=>i===index?{...v,label:e.target.value}:v))} className="block w-full rounded border border-border bg-background p-2"/></label><label className="block">Destination<select value={link.href} onChange={e=>set('items',(data.items as typeof link[]).map((v,i)=>i===index?{...v,href:e.target.value}:v))} className="block w-full rounded border border-border bg-background p-2">{publicDestinations.map(path=><option key={path}>{path}</option>)}</select></label><div className="flex flex-wrap gap-3"><button type="button" disabled={index===0} onClick={()=>{const items=[...data.items as typeof link[]];[items[index-1],items[index]]=[items[index],items[index-1]];set('items',items);}}>Move up</button><button type="button" disabled={index===(data.items as object[]).length-1} onClick={()=>{const items=[...data.items as typeof link[]];[items[index+1],items[index]]=[items[index],items[index+1]];set('items',items);}}>Move down</button><button type="button" onClick={()=>set('items',(data.items as typeof link[]).filter((_,i)=>i!==index))}>Remove link</button></div></div>)}<button type="button" disabled={(data.items as object[]).length>=12} onClick={()=>set('items',[...data.items as object[],{label:'New link',href:'/'}])} className="rounded border border-border p-3">Add navigation link</button><p className="text-sm text-muted-foreground">Admin navigation and account recovery links are independent of public navigation.</p></div>}
      {section==='appearance'&&<>
        <label className="block">Theme mode<select value={String(data.mode)} onChange={e=>set('mode',e.target.value)} className="ml-3 rounded border border-border bg-background p-3">{['light','dark','system'].map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="block">Typography<select value={String(data.font)} onChange={e=>set('font',e.target.value)} className="ml-3 rounded border border-border bg-background p-3">{['system','serif','mono'].map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="block">Reading size<input type="number" min={14} max={24} value={Number(data.reading_size)} onChange={e=>set('reading_size',Number(e.target.value))} className="ml-3 rounded border border-border bg-background p-3"/></label>
        {['light','dark'].map(theme=><section key={theme} className="space-y-3 rounded border border-border p-3"><h2 className="capitalize">{theme} palette</h2>{data[theme]===null?<><p>Canonical CSS tokens in use.</p><button type="button" onClick={()=>set(theme,canonicalPalette(theme))}>Customize palette</button></>:<>{Object.entries(data[theme] as Record<string,string>).map(([key,value])=><label key={key} className="block">{key.replaceAll('_',' ')}<input type="color" value={value} onChange={e=>set(theme,{...data[theme] as object,[key]:e.target.value})} className="ml-3"/></label>)}<button type="button" onClick={()=>set(theme,null)}>Restore canonical colors</button></>}</section>)}
      </>}
      <div className="flex flex-wrap gap-3"><button type="submit" className="rounded border border-border p-3">{isCreate?'Create project':configurations?'Save draft':'Save changes'}</button>{configurations&&<button type="button" className="rounded border border-border p-3" onClick={()=>void mutate('update','published')}>Publish configuration</button>}{section==='projects'&&!isCreate&&<button type="button" className="rounded border border-border p-3" onClick={()=>void mutate('delete')}>Delete project</button>}</div>
    </fieldset>
  </form>;
}
