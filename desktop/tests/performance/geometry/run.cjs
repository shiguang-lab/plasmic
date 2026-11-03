// Actual Studio + saved-project fixtures, isolated Chromium profile, no external writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {app,BrowserWindow,session,contentTracing}=require('electron');
const {createAssetHandler}=require('../../../src/asset-handler.cjs');
const {createProjectBackend}=require('../real-project-backend.cjs');
const [taskArg,fixtureArg,variant,runId,phase='timing']=process.argv.slice(2);
if(!taskArg||!fixtureArg||!['baseline','cached-js','cached-wasm'].includes(variant)||!runId)throw Error('task fixture variant runId [timing|profile|functional|memory|drag]');
const task=path.resolve(taskArg),fixture=path.resolve(fixtureArg),build=path.join(task,'build');
const read=name=>JSON.parse(fs.readFileSync(path.join(fixture,name)));
const opening=read('project-response.json'),startup=opening.startup;
const origin='https://plasmic-studio.shiguanglab.com',canvasOrigin='https://plasmic-canvas.shiguanglab.com';
const profile=path.join(task,'profiles',runId);fs.mkdirSync(profile,{recursive:true,mode:0o700});
app.setPath('userData',profile);app.setPath('sessionData',profile);app.setName('Geometry experiment');
app.userAgentFallback+=` PlasmicDesktop/${process.platform}`;
const report={variant,runId,phase,electron:process.versions.electron,chrome:process.versions.chrome,
  scope:'Frozen production-mode Studio; private saved-project fixture; native Electron input; rAF feedback proxy, not OS/compositor latency',
  fixtureSha256:crypto.createHash('sha256').update(opening.rev.data).digest('hex'),
  build:JSON.parse(fs.readFileSync(path.join(build,'desktop-assets.json'))).build,
  errors:[],blocked:[],inputs:[],memory:[]};
let win,frame,tracing=false,timer;const sessions=new Set();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,ms=60000){const end=Date.now()+ms;while(Date.now()<end){const x=await fn();if(x)return x;await pause(25);}throw Error('Timed out: '+label);}
const readyFrame=()=>until(async()=>{for(const f of win.webContents.mainFrame.framesInSubtree)try{if(await f.executeJavaScript('!!window.__geometry && !!window.studioCtx?.activeCanvasReady && !!window.studioCtx?.initialViewportReady'))return f;}catch{}},'Studio readiness');
const js=code=>frame.executeJavaScript(code);
const methods=(method,args=[])=>js(`__geometry.${method}(...${JSON.stringify(args)})`);
async function memory(label){
  const heaps=[],seen=new Set();
  for(const sid of [undefined,...sessions])try{
    const id=await win.webContents.debugger.sendCommand('Runtime.getIsolateId',{},sid);
    if(seen.has(id.id))continue;seen.add(id.id);
    heaps.push({isolate:id.id,...await win.webContents.debugger.sendCommand('Runtime.getHeapUsage',{},sid)});
  }catch{}
  const processes=app.getAppMetrics().map(p=>({pid:p.pid,type:p.type,rssKiB:p.memory.workingSetSize}));
  const out={label,heaps,processes};report.memory.push(out);return out;
}
async function input(){
  await methods('clear');
  const a=await methods('arm',[variant]),offset=await win.webContents.executeJavaScript(`(()=>{const e=document.querySelector('iframe');if(!e)return {x:0,y:0};const r=e.getBoundingClientRect();return {x:r.x,y:r.y}})()`);
  const point=p=>({x:Math.round(p.x+offset.x),y:Math.round(p.y+offset.y)});
  const start=point(a.start),end=point(a.end),wc=win.webContents;
  wc.sendInputEvent({type:'mouseMove',...start});wc.sendInputEvent({type:'mouseDown',...start,button:'left',clickCount:1});
  for(let k=1;k<=10;k++){
    wc.sendInputEvent({type:'mouseMove',x:Math.round(start.x+(end.x-start.x)*k/10),y:Math.round(start.y+(end.y-start.y)*k/10),button:'left',buttons:['left']});
    await pause(12);
  }
  wc.sendInputEvent({type:'mouseUp',...end,button:'left',clickCount:1});
  const result=await until(async()=>{const r=await methods('inputResult');return r?.id===a.id?r:undefined;},'native marquee',10000);
  if(result.error||result.changed||!result.trusted||result.query.length!==1)throw Error('Native input did not execute exactly one unchanged-model marquee: '+JSON.stringify(result));
  if(result.feedbackMs+2<result.query[0].totalMs)throw Error('Feedback measurement excluded the geometry query');
  if(result.selected.length!==result.query[0].selected)throw Error('Committed selection differs from queried selection');
  report.inputs.push(result);return result;
}
app.on('web-contents-created',(_,w)=>{
  w.on('console-message',event=>{if(event.level==='error')report.errors.push(event.message.slice(0,700));});
  w.on('will-prevent-unload',event=>event.preventDefault());
});
app.whenReady().then(async()=>{
  const ses=session.fromPartition('geometry-'+runId);
  ses.webRequest.onBeforeRequest({urls:['ws://*/*','wss://*/*']},(_,cb)=>cb({cancel:true}));
  const models={...read('model-resources.json'),...read('plume-resources.json')};
  const codes=new Map(Object.entries(read('code-resources.json')).map(([key,value])=>{const u=new URL(key);u.searchParams.sort();return [u.pathname+u.search,value];}));
  const backend=createProjectBackend({opening,startup,models,codes,plume:read('plume-opening.json'),report,phase:()=>phase,functional:true});
  const assets=createAssetHandler({root:build,studioOrigin:origin,canvasOrigin,remoteFetch:backend,previewHostPath:path.resolve(__dirname,'../../../src/preview-host.html')});
  ses.protocol.handle('https',assets);ses.protocol.handle('http',backend);
  win=new BrowserWindow({width:1512,height:887,show:true,webPreferences:{session:ses,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  if(['memory','profile'].includes(phase)){
    const d=win.webContents.debugger;d.attach('1.3');
    d.on('message',(_,method,p)=>{if(method==='Target.attachedToTarget'){
      sessions.add(p.sessionId);void d.sendCommand('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true},p.sessionId).catch(()=>{});
    }else if(method==='Target.detachedFromTarget')sessions.delete(p.sessionId);});
    await d.sendCommand('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true});
  }
  console.log('STAGE load');
  void win.loadURL(origin+'/projects/'+startup.projectId).catch(e=>{report.loadError=e.message;});
  frame=await readyFrame();
  console.log('STAGE ready');
  await js('studioCtx.awaitStudioReady()');await pause(500);
  if(phase==='timing'){
    await until(()=>js("studioCtx.loadTimings.has('all-frames-rendered')"),'all initial artboards rendered');
    report.allInitialFramesReady=true;
    await pause(300);
  }
  app.focus({steal:true});win.show();win.focus();win.webContents.focus();
  report.setup=await methods('setup',[Number(process.env.GEOMETRY_FRAME||0)]);
  console.log('STAGE setup '+JSON.stringify(report.setup));
  // Baseline and cached JS do not instantiate WASM during timed or memory runs.
  report.production=await js('!!__geometry.production');
  if(!report.production && (variant==='cached-wasm'||phase==='functional')){
    const bytes=[...fs.readFileSync(path.join(task,'kernel.wasm'))];
    await js(`__geometry.state.init(${JSON.stringify(bytes)})`);
    report.wasm=await js('({initMs:__geometry.state.initMs,bytes:__geometry.state.wasm.memory.buffer.byteLength})');
  }
  if(phase==='functional'){
    timer=setInterval(()=>{void js('window.__geometryStage').then(stage=>console.log('CASE '+stage));},5000);
    report.functional=await methods('functional');clearInterval(timer);
    if(report.production){
      const full=await require('../open-functional.cjs').run({frame,win,ready:readyFrame,preview:startup.projectId==='tk89W1Akg2HjAjyHAYEro7'});
      frame=full.frame;report.fullFunctional=full.result;
    }
  }
  else if(phase==='drag'){
    timer=setInterval(()=>{void js('window.__geometryStage').then(stage=>console.log('CASE '+stage));},5000);
    report.drag=await methods('dragQueries',[variant]);
    clearInterval(timer);
  }
  else if(phase==='memory'){
    let peak=0;timer=setInterval(()=>{peak=Math.max(peak,app.getAppMetrics().filter(p=>p.type==='Tab').reduce((s,p)=>s+p.memory.workingSetSize,0));},100);
    await memory('before');
    for(let i=0;i<3;i++){await methods('queries',[variant,80]);await memory('queries-'+i);}
    await pause(1000);await memory('settled');report.peakRendererRssKiB=peak;
    for(const sid of [undefined,...sessions])await win.webContents.debugger.sendCommand('HeapProfiler.collectGarbage',{},sid).catch(()=>{});
    await memory('diagnostic-gc');
  }else{
    if(phase==='profile'){
      await contentTracing.startRecording({included_categories:['toplevel','devtools.timeline','v8','blink.user_timing','disabled-by-default-v8.cpu_profiler'],excluded_categories:['*']});tracing=true;
      report.cpuSessions=[];
      for(const sid of [undefined,...sessions]){
        await win.webContents.debugger.sendCommand('Profiler.enable',{},sid);
        await win.webContents.debugger.sendCommand('Profiler.start',{},sid);
        report.cpuSessions.push(sid||'main');
      }
    }
    report.warmup=await methods('queries',[variant,8,false]);
    report.queries=await methods('queries',[variant,Number(process.env.GEOMETRY_QUERIES||32),phase==='profile']);
    for(let i=0;i<Number(process.env.GEOMETRY_INPUTS||12);i++){await input();await pause(40);}
    if(phase==='profile')for(const name of report.cpuSessions){
      const sid=name==='main'?undefined:name;
      const {profile:cpu}=await win.webContents.debugger.sendCommand('Profiler.stop',{},sid);
      fs.writeFileSync(path.join(task,runId+'-cpu-'+(sid||'main')+'.json'),JSON.stringify(cpu),{mode:0o600});
    }
  }
  fs.writeFileSync(path.join(task,runId+'.png'),await win.webContents.capturePage().then(image=>image.toPNG()));
}).catch(async error=>{
  report.error=error?.stack||String(error);console.error(report.error);process.exitCode=1;
  report.failureFrames=[];
  for(const f of win?.webContents.mainFrame.framesInSubtree||[])try{report.failureFrames.push(await f.executeJavaScript('({url:location.href,ctx:!!window.studioCtx,hook:!!window.__geometry,body:document.body?.innerText?.slice(0,700)})'));}catch{}
  if(win)fs.writeFileSync(path.join(task,runId+'-failed.png'),await win.webContents.capturePage().then(image=>image.toPNG()));
}).finally(async()=>{
  clearInterval(timer);if(tracing)await contentTracing.stopRecording(path.join(task,runId+'.trace.json'));
  fs.writeFileSync(path.join(task,runId+'.json'),JSON.stringify(report,null,2),{mode:0o600});
  console.log(JSON.stringify({runId,variant,phase,error:report.error,setup:report.setup,inputs:report.inputs.length,errors:report.errors.length}));
  win?.destroy();app.exit(process.exitCode||0);
});
setTimeout(()=>{report.error='Experiment timeout';fs.writeFileSync(path.join(task,runId+'.json'),JSON.stringify(report,null,2));app.exit(2);},240000);
