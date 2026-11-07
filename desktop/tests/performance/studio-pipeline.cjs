// Isolated diagnostic launch using an extracted installed, matching renderer. No release
// fuses/manifest are modified. Never publish snapshots or credentials.
const {app,BrowserWindow,contentTracing}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module');
const {monitorEventLoopDelay}=require('node:perf_hooks');
app.on('window-all-closed',()=>{});
const desktop=path.resolve(__dirname,'../..');
const sourceDesktop=process.env.PLASMIC_PERF_DESKTOP || desktop;
const traceEnabled=process.env.PLASMIC_PERF_TRACE!=='0';
const serializedTransport=process.argv[6]==='serialized';
const installed=process.argv[2],diagnosticProfile=process.argv[3],projectId=process.argv[4];
if(!installed||!diagnosticProfile||!projectId||!process.argv[5])throw Error('Required: extracted installed app directory, independently authenticated diagnostic profile, project id, report directory');
const profile=fs.realpathSync(diagnosticProfile),normalProfile=path.join(app.getPath('appData'),'Plasmic Desktop');
if(fs.existsSync(normalProfile)&&profile===fs.realpathSync(normalProfile))throw Error('Diagnostics must not use the normal App profile. Sign in separately with PLASMIC_DESKTOP_PROFILE first; never copy credentials.');
app.setName('Plasmic');app.setPath('userData',profile);app.setPath('sessionData',profile);
if(!app.requestSingleInstanceLock()){app.quit();return;}
const out=path.resolve(process.argv[5]);
fs.mkdirSync(out,{recursive:true,mode:0o700});
const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'plasmic-pipeline-'))),root=path.join(temporary,'desktop');
fs.mkdirSync(root);
fs.cpSync(path.join(sourceDesktop,'src'),path.join(root,'src'),{recursive:true});
for(const name of ['package.json','desktop.config.json'])fs.copyFileSync(path.join(sourceDesktop,name),path.join(root,name));
for(const name of ['renderer','assets'])fs.cpSync(path.join(installed,name),path.join(root,name),{recursive:true});
fs.symlinkSync(path.join(desktop,'node_modules'),path.join(root,'node_modules'));
const config=JSON.parse(fs.readFileSync(path.join(root,'desktop.config.json')));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'renderer/desktop-assets.json')));
if(config.webImage!==manifest.webImage)throw Error('Installed renderer must match current config; do not fabricate manifest');
const target=JSON.parse(fs.readFileSync(path.join(profile,'workspace.json'))).find(p=>new URL(p.url).pathname==='/projects/'+projectId);
if(!target)throw Error('Project must already be present in workspace');
fs.writeFileSync(path.join(profile,'workspace-route.json'),JSON.stringify(target.url));
const report={traceEnabled,serializedTransport,scope:'Current desktop source with unmodified installed renderer; renderer fixes are not included. Automatic server save disabled; project writes blocked.',build:manifest.build,resources:[],drafts:[],blockedWrites:[],errors:[],samples:[]};
let lastStore,lastScope,lastDraft;
let controller,win,phase='startup',recording=false;
const spans=[];
const span=(name,start,extra={})=>{if(recording)spans.push({phase,name,startMs:start,durationMs:performance.now()-start,...extra})};
const originalLoad=Module._load;
Module._load=function(name,parent,...args){const value=originalLoad.call(this,name,parent,...args);
 if(parent?.filename===path.join(root,'src/main.cjs')){
  if(name==='./controller.cjs')return {...value,DesktopController:class extends value.DesktopController{constructor(...args){super(...args);controller=this}}};
  if(name==='./asset-handler.cjs')return {...value,createAssetHandler:opts=>{const handler=value.createAssetHandler(opts);return request=>{
   if(!['GET','HEAD','OPTIONS'].includes(request.method)&&/^\/api\/v1\/projects\//.test(new URL(request.url).pathname)){report.blockedWrites.push({phase,method:request.method});return Response.json({error:'Diagnostic blocks project writes'},{status:409})}return handler(request)}}};
  if(name==='./library-cache.cjs')return {...value,LibraryCache:class extends value.LibraryCache{
   constructor(opts){super(opts);const read=this.store.read.bind(this.store);this.store.read=async(...args)=>{const start=performance.now();const result=await read(...args);span('cache.diskReadValidate',start,{kind:args[1],bytes:result?.body?.byteLength||0});return result};}
   async fetch(request){const start=performance.now();const result=await super.fetch(request);if(recording&&/dependency-models|hostless-libraries/.test(request.url))report.resources.push({phase,url:request.url,startMs:start,durationMs:performance.now()-start,hit:result.headers.get('X-Plasmic-Resource-Cache')});return result;}
  }};
  if(name==='./drafts.cjs')return {...value,DesktopDraftStore:class extends value.DesktopDraftStore{async write(scope,draft){const start=performance.now();await super.write(scope,draft);lastStore=this;lastScope=scope;lastDraft=draft instanceof Uint8Array?[...this.summaries.values()].at(-1)?.summary:draft;if(recording)report.drafts.push({phase,startMs:start,durationMs:performance.now()-start,dependencies:lastDraft.dependencies?.length})}}};
 }return value;};
const {startDesktop}=require(path.join(root,'src/main.cjs'));Module._load=originalLoad;
function bootstrap(){
 window.__pipeline={timeOrigin:performance.timeOrigin,longTasks:[],bundles:[],contents:[],writes:[],encodes:[]};
 new PerformanceObserver(list=>window.__pipeline.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
 let ctx;Object.defineProperty(window,'studioCtx',{configurable:true,get:()=>ctx,set:value=>{ctx=value;if(value)clearInterval(value.asyncSaverTimer)}});
}
app.on('web-contents-created',(_,w)=>{
 w.on('console-message',(event,...args)=>{const detail=typeof args[0]==='object'?args[0]:event;const level=detail.level??args[0];if(level==='error'||level===3)report.errors.push(String(detail.message??args[1]).slice(0,500))});
 w.on('will-prevent-unload',e=>e.preventDefault());const d=w.debugger;d.attach('1.3');
 const setup=async id=>{await d.sendCommand('Page.enable',{},id);await d.sendCommand('Page.addScriptToEvaluateOnNewDocument',{source:`(${bootstrap.toString()})()`},id);await d.sendCommand('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},id)};
 d.on('message',(_,method,params)=>{if(method==='Target.attachedToTarget')void(async()=>{try{if(['page','iframe'].includes(params.targetInfo.type))await setup(params.sessionId)}finally{await d.sendCommand('Runtime.runIfWaitingForDebugger',{},params.sessionId).catch(()=>{})}})().catch(e=>report.errors.push(e.message));});
 void setup().catch(e=>report.errors.push(e.message));
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function studio(){const deadline=Date.now()+90000;while(Date.now()<deadline){for(const f of win.webContents.mainFrame.framesInSubtree){try{if(await f.executeJavaScript('!!window.studioCtx?.activeCanvasReady && !!window.studioCtx?.initialViewportReady'))return f}catch{}}await sleep(100)}report.frameStatus=[];for(const f of win.webContents.mainFrame.framesInSubtree){try{report.frameStatus.push(await f.executeJavaScript('({url:location.href,ctx:!!window.studioCtx,body:document.body?.innerText?.slice(0,500),ready:window.studioCtx?.activeCanvasReady})'))}catch{}}throw Error('No ready Studio')}
async function sample(label,fn){phase=label;const delay=monitorEventLoopDelay({resolution:1});delay.enable();await sleep(30);delay.reset();const start=performance.now();await fn();await sleep(50);delay.disable();report.samples.push({phase,durationMs:performance.now()-start,eventLoop:{p95Ms:delay.percentile(95)/1e6,p99Ms:delay.percentile(99)/1e6,maxMs:delay.max/1e6},metrics:app.getAppMetrics().map(p=>({pid:p.pid,type:p.type,rssKiB:p.memory.workingSetSize}))});}
let tracing=false;
const watchdog=setTimeout(()=>{console.error('Diagnostic timeout');app.exit(2)},240000);
app.whenReady().then(async()=>{
 app.setActivationPolicy?.('accessory');win=await startDesktop();if(!controller)throw Error('Diagnostic main-module interception did not attach');win.setContentSize(1512,887);await win.loadURL(target.url);
 let frame=await studio();report.initial=await frame.executeJavaScript('({revision:studioCtx.dbCtx().revisionNum,counter:studioCtx._changeCounter,frames:studioCtx.viewCtxs.length})');
 if(traceEnabled)await contentTracing.startRecording({included_categories:['toplevel','v8','devtools.timeline','blink.user_timing','disabled-by-default-v8.cpu_profiler'],excluded_categories:['*']});tracing=traceEnabled;recording=true;
 // Named wrappers appear in V8 CPU samples; only diagnostic processes install them.
 const stringify=JSON.stringify,parse=JSON.parse;
 JSON.stringify=function DiagnosticJSONStringify(...args){const start=performance.now();let result;try{return result=stringify(...args)}finally{span('JSON.stringify',start,{chars:result?.length||0})}};
 JSON.parse=function DiagnosticJSONParse(...args){const start=performance.now();try{return parse(...args)}finally{span('JSON.parse',start,{chars:typeof args[0]==='string'?args[0].length:0})}};
 try{
 for(let i=0;i<3;i++)await sample('warm-reopen-'+i,async()=>{await win.loadURL('about:blank');await win.loadURL(target.url);frame=await studio();await sleep(300)});
 await frame.executeJavaScript(`(()=>{const s=studioCtx,d=s.desktopDraft;if(!d?.enabled)throw Error('Drafts unavailable');const b=s.bundler(),bundle=b.bundle;b.bundle=function DiagnosticProjectBundle(...args){const start=performance.now();try{return bundle.apply(this,args)}finally{__pipeline.bundles.push({project:args[0]===s.site,start,duration:performance.now()-start})}};const content=d.content;d.content=function DiagnosticDraftContent(){const start=performance.now();try{return content()}finally{__pipeline.contents.push({start,duration:performance.now()-start})}};d.dirty=()=>true;const api=d.api;d.api=new Proxy(api,{get(target,name){if(name!=='writeDesktopDraft')return Reflect.get(target,name);return async(...args)=>{const start=performance.now();try{if(${serializedTransport}){const encodeStart=performance.now();args[1]=JSON.stringify(args[1]);__pipeline.encodes.push({duration:performance.now()-encodeStart,chars:args[1].length})}return await target.writeDesktopDraft(...args)}finally{__pipeline.writes.push({start,duration:performance.now()-start})}}}});})()`);
 for(let i=0;i<5;i++)await sample('draft-'+i,()=>frame.executeJavaScript(`(async()=>{studioCtx.desktopDraft.sequenceOffset++;performance.mark('diagnostic-draft-start-${i}');const start=performance.now();if(!await studioCtx.desktopDraft.flush())throw Error(studioCtx.desktopDraft.store.getState().status?.error||'Draft flush failed');return performance.now()-start})()`));
 report.frameProbes=[];for(const f of win.webContents.mainFrame.framesInSubtree){try{report.frameProbes.push(await f.executeJavaScript('({path:location.pathname,probe:window.__pipeline})'))}catch{}}
 report.renderer=await frame.executeJavaScript('({probe:__pipeline,revision:studioCtx.dbCtx().revisionNum,counter:studioCtx._changeCounter})');
 }finally{JSON.stringify=stringify;JSON.parse=parse;recording=false;}
 report.spans=spans;if(tracing)await contentTracing.stopRecording(path.join(out,'pipeline.trace.json'));tracing=false;
 const received = await frame.executeJavaScript('JSON.stringify({bundle:studioCtx.desktopDraft.checkpoint.bundle,dependencies:studioCtx.desktopDraft.checkpoint.dependencies})');
 const persistedValue=await lastStore.read(lastScope,lastDraft.id);
 const persisted=persistedValue instanceof Uint8Array?JSON.parse(Buffer.from(persistedValue).toString('utf8')):persistedValue;
 const {createHash}=require('node:crypto');const hash=s=>createHash('sha256').update(s).digest('hex');
 report.contentIntegrity={renderer:hash(received),disk:hash(JSON.stringify({bundle:persisted.bundle,dependencies:persisted.dependencies})),dependencies:persisted.dependencies.length,checkpoints:fs.readdirSync(lastStore.scope(lastScope)).filter(p=>p.endsWith('.json')||p.endsWith('.previous')).length};
 if(report.contentIntegrity.renderer!==report.contentIntegrity.disk)throw Error('Draft content changed across transport');
}).catch(e=>{report.error=e.stack;console.error(e);process.exitCode=1}).finally(async()=>{
 if(tracing)await contentTracing.stopRecording(path.join(out,'pipeline.trace.json')).catch(()=>{});
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2));clearTimeout(watchdog);
 for(const w of BrowserWindow.getAllWindows())w.destroy();fs.rmSync(temporary,{recursive:true,force:true});app.exit(process.exitCode||0);
});
