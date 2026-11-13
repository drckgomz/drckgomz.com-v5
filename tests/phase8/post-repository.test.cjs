/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture(existing,available=true){
  const observed={};const posts=new Proxy({}, {get:(_,name)=>String(name)});
  const sql=(parts,...values)=>({parts,values});
  const tx={execute:async()=>({rows:[{available}]}),update:()=>({set:patch=>{observed.patch=patch;return{where:condition=>{observed.condition=condition;return{returning:async()=>[]};}};}}),select:()=>({from:()=>({where:()=>({limit:async()=>existing?[existing]:[]})})})};
  const imports={'server-only':{},'drizzle-orm':{sql,and:(...args)=>({and:args}),eq:(left,right)=>({eq:[left,right]}),isNull:column=>({isNull:column})},'@/lib/db/schema':{posts,media:{}},'@/lib/db/owner-session':{withCurrentOwnerSession:async run=>run(tx)},'@/lib/blog/content.server':{},'@/lib/blog/legacy-media-preview':{}};
  const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/db/repositories/admin-posts.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:name=>{if(!(name in imports))throw Error(name);return imports[name];}});
  return{repo:mod.exports,observed};
}
test('repository conditionally rejects recovered content in the same update as revision validation',async()=>{
  const f=fixture({id:'historical',legacyStatus:'draft'});
  assert.equal((await f.repo.updateOwnerPostText({slug:'historical',expectedRevision:37,content:'replacement'})).kind,'legacy-protected');
  assert.ok(f.observed.condition.and.some(value=>value?.isNull==='legacyStatus'));
  assert.ok(f.observed.condition.and.some(value=>value?.eq?.[0]==='revision'&&value.eq[1]===37));
});
test('metadata-only repository updates preserve source and do not write publication or URL fields',async()=>{
  const f=fixture({id:'synthetic',legacyStatus:null});
  assert.equal((await f.repo.updateOwnerPostText({slug:'synthetic',expectedRevision:2,excerpt:'Summary',date:null})).kind,'conflict');
  assert.equal(f.observed.patch.excerpt,'Summary');assert.equal(f.observed.patch.date,null);
  assert.equal(JSON.stringify(Object.keys(f.observed.patch).sort()),JSON.stringify(['date','excerpt','revision','updatedAt']));
});
test('repository distinguishes missing rows from optimistic conflicts',async()=>{
  const f=fixture(null);assert.equal((await f.repo.updateOwnerPostText({slug:'synthetic',expectedRevision:1,title:'Title'})).kind,'missing');
});
test('metadata readiness requires a positive database privilege result',async()=>{
  assert.equal(await fixture(null,true).repo.postMetadataAvailable(),true);
  assert.equal(await fixture(null,false).repo.postMetadataAvailable(),false);
});
