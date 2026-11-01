// Diagnostic replay of an unchanged real project and its exact dependencies.
// All network requests terminate in private fixtures. Never pass a normal profile.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { app, BrowserWindow, session, contentTracing, ipcMain } = require("electron");
const { LibraryCache } = require("../../src/library-cache.cjs");
const { createAssetHandler } = require("../../src/asset-handler.cjs");
const { createDashboardPreviews } = require("../../src/dashboard-preview.cjs");
const task = path.resolve(process.argv[2]);
const mode = process.argv[3] || "timing";
const buildRoot = process.env.PERF_BUILD_ROOT || path.join(task,"build-installed");
const opens = Number(process.env.PERF_OPENS || 4);
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
  mode, dataset, build: JSON.parse(fs.readFileSync(path.join(buildRoot,"desktop-assets.json"))),
  project: { id: startup.projectId, name: opening.project.name, revision: opening.rev.revision, objects: Object.keys(projectBundle.map).length, sha256: hash(opening.rev.data), dependencies: opening.depPkgs.map(p => ({ id:p.id, version:p.version, resource:"/api/v1/dependency-models/"+p.modelResourceId, sha256:hash(models["/api/v1/dependency-models/"+p.modelResourceId].body) })) },
  requests: [], resources: [], samples: [], errors: [], blocked: [], previewErrors: []
};
const now = () => performance.timeOrigin + performance.now();
let phase = "dashboard-bootstrap", win, tracing = false, previews, memoryTimer, nativeBridge;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
app.setName("Plasmic real-project diagnostic");
app.userAgentFallback = `${app.userAgentFallback} PlasmicDesktop/${process.platform}`;
app.setPath("userData", path.join(task, "profile-" + mode));
app.on("window-all-closed", () => {});
ipcMain.on("desktop:preview-host-error", (_event,message) => report.previewErrors.push({phase,message:String(message)}));
function bootstrap(countStyles) {
  window.__openProbe = { longTasks: [] };
  if (countStyles) {
    const getStyle = window.getComputedStyle;
    __openProbe.computedStyles = 0;
    window.getComputedStyle = function (...args) { __openProbe.computedStyles++; return getStyle.apply(this, args); };
  }
  new PerformanceObserver(list => __openProbe.longTasks.push(...list.getEntries().map(e => ({ start:e.startTime, duration:e.duration })))).observe({type:"longtask",buffered:true});
}
app.on("web-contents-created", (_, contents) => {
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
  contents.on("console-message", event => {
    if (event.level === "error") report.errors.push(event.message.slice(0,800));
  });
  contents.on("will-prevent-unload", event => event.preventDefault());
  void setup().catch(e => report.errors.push(e.message));
});
async function until(fn, description) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await sleep(100);
  }
  report.timeoutFrames = [];
  for (const f of win.webContents.mainFrame.framesInSubtree) {
    try { report.timeoutFrames.push(await f.executeJavaScript("({url:location.href,body:document.body?.innerText?.slice(0,1500)})")); } catch {}
  }
  throw Error("Timeout: " + description);
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
  app.setActivationPolicy?.("accessory");
  if (process.env.PERF_OPEN_MEMORY) {
    report.memoryProbe={peakRssKiB:0,afterReturn:[]};
    memoryTimer=setInterval(()=>{const rss=app.getAppMetrics().reduce((sum,p)=>sum+p.memory.workingSetSize,0);report.memoryProbe.peakRssKiB=Math.max(report.memoryProbe.peakRssKiB,rss)},100);
  }
  const ses = session.fromPartition("real-project-" + mode);
  ses.webRequest.onBeforeRequest({urls:["ws://*/*","wss://*/*"]}, (_, cb) => cb({cancel:true}));
  const headers = {"Content-Type":"application/json","Access-Control-Allow-Origin":"*"};
  const json = value => new Response(JSON.stringify(value), {headers});
  const backend = async request => {
    const u = new URL(request.url), s = u.pathname;
    if (request.method === "OPTIONS") return new Response(null, {headers:{...headers,"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"*"}});
    if (process.env.PERF_OPEN_FUNCTIONAL==='1' && request.method==='POST' && s.startsWith('/api/v1/projects/'+startup.projectId+'/revisions/')) {
      const body=await request.json(), bundle=JSON.parse(body.data);
      if (body.incremental || !bundle.map || !bundle.root) throw Error('Diagnostic requires a complete saved bundle');
      opening.rev={...opening.rev,data:body.data,revision:Number(s.split('/').at(-1))};
      report.saves ??= [];report.saves.push({revision:opening.rev.revision,sha256:hash(body.data)});
      return json({});
    }
    if (!["GET","HEAD"].includes(request.method)) {
      report.blocked.push({phase,method:request.method,path:s});
      return new Response("Diagnostic blocks writes", {status:405,headers});
    }
    if (models[s]) return new Response(models[s].body,{headers:{...headers,...models[s].headers}});
    const code = codes.get(canonical(request.url));
    if (code) return new Response(Buffer.from(code.body,"base64"),{headers:{...headers,...code.headers}});
    if (/dependency-models|hostless-libraries/.test(s)) throw Error("Missing immutable fixture: " + canonical(request.url));
    if (s === `/api/v1/projects/${startup.projectId}`) {
      if (u.searchParams.get("includeStartup") === "true") return json(opening);
      const {startup: unused, ...withoutStartup} = opening;
      return json(withoutStartup);
    }
    if (s === "/api/v1/auth/self") return json(startup.selfInfo);
    if (s === "/api/v1/app-config") return json(startup.appConfig);
    if (s === "/api/v1/app-ctx") return json(startup.appCtx);
    if (s === "/api/v1/latest-bundle-version") return json({latestBundleVersion:startup.latestBundleVersion});
    if (s === "/api/v1/hosts") return json(startup.hosts);
    if (s === "/api/v1/projects") return json(startup.projectData);
    if (s.endsWith("/branches")) return json({branches:startup.branches});
    if (s.endsWith("/revs/unpublished")) return json({revisions:[]});
    if (s.endsWith("/revision-without-data")) { const {data, ...rev} = opening.rev; return json({rev}); }
    if (s.endsWith("/roles")) return json([]);
    if (s === "/api/v1/plume-pkg") return json(plume);
    if (s.startsWith("/api/v1/pkgs/")) {
      const pkg = opening.depPkgs.find(p => s.endsWith(p.pkgId));
      if (pkg) return json({pkg,depPkgs:opening.depPkgs.filter(p=>p.id!==pkg.id)});
    }
    if (s.startsWith("/api/v1/comments/")) return json({threads:[],reactions:[],users:[]});
    if (/\/app-user$|\/ai\/edit\/status$|\/pkg$/.test(s)) return json({});
    if (s.includes("socket.io")) return new Response("",{status:503,headers});
    if (u.hostname === "fonts.googleapis.com" || s === "/dahlia/stripe.js") return new Response("",{headers:{...headers,"Content-Type":s.endsWith(".js")?"application/javascript":"text/css"}});
    report.unknown ??= [];
    if (!report.unknown.includes(s)) report.unknown.push(s);
    return json({});
  };
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
  ses.protocol.handle("https",createAssetHandler({root:buildRoot,studioOrigin:origin,canvasOrigin,remoteFetch,previewHostPath:path.resolve(__dirname,"../../src/preview-host.html")}));
  const preload = path.join(task,"preview-only-preload.cjs");
  if (process.env.PERF_OPEN_NATIVE) nativeBridge = await require('./open-native-bridge.cjs').install({task,mode,origin,startup,ipcMain,getWindow:()=>win,report});
  fs.writeFileSync(preload,`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('desktopPreview',{render:(...args)=>ipcRenderer.invoke('desktop:dashboard-preview',...args),cancel:id=>ipcRenderer.send('desktop:dashboard-preview-cancel',id)});${nativeBridge?.preload || ''}`);
  win = new BrowserWindow({width:1512,height:887,show:true,webPreferences:{session:ses,preload,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  previews = createDashboardPreviews({session:ses,studioOrigin:origin,trustedSender:event=>event.sender===win.webContents});
  await win.loadURL(origin+"/projects");
  report.card = await dashboard();
  await sleep(1000);
  if (mode === "trace") {
    await contentTracing.startRecording({included_categories:["toplevel","v8","devtools.timeline","blink.user_timing","disabled-by-default-v8.cpu_profiler"],excluded_categories:["*"]});
    tracing = true;
  }
  for (let i=0;i<opens;i++) {
    phase = i===0 ? "first-list-open" : "warm-list-open-"+i;
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
      memory:{processes:app.getAppMetrics().map(p=>({type:p.type,rssKiB:p.memory.workingSetSize})),heap:await win.webContents.debugger.sendCommand("Runtime.getHeapUsage")}};
    report.samples.push(sample);
    console.log(JSON.stringify({phase,detectedReadyMs:sample.detectedReadyMs,studio:probes.find(p=>p.studio)?.studio}));
    if (nativeBridge) await nativeBridge.afterOpen(frame, i);
    if (i===opens-1) fs.writeFileSync(path.join(task,"real-project-"+mode+".png"),await win.webContents.capturePage().then(i=>i.toPNG()));
    if (i===opens-1 && process.env.PERF_OPEN_FUNCTIONAL==='1') {
      phase='functional';report.functional=(await require('./open-functional.cjs').run({frame,win,ready,preview:startup.projectId==='tk89W1Akg2HjAjyHAYEro7'})).result;
      break;
    }
    if (nativeBridge?.reload) continue;
    phase = "return-list-"+i;
    await win.webContents.executeJavaScript("history.back()");
    await dashboard();
    await sleep(500);
    if (report.memoryProbe && (process.env.PERF_OPEN_MEMORY==='1' || i===opens-1)) {
      await win.webContents.debugger.sendCommand('HeapProfiler.collectGarbage');
      await sleep(100);
      report.memoryProbe.afterReturn.push({iteration:i,heap:await win.webContents.debugger.sendCommand('Runtime.getHeapUsage'),rssKiB:app.getAppMetrics().reduce((sum,p)=>sum+p.memory.workingSetSize,0)});
    }
  }
}).catch(e => {report.error=e.stack;console.error(e);process.exitCode=1;}).finally(async () => {
  if (tracing) await contentTracing.stopRecording(path.join(task,"list-open.trace.json"));
  clearInterval(memoryTimer);
  previews?.dispose();
  fs.writeFileSync(path.join(task,"list-open-"+mode+".json"),JSON.stringify(report,null,2),{mode:0o600});
  for (const w of BrowserWindow.getAllWindows()) w.destroy();
  app.exit(process.exitCode||0);
});
setTimeout(()=>{fs.writeFileSync(path.join(task,"list-open-"+mode+".json"),JSON.stringify(report,null,2));app.exit(2)},240000);
