const {app,contentTracing}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{createHash}=require('node:crypto');
const {monitorEventLoopDelay}=require('node:perf_hooks');
const {LibraryCache}=require(path.resolve(process.argv[2],'src/library-cache.cjs'));
const {resourceSpec}=require('@plasmic-shared/resource-cache');
const semver=require('semver');
const inventory=JSON.parse(fs.readFileSync(process.argv[3])),out=path.resolve(process.argv[4]);fs.mkdirSync(out,{recursive:true});
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'plasmic-cache-profile-'));app.setPath('userData',path.join(directory,'profile'));
const codes=new Map(),models=new Map();
for(const entry of inventory){if(entry.key.startsWith('/api/v1/hostless-libraries/')){const url=new URL(entry.key,'https://fixture.test'),name=url.pathname.split('/')[4];if(!codes.has(name)||semver.gt(url.searchParams.get('version'),new URL(codes.get(name).key,'https://fixture.test').searchParams.get('version')))codes.set(name,entry)}else if(entry.key.startsWith('/api/v1/dependency-models/'))models.set(entry.key,entry)}
const selected=[...codes.values(),...[...models.values()].sort((a,b)=>b.diskBytes-a.diskBytes).slice(0,5)];
const identity={epoch:0,value:{user:{id:'diagnostic'}},read:async()=>identity.value};
const scope={origin:'https://fixture.test',userId:'diagnostic',buildId:'diagnostic',epoch:0};let misses=0;
const cache=new LibraryCache({directory:path.join(directory,'cache'),studioOrigin:scope.origin,buildId:scope.buildId,identity,remoteFetch:()=>{misses++;throw Error('Unexpected network request')}});
const report={resources:[],samples:[],spans:[]};let recording=false;
const digest=b=>createHash('sha256').update(b).digest('hex'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const span=(name,start,extra={})=>{if(recording)report.spans.push({name,startMs:start,durationMs:performance.now()-start,...extra})};
app.whenReady().then(async()=>{
 for(const entry of selected){const stored=JSON.parse(fs.readFileSync(entry.file,'utf8')),body=Buffer.from(stored.body,'base64'),spec=resourceSpec(new Request(scope.origin+entry.key),scope.origin);await cache.store.write(scope,spec.kind,spec.key,body,stored.headers,()=>{});report.resources.push({key:entry.key,bodyBytes:body.length,sha256:digest(body)});}
 const originalRead=cache.store.read.bind(cache.store);cache.store.read=async(...args)=>{const start=performance.now();const r=await originalRead(...args);span('store.read',start,{kind:args[1],bodyBytes:r?.body?.length});return r};
 const parse=JSON.parse,stringify=JSON.stringify,from=Buffer.from;
 await contentTracing.startRecording({included_categories:['toplevel','v8','disabled-by-default-v8.cpu_profiler'],excluded_categories:['*']});
 JSON.parse=function DiagnosticJSONParse(...args){const t=performance.now();try{return parse(...args)}finally{span('JSON.parse',t)}};
 JSON.stringify=function DiagnosticJSONStringify(...args){const t=performance.now();try{return stringify(...args)}finally{span('JSON.stringify',t)}};
 Buffer.from=function DiagnosticBufferFrom(...args){const t=performance.now();try{return from.apply(this,args)}finally{if(args[1]==='base64')span('base64.decode',t)}};
 try{
 for(const parallel of [false,true])for(let i=0;i<6;i++){
 const delay=monitorEventLoopDelay({resolution:1});delay.enable();await sleep(20);delay.reset();recording=true;
 const start=performance.now();const fetchEntry=async entry=>{const response=await cache.fetch(new Request(scope.origin+entry.key));const bytes=Buffer.from(await response.arrayBuffer());if(response.headers.get('X-Plasmic-Resource-Cache')!=='hit'||digest(bytes)!==report.resources.find(r=>r.key===entry.key).sha256)throw Error('Resource drift')};
 if(parallel)await Promise.all(selected.map(fetchEntry));else for(const entry of selected)await fetchEntry(entry);
 const durationMs=performance.now()-start;recording=false;await sleep(20);delay.disable();report.samples.push({parallel,iteration:i,durationMs,eventLoop:{p95Ms:delay.percentile(95)/1e6,p99Ms:delay.percentile(99)/1e6,maxMs:delay.max/1e6}});
 }
 }finally{JSON.parse=parse;JSON.stringify=stringify;Buffer.from=from;recording=false;}
 await contentTracing.stopRecording(path.join(out,'cache.trace.json'));report.misses=misses;
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.samples));
}).catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{fs.rmSync(directory,{recursive:true,force:true});app.exit(process.exitCode||0)});
