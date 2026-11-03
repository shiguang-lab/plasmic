// Diagnostic replay of an unchanged real project and its exact dependencies.
// All network requests terminate in private fixtures. Never pass a normal profile.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { app, BrowserWindow, session, contentTracing, ipcMain, webContents } = require("electron");
const { StudioWindow } = require("../../src/studio-window.cjs");
const isolatedSessions = process.env.PERF_OPEN_SESSIONS === "1";
const { LibraryCache } = require("../../src/library-cache.cjs");
const { createAssetHandler } = require("../../src/asset-handler.cjs");
const { createDashboardPreviews } = require("../../src/dashboard-preview.cjs");
const task = path.resolve(process.argv[2]);
const mode = process.argv[3] || "timing";
const buildRoot = process.env.PERF_BUILD_ROOT || path.join(task,"build-installed");
const opens = Number(process.env.PERF_OPENS || 4);
const profileKey=process.env.PERF_PROFILE_KEY || mode;
const debuggerEnabled=process.env.PERF_NO_DEBUG!=="1";
const sparePolicy = process.env.PERF_SPARE_POLICY;
const spareArguments = process.env.PERF_SPARE_ARGUMENTS || "compatible";
if (sparePolicy) {
  if (!["off", "on"].includes(sparePolicy) || !["production", "compatible"].includes(spareArguments)) throw Error("Invalid spare-renderer diagnostic policy");
  if (!isolatedSessions || debuggerEnabled) throw Error("Spare-renderer comparison requires isolated sessions without debugger");
  app.commandLine.appendSwitch(sparePolicy === "on" ? "enable-features" : "disable-features", "SpareRendererForSitePerProcess");
}
const cachePolicy = process.env.PERF_V8_CACHE || "code";
if (!["code", "bypassHeatCheck"].includes(cachePolicy)) throw Error("Invalid diagnostic V8 policy");
const origin = "https://plasmic-studio.shiguanglab.com";
const canvasOrigin = "https://plasmic-canvas.shiguanglab.com";
const read = name => JSON.parse(fs.readFileSync(path.join(task, name)));
const opening = read("project-response.json"), startup = opening.startup;
const dataset = fs.existsSync(path.join(task,"dataset.json")) ? read("dataset.json") : {kind:"saved-project",revision:opening.rev.revision};
const models = { ...read("model-resources.json"), ...read("plume-resources.json") };
const plume = read("plume-opening.json");
const canonical = value => {
  const u = new URL(value, origin);
  u.searchParams.sort();
  return u.pathname + u.search;
};
const codes = new Map(Object.entries(read("code-resources.json")).map(([k,v]) => [canonical(k), v]));
const hash = value => createHash("sha256").update(value).digest("hex");
const projectBundle = JSON.parse(opening.rev.data);
for (const pkg of opening.depPkgs) {
  const resource = "/api/v1/dependency-models/" + pkg.modelResourceId;
  if (!models[resource]) throw Error("Missing exact dependency: " + resource);
}
const report = {
  scope: "Real saved project, exact immutable dependencies, explicitly selected renderer; offline fixture replay from native dashboard card click. Excludes live API/auth latency, native draft bridge, sockets and business endpoints.",
  mode, dataset, cachePolicy, debuggerEnabled, build: JSON.parse(fs.readFileSync(path.join(buildRoot,"desktop-assets.json"))),
  project: { id: startup.projectId, name: opening.project.name, revision: opening.rev.revision, objects: Object.keys(projectBundle.map).length, sha256: hash(opening.rev.data), dependencies: opening.depPkgs.map(p => ({ id:p.id, version:p.version, resource:"/api/v1/dependency-models/"+p.modelResourceId, sha256:hash(models["/api/v1/dependency-models/"+p.modelResourceId].body) })) },
  requests: [], resources: [], samples: [], errors: [], blocked: [], previewErrors: []
};
if (sparePolicy) report.spareRenderer = {policy:sparePolicy,arguments:spareArguments,electron:process.versions.electron};
const now = () => performance.timeOrigin + performance.now();
const firstFrames=new Map();
let phase = "dashboard-bootstrap", win, tracing = false, previews, memoryTimer, nativeBridge;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
app.setName("Plasmic real-project diagnostic");
app.userAgentFallback = `${app.userAgentFallback} PlasmicDesktop/${process.platform}`;
app.setPath("userData", path.join(task, "profile-" + profileKey));
app.on("window-all-closed", () => {});
ipcMain.on("desktop:preview-host-error", (_event,message) => report.previewErrors.push({phase,message:String(message)}));
function bootstrap(countStyles) {
  window.__openProbe = { longTasks: [], paints: [] };
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      const skeleton = document.getElementById("studio-startup-loading");
      const style = skeleton && getComputedStyle(skeleton);
      __openProbe.paints.push({name:entry.name,start:entry.startTime,skeletonVisible:!!style && style.display!=="none" && style.visibility!=="hidden" && Number(style.opacity)!==0});
    }
  }).observe({type:"paint",buffered:true});
  if (countStyles) {
    const getStyle = window.getComputedStyle;
    __openProbe.computedStyles = 0;
    window.getComputedStyle = function (...args) { __openProbe.computedStyles++; return getStyle.apply(this, args); };
  }
  new PerformanceObserver(list => __openProbe.longTasks.push(...list.getEntries().map(e => ({ start:e.startTime, duration:e.duration })))).observe({type:"longtask",buffered:true});
}
app.on("web-contents-created", (_, contents) => {
  if(process.env.PERF_PRESENTATION === "1") {
    let capturing=false;
    const timer=setInterval(async()=>{
      if(capturing || contents.isDestroyed() || !contents.getURL().startsWith(origin+"/projects/"))return;
      capturing=true;
      try {
        const image=await contents.capturePage(),size=image.getSize(),bytes=image.toBitmap();
        let reference,distinct=false;
        for(let y=24;y<size.height-24&&!distinct;y+=Math.max(1,Math.floor(size.height/16))) {
          for(let x=24;x<size.width-24;x+=Math.max(1,Math.floor(size.width/16))) {
            const value=bytes.readUInt32LE((y*size.width+x)*4);
            if(reference===undefined)reference=value;
            else if(value!==reference){distinct=true;break;}
          }
        }
        if(distinct){
          firstFrames.set(contents.id,{at:now(),width:size.width,height:size.height});
          fs.writeFileSync(path.join(task,"first-frame-"+mode+"-"+contents.id+".png"),image.toPNG());
          clearInterval(timer);
        }
      } catch(error) {if(!contents.isDestroyed())report.errors.push(error.message);}
      finally {capturing=false;}
    },50);
    contents.once("destroyed",()=>clearInterval(timer));
  }
  contents.on("console-message", event => {
    if (event.level === "error") report.errors.push(event.message.slice(0,800));
  });
  contents.on("will-prevent-unload", event => event.preventDefault());
  if(!debuggerEnabled)return;
  const debug = contents.debugger;
  debug.attach("1.3");
  const setup = async id => {
    await debug.sendCommand("Page.enable", {}, id);
    await debug.sendCommand("Page.addScriptToEvaluateOnNewDocument", {source:`(${bootstrap.toString()})(${process.env.PERF_OPEN_COUNT_STYLES === '1'})`}, id);
    await debug.sendCommand("Target.setAutoAttach", {autoAttach:true,waitForDebuggerOnStart:true,flatten:true}, id);
  };
  debug.on("message", (_, method, params) => {
    if (method === "Target.attachedToTarget") void (async () => {
      try { if (["page","iframe"].includes(params.targetInfo.type)) await setup(params.sessionId); }
      finally { await debug.sendCommand("Runtime.runIfWaitingForDebugger", {}, params.sessionId).catch(()=>{}); }
    })().catch(e => report.errors.push(e.message));
  });
  void setup().catch(e => report.errors.push(e.message));
});
async function until(fn, description) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await sleep(process.env.PERF_RETURN_TIMING === "1" && description === "real dashboard card" ? 5 : 100);
  }
  report.timeoutFrames = [];
  for (const f of win.webContents.mainFrame.framesInSubtree) {
    try { report.timeoutFrames.push(await f.executeJavaScript("({url:location.href,body:document.body?.innerText?.slice(0,1500)})")); } catch {}
  }
  throw Error("Timeout: " + description);
}
async function memoryPoint(label, retiredPid, retiredFramePids = []) {
  const processes = app.getAppMetrics().map(p=>({pid:p.pid,type:p.type,rssKiB:p.memory.workingSetSize}));
  const sample = {label,rendererPid:win.webContents.getOSProcessId(),processes,
    heap:debuggerEnabled?await win.webContents.debugger.sendCommand("Runtime.getHeapUsage"):null,
    dom:debuggerEnabled?await win.webContents.debugger.sendCommand("Memory.getDOMCounters"):null};
  if (sparePolicy) {
    const owners = webContents.getAllWebContents().map(c=>({id:c.id,pid:c.getOSProcessId(),url:c.getURL()}));
    sample.ownedRendererPids = [...new Set(owners.map(c=>c.pid).filter(Boolean))];
    sample.unownedRenderers = processes.filter(p=>p.type === "Tab" && !sample.ownedRendererPids.includes(p.pid));
    sample.retiredFramePidsStillPresent = retiredFramePids.filter(pid=>processes.some(p=>p.pid===pid));
  }
  if (retiredPid && processes.some(p=>p.pid===retiredPid)) throw Error("Editor process survived return to dashboard");
  report.sessionMemory ??= [];report.sessionMemory.push(sample);
  console.log("SESSION_MEMORY "+JSON.stringify(sample));
}
async function dashboard() {
  return until(() => win.webContents.executeJavaScript(`(()=>{const e=[...document.querySelectorAll('[role="link"][aria-label]')].find(e=>e.getAttribute('aria-label').endsWith(${JSON.stringify(": " + opening.project.name)}));return e && {label:e.getAttribute('aria-label'),rect:JSON.stringify(e.getBoundingClientRect())}})()`), "real dashboard card");
}
async function ready() {
  return until(async () => {
    for (const f of win.webContents.mainFrame.framesInSubtree) {
      try { if (await f.executeJavaScript("!!window.studioCtx?.activeCanvasReady && !!window.studioCtx?.initialViewportReady")) return f; } catch {}
    }
  }, "canvas and viewport ready");
}
app.whenReady().then(async () => {
  app.setActivationPolicy?.(process.env.PERF_RETURN_TIMING === "1" ? "regular" : "accessory");
  if (process.env.PERF_OPEN_MEMORY) {
    report.memoryProbe={peakRssKiB:0,afterReturn:[]};
    memoryTimer=setInterval(()=>{const rss=app.getAppMetrics().reduce((sum,p)=>sum+p.memory.workingSetSize,0);report.memoryProbe.peakRssKiB=Math.max(report.memoryProbe.peakRssKiB,rss);report.memoryProbe.openPeakRssKiB=Math.max(report.memoryProbe.openPeakRssKiB??0,rss)},100);
  }
  const ses = session.fromPartition((process.env.PERF_PERSIST_CACHE === "1" ? "persist:" : "") + "real-project-" + profileKey);
  ses.webRequest.onBeforeRequest({urls:["ws://*/*","wss://*/*"]}, (_, cb) => cb({cancel:true}));
  const backend = require('./real-project-backend.cjs').createProjectBackend({opening,startup,models,codes,plume,report,phase:()=>phase,functional:process.env.PERF_OPEN_FUNCTIONAL==='1'});
  const identity = {epoch:0,value:startup.selfInfo,async read(){return this.value}};
  const cache = new LibraryCache({directory:path.join(task,"library-cache-"+mode),studioOrigin:origin,buildId:report.build.build.rendererHash,identity,remoteFetch:backend});
  const diskRead = cache.store.read.bind(cache.store);
  cache.store.read = async (...args) => {
    const start = now(), result = await diskRead(...args);
    report.resources.push({phase,kind:"disk",key:args[2],start,duration:now()-start,hit:!!result,bytes:result?.body.length||0});
    return result;
  };
  const remoteFetch = async request => {
    const start = now(), currentPhase = phase, response = await cache.fetch(request);
    report.requests.push({phase:currentPhase,path:canonical(request.url),start,duration:now()-start,hit:response.headers.get("X-Plasmic-Resource-Cache"),status:response.status});
    return response;
  };
  ses.protocol.handle("http", remoteFetch);
  const assets=createAssetHandler({root:buildRoot,studioOrigin:origin,canvasOrigin,remoteFetch,previewHostPath:path.resolve(__dirname,"../../src/preview-host.html")});
  ses.protocol.handle("https",async request=>{
    const response=await assets(request);
    if(debuggerEnabled||!response.headers.get("Content-Type")?.startsWith("text/html"))return response;
    const headers=new Headers(response.headers);headers.delete("Content-Length");
    const html=(await response.text()).replace(/<head[^>]*>/i,head=>head+`<script>(${bootstrap.toString()})(false)</script>`);
    return new Response(html,{status:response.status,headers});
  });
  const preload = path.join(task,"preview-only-preload.cjs");
  if (process.env.PERF_OPEN_NATIVE) nativeBridge = await require('./open-native-bridge.cjs').install({task,mode,origin,startup,ipcMain,getWindow:()=>win,report});
  fs.writeFileSync(preload,`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('desktopPreview',{render:(...args)=>ipcRenderer.invoke('desktop:dashboard-preview',...args),cancel:id=>ipcRenderer.send('desktop:dashboard-preview-cancel',id)});${isolatedSessions ? "let active=true;const activeListeners=new Set();ipcRenderer.on('desktop:view-state',(_,state)=>{active=state.active;for(const listener of activeListeners)listener(state);});contextBridge.exposeInMainWorld('desktopNavigation',{navigate:url=>ipcRenderer.invoke('desktop:navigate',url),isActive:()=>active,onActiveChange:listener=>{activeListeners.add(listener);return()=>activeListeners.delete(listener);}});" : ''}${nativeBridge?.preload || ''}`);
  const webPreferences={session:ses,preload,v8CacheOptions:cachePolicy,contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,
    ...(sparePolicy && spareArguments === "production" ? {additionalArguments:[`--shiguang-system-languages=${JSON.stringify(app.getPreferredSystemLanguages())}`]} : {})};
  const nativeWindow = new BrowserWindow({width:1512,height:887,show:true,webPreferences:isolatedSessions?{session:ses,...(sparePolicy && spareArguments === "production" ? {additionalArguments:webPreferences.additionalArguments} : {})}:webPreferences});
  if(process.env.PERF_PERSIST_CACHE === "1" || process.env.PERF_RETURN_TIMING === "1") {app.focus({steal:true});nativeWindow.show();nativeWindow.focus();}
  win = isolatedSessions ? new StudioWindow(nativeWindow,{
    webPreferences,studioOrigin:origin,backgroundColor:"#eceef3",
    projectId:url=>new URL(url||"about:blank").pathname.match(/^\/projects\/([^/]+)/)?.[1],
    beforeNavigate:async()=>{
      for(const frame of win.webContents.mainFrame.framesInSubtree) {
        const protectedDraft=await frame.executeJavaScript("window.studioCtx?.desktopDraft ? studioCtx.desktopDraft.flush() : true");
        if(!protectedDraft) throw Error("Diagnostic draft backup failed");
      }
    }
  }):nativeWindow;
  if(isolatedSessions) ipcMain.handle("desktop:navigate",(event,url)=>{
    if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame)throw Error("Stale renderer navigation");
    return win.loadURL(url);
  });
  if(isolatedSessions) win.on("contents-deactivated",contents=>previews?.cancelFor(contents));
  previews = createDashboardPreviews({session:ses,studioOrigin:origin,trustedSender:event=>event.sender===win.webContents});
  await win.loadURL(origin+"/projects");
  report.card = await dashboard();
  const initialDashboard = win.webContents;
  const initialDashboardPid = initialDashboard.getOSProcessId();
  let activatedAt;
  if(isolatedSessions) win.on("contents-activated",()=>{activatedAt=now();});
  if(process.env.PERF_RETURN_TIMING === "1") {
    await initialDashboard.executeJavaScript(`(()=>{window.__retainedDashboardToken="retained";const e=document.querySelector('input[placeholder]');if(!e)throw Error('Missing Dashboard search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(opening.project.name)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await dashboard();
  }
  await sleep(1000);
  if (mode === "trace") {
    await contentTracing.startRecording({included_categories:["toplevel","v8","devtools.timeline","blink.user_timing","disabled-by-default-v8.cpu_profiler"],excluded_categories:["*"]});
    tracing = true;
  }
  if(isolatedSessions) await memoryPoint("cold-dashboard");
  for (let i=0;i<opens;i++) {
    if(report.memoryProbe) report.memoryProbe.openPeakRssKiB=0;
    if(process.env.PERF_RETURN_TIMING === "1") {app.focus({steal:true});nativeWindow.show();nativeWindow.focus();win.webContents.focus();}
    phase = i===0 ? "first-list-open" : "warm-list-open-"+i;
    const beforeOpenProcesses = sparePolicy ? app.getAppMetrics().map(p=>({pid:p.pid,type:p.type,rssKiB:p.memory.workingSetSize})) : undefined;
    let click;
    if (nativeBridge?.reload && i > 0) {
      phase = "native-document-reload-" + i;
      click = { at: now(), source: "native-document-reload" };
      const loaded = new Promise(resolve => win.webContents.once('did-finish-load', resolve));
      win.webContents.reload();
      await loaded;
    } else {
      click = await win.webContents.executeJavaScript(`(()=>{performance.clearMarks();const e=[...document.querySelectorAll('[role="link"][aria-label]')].find(e=>e.getAttribute('aria-label').endsWith(${JSON.stringify(": " + opening.project.name)}));if(!e)throw Error('Missing card');const at=performance.timeOrigin+performance.now();e.click();return {at,timeOrigin:performance.timeOrigin}})()`);
    }
    const frame = await ready();
    const detectedReady = now();
    const atFirstReady = await frame.executeJavaScript("({views:studioCtx.viewCtxs.length,initialFrames:studioCtx.loadTimings.snapshot().frameCount,rendered:studioCtx.viewCtxs.filter(v=>v.initialRenderReady).length})");
    if (process.env.PERF_OPEN_INPUT==='1') {
      report.inputProbes=[];
      for(let n=0;n<8;n++) {
        const start=now();
        const result=await frame.executeJavaScript(`(async()=>{const s=studioCtx,button=document.querySelector('button[aria-label="Layers"],button[aria-label="图层"]');if(!button)throw Error('Layers control missing');const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(hit!==button&&!button.contains(hit))throw Error('Layers control is covered');const before=s.leftTabKey,counter=s._changeCounter;button.click();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(s._changeCounter!==counter)throw Error('Panel interaction changed persisted model');return {before,after:s.leftTabKey,rendered:s.viewCtxs.filter(v=>v.initialRenderReady).length}})()`);
        report.inputProbes.push({durationMs:now()-start,...result});await sleep(60);
      }
    }
    await frame.executeJavaScript("studioCtx.awaitStudioReady()");
    await until(() => frame.executeJavaScript("studioCtx.loadTimings.has('all-frames-rendered')"), "all initial artboards rendered");
    await sleep(300);
    const probes = [];
    for (const f of win.webContents.mainFrame.framesInSubtree) {
      try { probes.push(await f.executeJavaScript(`({url:location.href,timeOrigin:performance.timeOrigin,marks:performance.getEntriesByType('mark').map(e=>({name:e.name,start:e.startTime})),longTasks:window.__openProbe?.longTasks,computedStyles:window.__openProbe?.computedStyles,studio:window.studioCtx?{ready:studioCtx.activeCanvasReady,viewportReady:studioCtx.initialViewportReady,timings:studioCtx.loadTimings.snapshot(),project:studioCtx.site.name,revision:studioCtx.dbCtx().revisionNum,changes:studioCtx._changeCounter,components:studioCtx.site.components.length,views:studioCtx.viewCtxs.length,arenas:studioCtx.site.arenas.map(a=>({name:a.name,frames:a.children.length})),pageArenas:studioCtx.site.pageArenas.length,componentArenas:studioCtx.site.componentArenas.length}:null})`)); } catch {}
    }
    const sample = {phase,click,detectedReadyMs:detectedReady-click.at,atFirstReady,probes,
      memory:{processes:app.getAppMetrics().map(p=>({type:p.type,rssKiB:p.memory.workingSetSize})),peakWorkingSetSumKiB:report.memoryProbe?.openPeakRssKiB??null,heap:debuggerEnabled?await win.webContents.debugger.sendCommand("Runtime.getHeapUsage"):null}};
    if (sparePolicy) sample.spareRenderer = {beforeOpenProcesses,rendererPid:win.webContents.getOSProcessId(),reusedExistingProcess:beforeOpenProcesses.some(p=>p.pid===win.webContents.getOSProcessId())};
    const topPaint = await win.webContents.executeJavaScript("({timeOrigin:performance.timeOrigin,paints:window.__openProbe?.paints??[]})");
    const hostProbe = probes.find(p=>p.studio);
    const allFrames = hostProbe?.marks.find(mark=>mark.name==="studio:all-frames-rendered");
    const revealed = hostProbe?.marks.find(mark=>mark.name==="studio:canvas-revealed");
    const firstRendered = hostProbe?.marks.find(mark=>mark.name.startsWith("studio:frame-rendered:"));
    const fcp = topPaint.paints.find(p=>p.name==="first-contentful-paint");
    sample.startup = {
      topPaint,
      firstCapturedContentMs:firstFrames.has(win.webContents.id)?firstFrames.get(win.webContents.id).at-click.at:null,
      firstContentfulPaintMs:fcp ? topPaint.timeOrigin+fcp.start-click.at : null,
      skeletonAtFirstContentfulPaint:fcp?.skeletonVisible??false,
      firstCanvasReadyMs:detectedReady-click.at,
      canvasRevealedMs:revealed ? hostProbe.timeOrigin+revealed.start-click.at : null,
      firstFrameRenderedMs:firstRendered ? hostProbe.timeOrigin+firstRendered.start-click.at : null,
      allFramesRenderedMs:allFrames ? hostProbe.timeOrigin+allFrames.start-click.at : null,
      rendererPid:win.webContents.getOSProcessId(),
    };
    report.samples.push(sample);
    console.log(JSON.stringify({phase,detectedReadyMs:sample.detectedReadyMs,studio:probes.find(p=>p.studio)?.studio}));
    if (nativeBridge) await nativeBridge.afterOpen(frame, i);
    if (i===opens-1) fs.writeFileSync(path.join(task,"real-project-"+mode+".png"),await win.webContents.capturePage().then(i=>i.toPNG()));
    if (i===opens-1 && process.env.PERF_OPEN_RENDERERS==='1') {
      phase = 'renderer-first-use';
      report.renderers = await require('./lazy-renderers-first-use.cjs').run(frame);
    }
    if (i===opens-1 && process.env.PERF_OPEN_FUNCTIONAL==='1') {
      phase='functional';report.functional=(await require('./open-functional.cjs').run({frame,win,ready,preview:startup.projectId==='tk89W1Akg2HjAjyHAYEro7'})).result;
      if (report.errors.length) throw Error('Renderer errors during functional replay: '+report.errors.join('; '));
      break;
    }
    if (nativeBridge?.reload) continue;
    phase = "return-list-"+i;
    if(process.env.PERF_RETURN_TIMING === "1") {app.focus({steal:true});nativeWindow.show();nativeWindow.focus();win.webContents.focus();}
    const returnStartedAt=now();activatedAt=undefined;
    const retiredPid = win.webContents.getOSProcessId();
    const retiredFramePids = process.env.PERF_SPARE_MEMORY === "1" ? [...new Set(win.webContents.mainFrame.framesInSubtree.map(f=>f.osProcessId).filter(Boolean))] : [];
    if(isolatedSessions) {
      await memoryPoint("canvas-"+i);
      await frame.executeJavaScript(`(()=>{const link=document.querySelector('a[href="/projects"][aria-label]');if(!link)throw Error('Missing Dashboard link');link.click();})()`);
    } else await win.webContents.executeJavaScript("history.back()");
    await dashboard();
    if(process.env.PERF_RETURN_TIMING === "1") {
      const cardAt=now();
      const presented=await win.webContents.executeJavaScript(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({at:performance.timeOrigin+performance.now(),visibility:document.visibilityState,active:window.desktopNavigation.isActive(),inert:document.documentElement.inert,query:document.querySelector('input[placeholder]')?.value,token:window.__retainedDashboardToken}))))`);
      const retained=win.webContents===initialDashboard;
      const dashboardPid=win.webContents.getOSProcessId();
      if(process.env.PERF_RETAIN_DASHBOARD === "1" && (!retained || dashboardPid!==initialDashboardPid || presented.query!==opening.project.name || presented.token!=="retained"))throw Error("Dashboard runtime, process or search state was lost");
      if(!presented.active || presented.inert || presented.visibility!=="visible")throw Error("Returned Dashboard is not active and visible");
      report.returnTimings??=[];report.returnTimings.push({iteration:i+1,toProjectCardDOMMs:cardAt-returnStartedAt,toDashboardAnimationFrameMs:presented.at-returnStartedAt,afterActivationAnimationFrameMs:activatedAt===undefined?null:presented.at-activatedAt,retained,dashboardPid,queryRetained:presented.query===opening.project.name});
    }
    await sleep(500);
    if(isolatedSessions) await memoryPoint("returned-"+i,retiredPid,retiredFramePids);
    if(sparePolicy && process.env.PERF_SPARE_MEMORY === "1") {
      await sleep(500);
      await memoryPoint("returned-"+i+"-1s",retiredPid,retiredFramePids);
      await sleep(4000);
      await memoryPoint("returned-"+i+"-5s",retiredPid,retiredFramePids);
    }
    if (!isolatedSessions && report.memoryProbe && (process.env.PERF_OPEN_MEMORY==='1' || i===opens-1)) {
      await win.webContents.debugger.sendCommand('HeapProfiler.collectGarbage');
      await sleep(100);
      report.memoryProbe.afterReturn.push({iteration:i,heap:await win.webContents.debugger.sendCommand('Runtime.getHeapUsage'),rssKiB:app.getAppMetrics().reduce((sum,p)=>sum+p.memory.workingSetSize,0)});
      if (process.env.PERF_OPEN_MEMORY_SETTLE==='1') {
        report.memoryProbe.settled = [];
        for (const delayMs of [1000, 5000]) {
          await sleep(delayMs);
          report.memoryProbe.settled.push({delayMs,heap:await win.webContents.debugger.sendCommand('Runtime.getHeapUsage'),processes:app.getAppMetrics().map(p=>({type:p.type,rssKiB:p.memory.workingSetSize}))});
        }
        await win.webContents.debugger.sendCommand('HeapProfiler.collectGarbage');
        await sleep(100);
        report.memoryProbe.afterSecondGc = {heap:await win.webContents.debugger.sendCommand('Runtime.getHeapUsage'),processes:app.getAppMetrics().map(p=>({type:p.type,rssKiB:p.memory.workingSetSize}))};
      }
    }
  }
}).catch(e => {report.error=e?.stack ?? String(e);console.error(e);process.exitCode=1;}).finally(async () => {
  if (tracing) await contentTracing.stopRecording(path.join(task,"list-open.trace.json"));
  clearInterval(memoryTimer);
  previews?.dispose();
  fs.writeFileSync(path.join(task,"list-open-"+mode+".json"),JSON.stringify(report,null,2),{mode:0o600});
  for (const w of BrowserWindow.getAllWindows()) w.destroy();
  app.exit(process.exitCode||0);
});
setTimeout(()=>{fs.writeFileSync(path.join(task,"list-open-"+mode+".json"),JSON.stringify(report,null,2));app.exit(2)},240000);
