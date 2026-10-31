import { promises as fs } from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';
import { createHash } from 'crypto';
import { loadConfig } from '@/wab/server/config';
import { ensureDbConnection } from '@/wab/server/db/DbCon';
import { DbMgr, SUPER_USER } from '@/wab/server/db/DbMgr';
import { getEditorBootstrap as baselineBootstrap } from '@/wab/server/routes/editor-bootstrap-baseline';
import { getProjectRev as baselineProject } from '@/wab/server/routes/projects-baseline';
import { getProjectRev } from '@/wab/server/routes/projects';
import { getDependencyModelResource, withDependencyModelResources } from '@/wab/server/routes/dependency-model-resources';
import { DEVFLAGS } from '@/wab/shared/devflags';
const { LibraryCache } = require('/bench/library-cache.cjs');
const { LibraryCache: BaselineCache } = require('/bench/library-cache-baseline.cjs');
const fingerprint=(v:any)=>JSON.stringify({rev:v.rev.id,deps:v.depPkgs.map((p:any)=>[p.id,createHash('sha256').update(JSON.stringify(p.model)).digest('hex')])});
const percentile=(xs:number[],q:number)=>[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.ceil(xs.length*q)-1)];
async function main(){
 const config=loadConfig();
 if(new URL(config.databaseUri).pathname!=='/plasmic_resource_benchmark')throw new Error('Use the disposable clone plasmic_resource_benchmark');
 if(!process.argv[2])throw new Error('Pass benchmark account email');
 const con=await ensureDbConnection(config.databaseUri,'default');
 await con.runMigrations({transaction:'all'});
 const sudo=new DbMgr(con.manager,SUPER_USER), user=await sudo.getUserByEmail(process.argv[2]);
 if(!user)throw new Error('Missing account');
 const flags={...DEVFLAGS,...JSON.parse((await sudo.tryGetDevFlagOverrides())?.data??'{}')};
 const projects=await con.query(`SELECT id,name FROM project WHERE "deletedAt" IS NULL AND (id=$1 OR name LIKE $2) ORDER BY name`,['145nN6S5QQBwgjtNUwuiQZ','%GP评论查询%']);
 const temp='/tmp/resource-startup-'+Date.now(),origin='https://benchmark.invalid';
 const counts=async()=>(await con.query('SELECT (SELECT count(*) FROM project) AS projects,(SELECT count(*) FROM project_revision) AS revisions'))[0];
 async function invoke(handler:Function,params:object,query:object,body:object,method:string,requestPath:string,hint?:string|null){
  const start=performance.now();let raw='',headers:any={};
  const run = async (em?: any) => {
   const req:any={params,query,body,method,path:requestPath,headers:{},cookies:{},con,noTxMgr:con.manager,txMgr:em,user,devflags:flags,config,shiguangIdentity:{roles:[]},promLabels:{},analytics:{track(){}},get:()=>hint};
   const res:any={setHeader(k:string,v:string){headers[k]=v},append(k:string,v:string){headers[k]=[headers[k],v].filter(Boolean).join(',')},vary(){},json(v:any){raw=JSON.stringify(v)},send(v:string){raw=v}};
   const active = handler === getProjectRev ? withDependencyModelResources(getProjectRev) : handler;
   await active(req,res,(error:unknown)=>{ throw error; });
  };
  if (handler === getProjectRev) await run();
  else await con.transaction(run);
  return{ms:performance.now()-start,raw,headers};
 }
 const report:any={scope:'Disposable PostgreSQL clone of current NAS data. Exact 0.5.27 two-request baseline vs current single-opening-GET source; both real disk caches and response reconstruction. No production schema or project changes. Simulated loopback transport excludes WAN/TLS and GUI rendering; ms includes gzip measurement, JSON, cache IO and checksums.',before:await counts(),projects:[]};
 try{
  for(const project of projects){
   let network:any[]=[];
   const identity={epoch:0,value:{user:{id:user.id}},async read(){return this.value}};
   const options=(baseline:boolean)=>({directory:path.join(temp,baseline?'baseline':'current',project.id),studioOrigin:origin,buildId:'benchmark',identity,remoteFetch:async(request:Request)=>{
    const url=new URL(request.url),isBootstrap=url.pathname.includes('/editor-bootstrap/'),isResource=url.pathname.includes('/dependency-models/');
    const handler=isBootstrap?baselineBootstrap:isResource?getDependencyModelResource:(baseline?baselineProject:getProjectRev);
    const params=isBootstrap?{projectId:project.id}:isResource?{resourceId:url.pathname.split('/').at(-1)}:{projectBranchId:project.id};
    const body=request.method==='POST'?await request.clone().json():{};
    const result=await invoke(handler,params,Object.fromEntries(url.searchParams),body,request.method,url.pathname,request.headers.get('X-Plasmic-Model-Cache'));
    network.push({path:url.pathname,method:request.method,ms:result.ms,requestBodyBytes:request.method==='POST'?Buffer.byteLength(JSON.stringify(body)):0,jsonBytes:Buffer.byteLength(result.raw),gzipBytes:gzipSync(result.raw).length,isResource});
    return new Response(result.raw,{headers:{'Content-Type':'application/json',...result.headers}});
   }});
   let expected:string|undefined;
   async function load(baseline:boolean,mode:'cold'|'warm'|'partial'){
    const opts=options(baseline),Cache=baseline?BaselineCache:LibraryCache;
    if(mode==='cold')await fs.rm(opts.directory,{recursive:true,force:true});
    const cache=new Cache(opts);
    if(mode==='partial'){
     const entries=(await (baseline?cache:cache.store).files()).filter((v:any)=>path.basename(v.file).startsWith(baseline?'model-':'model-resource-')).sort((a:any,b:any)=>b.bytes-a.bytes);
     if(!entries.length)throw new Error('No model to evict');
     await fs.rm(entries[0].file);
    }
    network=[];const start=performance.now();
    if(baseline) {
     const boot=await(await cache.fetch(new Request(origin+'/api/v1/editor-bootstrap/'+project.id+'?branchName=%22main%22'))).json();
     if(boot.projectModel)throw new Error('Baseline bootstrap unexpectedly contains a model');
    }
    const model:any=await(await cache.fetch(new Request(origin+'/api/v1/projects/'+project.id+(baseline?'':'?includeStartup=true&branchName=%22main%22')))).json();
    const entryMs=performance.now()-start;
    if(!baseline && (model.startup?.projectId!==project.id || model.startup.projectData.projects[0]?.id!==project.id))throw new Error('Missing merged startup context');
    if(!baseline){
     await Promise.all(model.depPkgs.map(async(pkg:any)=>{
      if(!pkg.modelResourceId)throw new Error('Missing resource identity');
      const response=await cache.fetch(new Request(origin+'/api/v1/dependency-models/'+pkg.modelResourceId));
      if(!response.ok)throw new Error('Resource GET failed '+response.status);
      pkg.model=await response.json();delete pkg.modelResourceId;
     }));
     if(network.some(v=>v.method!=='GET'||v.requestBodyBytes))throw new Error('New chain must never upload inventory or use POST');
    }
    const hash=fingerprint(model);if(baseline)expected=hash;else if(expected!==hash)throw new Error('Model differs from baseline');
    return{ms:performance.now()-start,serverWorkMs:network.reduce((a,b)=>a+b.ms,0),entryMs,requests:network.length,modelResourceRequests:network.filter(v=>v.isResource).length,uploadBytes:network.reduce((a,b)=>a+b.requestBodyBytes,0),jsonBytes:network.reduce((a,b)=>a+b.jsonBytes,0),gzipBytes:network.reduce((a,b)=>a+b.gzipBytes,0),revision:model.rev.revision,dependencyCount:model.depPkgs.length};
   }
   const resourceCount=async()=>Number((await con.query('SELECT count(*) AS n FROM dependency_model_resource'))[0].n);
   await load(true,'cold');const before=await resourceCount();
   const preparation=await load(false,'cold'),prepared=await resourceCount();
   const samples:any={baselineCold:[],baselineWarm:[],baselinePartial:[],newCold:[],newWarm:[],newPartial:[]};
   for(let i=0;i<7;i++){
    for(const baseline of i%2?[false,true]:[true,false])for(const [mode,suffix] of [['cold','Cold'],['warm','Warm'],['partial','Partial']] as const)samples[(baseline?'baseline':'new')+suffix].push(await load(baseline,mode));
   }
   const summary:any={};for(const[label,values]of Object.entries(samples)as[string,any[]][])summary[label]=Object.fromEntries(['ms','serverWorkMs','entryMs','requests','modelResourceRequests','uploadBytes','jsonBytes','gzipBytes'].map(k=>[k,{median:percentile(values.map(v=>v[k]),.5),p95:percentile(values.map(v=>v[k]),.95)}]));
   report.projects.push({id:project.id,name:project.name,preparation:{...preparation,createdResources:prepared-before},samples,summary});
  }
  report.after=await counts();report.completedAt=new Date().toISOString();
  await fs.writeFile('/bench/result.json',JSON.stringify(report,null,2));
  console.log('RESOURCE BENCHMARK COMPLETE '+JSON.stringify(report.projects.map((p:any)=>({name:p.name,summary:p.summary}))));
 }finally{await fs.rm(temp,{recursive:true,force:true});await con.close()}
}
main().then(()=>process.exit(0),e=>{console.error(e);process.exit(1)});
