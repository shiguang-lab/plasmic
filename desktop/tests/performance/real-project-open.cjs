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
const task = path.resolve(process.argv[2]);
const mode = process.argv[3] || "timing";
const buildRoot = process.env.PERF_BUILD_ROOT || path.join(task,"build-installed");
const routeStudy = process.env.PERF_ROUTE_STUDY === "1";
const pacedRoute = mode === "paced-route-10s";
const pacedVisits = pacedRoute || mode === "paced-desktop";
// Seconds spent in the last editor of each group, after switching artboards.
const groupEditorDwell = new Map([[2, 30], [5, 60], [7, 90]]);
const studyHeap = routeStudy && process.env.PERF_ROUTE_HEAP === "1";
const studyEdit = routeStudy && process.env.PERF_ROUTE_EDIT === "1";
const projectRead = process.env.PERF_PROJECT_READ;
const projectReadDelayMs = Number(process.env.PERF_PROJECT_READ_DELAY_MS || 0);
const reuseDashboard = mode.startsWith("reuse-dashboard-");
if (reuseDashboard && (!isolatedSessions || projectRead !== "renderer")) throw Error("Dashboard handoff requires isolated views and a renderer read");
if (projectRead && (!routeStudy || !["click", "renderer"].includes(projectRead) ||
    (projectRead === "click" && !isolatedSessions) || !Number.isFinite(projectReadDelayMs) || projectReadDelayMs < 0)) {
  throw Error("Invalid project read timing scenario");
}
const cleanupPolicy = process.env.PERF_ROUTE_CLEANUP;
if (cleanupPolicy && (!routeStudy || isolatedSessions || !["idle", "open-and-idle", "after-artboards"].includes(cleanupPolicy))) {
  throw Error("PERF_ROUTE_CLEANUP requires an SPA route study and idle, open-and-idle or after-artboards");
}
const routeCpuRate = routeStudy && Number(process.env.PERF_ROUTE_CPU_RATE || 1);
const opens = Number(process.env.PERF_OPENS || 4);
const profileKey=process.env.PERF_PROFILE_KEY || mode;
const debuggerEnabled=process.env.PERF_NO_DEBUG!=="1";
if (pacedVisits && (!routeStudy || opens !== 7 || process.env.PERF_ROUTE_MEMORY_DUMP !== "1" ||
    (pacedRoute ? isolatedSessions || cleanupPolicy !== "idle" : !isolatedSessions))) {
  throw Error("Paced visits require seven opens with route study and memory dumps. Use isolated sessions for paced-desktop or SPA idle cleanup for paced-route-10s.");
}
if (routeStudy && debuggerEnabled) throw Error("Route comparisons require PERF_NO_DEBUG=1");
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
const customHost = process.env.PERF_OPEN_CUSTOM_HOST === "1"
  ? require('./open-hostless.cjs').customHost({opening, canvasOrigin, html:fs.readFileSync(path.join(buildRoot,'static/host.html'),'utf8')})
  : undefined;
if (process.env.PERF_CODE_DISPLAY === "1") startup.appConfig.config.codePreview = true;
// Native draft recovery deliberately keeps the remote fixture revision unchanged.
if (process.env.PERF_OPEN_NATIVE) startup.appConfig.config.autoSave = false;
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
  requests: [], resources: [], samples: [], errors: [], blocked: []
};
if (routeStudy) {
  report.routeStudy = {
    route: isolatedSessions ? "desktop" : "spa",
    rendererCpuRate: routeCpuRate,
    cleanupPolicy,
    cleanupDelayMs: cleanupPolicy ? (pacedRoute || projectRead ? 10000 : 3000) : undefined,
    projectRead, projectReadDelayMs: projectRead ? projectReadDelayMs : undefined,
    counters: process.env.PERF_ROUTE_COUNTERS === "1",
    snapshots: studyHeap,
    settle: process.env.PERF_ROUTE_SETTLE || null,
    cleanHtml: process.env.PERF_ROUTE_CLEAN === "1",
    electron: process.versions.electron,
  };
}
if (sparePolicy) report.spareRenderer = {policy:sparePolicy,arguments:spareArguments,electron:process.versions.electron};
const now = () => performance.timeOrigin + performance.now();
const firstFrames=new Map();
let phase = "dashboard-bootstrap", win, tracing = false, memoryTimer, nativeBridge;
const progressPrefix = "REAL_PROJECT_PROGRESS ";
function progress(step, details = {}) {
  const entry = { at: new Date().toISOString(), phase, step, ...details };
  report.currentStep = entry;
  (report.progress ??= []).push(entry);
  fs.appendFileSync(path.join(task, "open-progress-" + mode + ".jsonl"), JSON.stringify(entry) + "\n", { mode: 0o600 });
  console.log(progressPrefix + JSON.stringify(entry));
}
function setPhase(next) { phase = next; progress("phase-start"); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
app.setName("Plasmic real-project diagnostic");
app.userAgentFallback = `${app.userAgentFallback} PlasmicDesktop/${process.platform}`;
app.setPath("userData", path.join(task, "profile-" + profileKey));
app.on("window-all-closed", () => {});
function bootstrap(countStyles, blockPhysicalInput) {
  window.__openProbe = { longTasks: [], paints: [] };
  for (const event of ["beforeunload", "unload"]) {
    window.addEventListener(event, () => console.log("REAL_PROJECT_UNLOAD " + JSON.stringify({event, url:location.origin+location.pathname})));
  }
  if (blockPhysicalInput) {
    window.__openProbe.blockedInputEvents = 0;
    for (const type of ["paste", "drop", "beforeinput", "pointerdown", "mousedown", "click"]) {
      document.addEventListener(type, event => {
        if (event.isTrusted) {
          window.__openProbe.blockedInputEvents++;
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true);
    }
  }

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
  const navigation = (event, details = {}) => {
    if (phase !== "functional") return;
    const entry = { at: new Date().toISOString(), phase, event, rendererId: contents.id, ...details };
    (report.navigation ??= []).push(entry);
    fs.appendFileSync(path.join(task, "open-navigation-" + mode + ".jsonl"), JSON.stringify(entry) + "\n", { mode: 0o600 });
    console.log("REAL_PROJECT_NAVIGATION " + JSON.stringify(entry));
  };
  contents.on("did-start-navigation", details => navigation("did-start-navigation", { url: details.url, isMainFrame: details.isMainFrame, isSameDocument: details.isSameDocument }));
  contents.on("did-navigate", (_event, url) => navigation("did-navigate", { url }));
  contents.on("did-fail-load", (_event, code, description, url, isMainFrame) => navigation("did-fail-load", { code, description, url, isMainFrame }));
  contents.on("did-finish-load", () => navigation("did-finish-load", { url: contents.getURL() }));
  contents.on("did-start-loading", () => navigation("did-start-loading"));
  contents.on("did-stop-loading", () => navigation("did-stop-loading"));
  contents.on("destroyed", () => navigation("destroyed"));
  if (process.env.PERF_BLOCK_PHYSICAL_INPUT === "1") {
    contents.on("before-input-event", event => {
      event.preventDefault();
      report.blockedKeyboardEvents = (report.blockedKeyboardEvents || 0) + 1;
    });
  }
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
    if (event.message.startsWith("REAL_PROJECT_UNLOAD ")) {
      const entry = JSON.parse(event.message.slice("REAL_PROJECT_UNLOAD ".length));
      navigation(entry.event, entry);
    }
    if (event.message.startsWith(progressPrefix)) {
      const entry = JSON.parse(event.message.slice(progressPrefix.length));
      progress(entry.step, { ...entry, rendererId: contents.id });
    }
    if (event.level === "error") report.errors.push(event.message.slice(0,800));
  });
  contents.on("will-prevent-unload", event => { navigation("will-prevent-unload"); event.preventDefault(); });
  if (routeCpuRate > 1) {
    const debuggerApi = contents.debugger;
    debuggerApi.attach("1.3");
    void debuggerApi.sendCommand("Emulation.setCPUThrottlingRate", {
      rate: routeCpuRate,
    }).catch(error => report.errors.push(error.message));
  }
  if(!debuggerEnabled)return;
  const debug = contents.debugger;
  debug.attach("1.3");
  const setup = async id => {
    await debug.sendCommand("Page.enable", {}, id);
    await debug.sendCommand("Page.addScriptToEvaluateOnNewDocument", {source:`(${bootstrap.toString()})(${process.env.PERF_OPEN_COUNT_STYLES === '1'},${process.env.PERF_BLOCK_PHYSICAL_INPUT === '1'})`}, id);
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
  progress("wait-start", { description });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) { progress("wait-complete", { description }); return value; }
    await sleep(process.env.PERF_RETURN_TIMING === "1" && description === "real dashboard card" ? 5 : 100);
  }
  report.timeoutFrames = [];
  for (const f of win.webContents.mainFrame.framesInSubtree) {
    try { report.timeoutFrames.push(await f.executeJavaScript("({url:location.href,body:document.body?.innerText?.slice(0,1500)})")); } catch {}
  }
  throw Error("Timeout: " + description + "; phase=" + phase + "; step=" + report.currentStep?.step);
}
async function memoryPoint(label, retiredPid, retiredFramePids = []) {
  const processes = app.getAppMetrics().map(p=>({pid:p.pid,type:p.type,rssKiB:p.memory.workingSetSize}));
  const sample = {label,rendererPid:win.webContents.getOSProcessId(),processes,
    heap:debuggerEnabled?await win.webContents.debugger.sendCommand("Runtime.getHeapUsage"):null,
    dom:debuggerEnabled?await win.webContents.debugger.sendCommand("Memory.getDOMCounters"):null};
  if (routeStudy && process.env.PERF_ROUTE_COUNTERS === "1") {
    const debug = win.webContents.debugger;
    const attached = debug.isAttached();
    if (!attached) debug.attach("1.3");
    try {
      sample.heap = await debug.sendCommand("Runtime.getHeapUsage");
      sample.dom = await debug.sendCommand("Memory.getDOMCounters");
    } finally {
      if (!attached) debug.detach();
    }
  }
  if (routeStudy && process.env.PERF_ROUTE_MEMORY_DUMP === "1" &&
      (pacedVisits || ["cold-dashboard", "canvas-" + (opens - 1), "returned-" + (opens - 1), "settled-30s"].includes(label))) {
    const debug = win.webContents.debugger;
    const attached = debug.isAttached();
    if (!attached) debug.attach("1.3");
    try {
      await contentTracing.startRecording({
        included_categories: ["disabled-by-default-memory-infra"], excluded_categories: ["*"],
      });
      try {
        const dump = await debug.sendCommand("Tracing.requestMemoryDump", {
          levelOfDetail: pacedVisits ? "light" : "detailed", deterministic: false,
        });
        if (!dump.success) throw Error("Chromium memory dump failed");
      } finally {
        await contentTracing.stopRecording(path.join(task, mode + "-" + label + ".trace"));
      }
    } finally {
      if (!attached) debug.detach();
    }
  }
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
async function routeSnapshot(label) {
  const debug = win.webContents.debugger;
  const attached = debug.isAttached();
  if (!attached) debug.attach("1.3");
  const file = fs.openSync(path.join(task, mode + "-" + label + ".heapsnapshot"), "w", 0o600);
  const writeChunk = (_event, method, params) => {
    if (method === "HeapProfiler.addHeapSnapshotChunk") fs.writeSync(file, params.chunk);
  };
  debug.on("message", writeChunk);
  try {
    await debug.sendCommand("HeapProfiler.collectGarbage");
    const heap = await debug.sendCommand("Runtime.getHeapUsage");
    const dom = await debug.sendCommand("Memory.getDOMCounters");
    (report.routeHeap ??= []).push({label, heap, dom});
    await debug.sendCommand("HeapProfiler.takeHeapSnapshot");
  } finally {
    debug.off("message", writeChunk);
    fs.closeSync(file);
    if (!attached) debug.detach();
  }
}
async function dashboard(contents) {
  return until(() => (contents || win.webContents).executeJavaScript(`(()=>{const e=[...document.querySelectorAll('[role="link"][aria-label]')].find(e=>e.getAttribute('aria-label').endsWith(${JSON.stringify(": " + opening.project.name)}));return e && {label:e.getAttribute('aria-label'),rect:JSON.stringify(e.getBoundingClientRect())}})()`), "real dashboard card");
}
async function ready({ previousTimeOrigin } = {}) {
  return until(async () => {
    for (const f of win.webContents.mainFrame.framesInSubtree) {
      try {
        const state = await f.executeJavaScript("({ready:!!window.studioCtx?.activeCanvasReady && !!window.studioCtx?.initialViewportReady,timeOrigin:performance.timeOrigin})");
        if (state.ready && state.timeOrigin !== previousTimeOrigin) return f;
      } catch {}
    }
  }, "canvas and viewport ready");
}
app.whenReady().then(async () => {
  progress("phase-start");
  app.setActivationPolicy?.(process.env.PERF_RETURN_TIMING === "1" ? "regular" : "accessory");
  if (process.env.PERF_OPEN_MEMORY) {
    report.memoryProbe={peakRssKiB:0,afterReturn:[]};
    memoryTimer=setInterval(()=>{const rss=app.getAppMetrics().reduce((sum,p)=>sum+p.memory.workingSetSize,0);report.memoryProbe.peakRssKiB=Math.max(report.memoryProbe.peakRssKiB,rss);report.memoryProbe.openPeakRssKiB=Math.max(report.memoryProbe.openPeakRssKiB??0,rss)},100);
  }
  const ses = session.fromPartition((process.env.PERF_PERSIST_CACHE === "1" ? "persist:" : "") + "real-project-" + profileKey);
  ses.webRequest.onBeforeRequest({urls:["ws://*/*","wss://*/*"]}, (_, cb) => cb({cancel:true}));
  const backend = require('./real-project-backend.cjs').createProjectBackend({opening,startup,models,codes,plume,report,phase:()=>phase,functional:studyEdit || process.env.PERF_OPEN_FUNCTIONAL==='1'});
  const identity = {epoch:0,value:startup.selfInfo,async read(){return this.value}};
  const cache = new LibraryCache({directory:path.join(task,"library-cache-"+mode),studioOrigin:origin,buildId:report.build.build.rendererHash,identity,remoteFetch:backend});
  const diskRead = cache.store.read.bind(cache.store);
  cache.store.read = async (...args) => {
    const start = now(), result = await diskRead(...args);
    report.resources.push({phase,kind:"disk",key:args[2],start,duration:now()-start,hit:!!result,bytes:result?.body.length||0});
    return result;
  };
  const remoteFetch = async request => {
    const start = now(), currentPhase = phase;
    if (projectRead && projectReadDelayMs && new URL(request.url).pathname === "/api/v1/projects/" + startup.projectId) {
      await sleep(projectReadDelayMs);
    }
    const response = await cache.fetch(request);
    report.requests.push({phase:currentPhase,path:canonical(request.url),start,duration:now()-start,hit:response.headers.get("X-Plasmic-Resource-Cache"),status:response.status});
    return response;
  };
  ses.protocol.handle("http", remoteFetch);
  const assets=createAssetHandler({root:buildRoot,studioOrigin:origin,canvasOrigin,remoteFetch});
  // Offline replay only. Hand the normal renderer GET its pending fixture response once.
  let pendingOpening;
  ses.protocol.handle("https",async request=>{
    if (pendingOpening && request.method === "GET" && new URL(request.url).origin === origin &&
        canonical(request.url) === pendingOpening.path) {
      const {response} = pendingOpening;
      pendingOpening = undefined;
      report.openingReadHits = (report.openingReadHits || 0) + 1;
      return response;
    }
    if (routeStudy) {
      const url = new URL(request.url);
      if (url.origin === origin && url.pathname === "/api/v1/project-covers/events") {
        return new Response(null, {status: 204});
      }
      if (/^\/assets\/[A-Za-z0-9_-]+\.(png|webp|jpg|jpeg)$/.test(url.pathname)) {
        const image = path.join(task, "images", path.basename(url.pathname));
        if (fs.existsSync(image)) {
          const format = path.extname(image).slice(1);
          return new Response(await fs.promises.readFile(image), {headers: {
            "Content-Type": "image/" + (format === "jpg" ? "jpeg" : format),
            "Access-Control-Allow-Origin": "*",
          }});
        }
      }
    }
    const response=customHost && new URL(request.url).origin === canvasOrigin && new URL(request.url).pathname === customHost.pathname
      ? new Response(customHost.html,{headers:{"Content-Type":"text/html; charset=utf-8","Access-Control-Allow-Origin":"*"}})
      : await assets(request);
    if(debuggerEnabled || (routeStudy && process.env.PERF_ROUTE_CLEAN === "1") || !response.headers.get("Content-Type")?.startsWith("text/html"))return response;
    const headers=new Headers(response.headers);headers.delete("Content-Length");
    const html=(await response.text()).replace(/<head[^>]*>/i,head=>head+`<script>(${bootstrap.toString()})(false,${process.env.PERF_BLOCK_PHYSICAL_INPUT === '1'})</script>`);
    return new Response(html,{status:response.status,headers});
  });
  const preload = path.join(task,"preview-only-preload.cjs");
  if (process.env.PERF_OPEN_NATIVE) nativeBridge = await require('./open-native-bridge.cjs').install({task,mode,origin,startup,ipcMain,getWindow:()=>win,report});
  fs.writeFileSync(preload,`const {contextBridge,ipcRenderer}=require('electron');${isolatedSessions ? "let active=true;const activeListeners=new Set();ipcRenderer.on('desktop:view-state',(_,state)=>{active=state.active;for(const listener of activeListeners)listener(state);});contextBridge.exposeInMainWorld('desktopNavigation',{navigate:url=>ipcRenderer.invoke('desktop:navigate',url),isActive:()=>active,onActiveChange:listener=>{activeListeners.add(listener);return()=>activeListeners.delete(listener);}});" : ''}${nativeBridge?.preload || ''}`);
  if (cleanupPolicy) {
    fs.appendFileSync(preload, `
      const {webFrame} = require("electron");
      let idleTimer;
      const idleVisits = [];
      const calls = {opened: 0, idle: 0, cancelled: 0};
      contextBridge.exposeInMainWorld("routeCleanupProbe", {
        opened() {
          webFrame.clearCache();
          calls.opened++;
          return performance.timeOrigin + performance.now();
        },
        schedule() {
          const visit = {scheduledAt: performance.timeOrigin + performance.now()};
          idleVisits.push(visit);
          idleTimer = setTimeout(() => {
            webFrame.clearCache();
            visit.clearedAt = performance.timeOrigin + performance.now();
            calls.idle++;
            idleTimer = undefined;
          }, ${report.routeStudy.cleanupDelayMs});
        },
        cancel() {
          if (idleTimer !== undefined) {
            clearTimeout(idleTimer);
            idleTimer = undefined;
            idleVisits.at(-1).cancelledAt = performance.timeOrigin + performance.now();
            calls.cancelled++;
          }
        },
        visits() { return idleVisits; },
        counts() { return {...calls}; }
      });
    `);
  }
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
    if (reuseDashboard && win.view === win.dashboard &&
        new URL(url).origin === origin && new URL(url).pathname === "/projects/" + startup.projectId) {
      win.editor = win.view;
      win.dashboard = undefined;
      win.dashboardLoad = undefined;
      // The installed Desktop navigation listener changes the current React route.
      win.activate(win.editor, url);
      return;
    }
    if (projectRead === "click") {
      const next = new URL(url);
      if (next.origin === origin && next.pathname === "/projects/" + startup.projectId) {
        const api = new URL("/api/v1" + next.pathname, origin);
        api.searchParams.set("includeStartup", "true");
        api.searchParams.set("branchName", JSON.stringify(next.searchParams.get("branch") || "main"));
        pendingOpening = {path:canonical(api.href), response:remoteFetch(new Request(api))};
      }
    }
    return win.loadURL(url);
  });
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
  if (isolatedSessions || routeStudy) await memoryPoint("cold-dashboard");
  if (pacedVisits) {
    await sleep(30000);
    await memoryPoint("initial-list-30s");
  }
  let savedPage;
  const documentOrigin = routeStudy && await initialDashboard.executeJavaScript("performance.timeOrigin");
  for (let i=0;i<opens;i++) {
    if(report.memoryProbe) report.memoryProbe.openPeakRssKiB=0;
    if(process.env.PERF_RETURN_TIMING === "1") {app.focus({steal:true});nativeWindow.show();nativeWindow.focus();win.webContents.focus();}
    setPhase(i===0 ? "first-list-open" : "warm-list-open-"+i);
    const beforeOpenProcesses = sparePolicy ? app.getAppMetrics().map(p=>({pid:p.pid,type:p.type,rssKiB:p.memory.workingSetSize})) : undefined;
    let click;
    if (cleanupPolicy) await win.webContents.executeJavaScript("routeCleanupProbe.cancel()");
    if (nativeBridge?.reload && i > 0) {
      setPhase("native-document-reload-" + i);
      click = { at: now(), source: "native-document-reload" };
      const loaded = new Promise(resolve => win.webContents.once('did-finish-load', resolve));
      win.webContents.reload();
      await loaded;
    } else {
      click = await win.webContents.executeJavaScript(`(()=>{performance.clearMarks();const e=[...document.querySelectorAll('[role="link"][aria-label]')].find(e=>e.getAttribute('aria-label').endsWith(${JSON.stringify(": " + opening.project.name)}));if(!e)throw Error('Missing card');const at=performance.timeOrigin+performance.now();e.click();return {at,timeOrigin:performance.timeOrigin}})()`);
    }
    let frame = await ready();
    const detectedReady = now();
    const atFirstReady = await frame.executeJavaScript("({views:studioCtx.viewCtxs.length,initialFrames:studioCtx.loadTimings.snapshot().frameCount,rendered:studioCtx.viewCtxs.filter(v=>v.initialRenderReady).length})");
    if (cleanupPolicy === "open-and-idle") {
      const clearedAt = await win.webContents.executeJavaScript("routeCleanupProbe.opened()");
      (report.openCleanupMs ??= []).push(clearedAt - click.at);
    }
    if (process.env.PERF_OPEN_INPUT==='1') {
      // Handle the first-use tour in the same browser task as the hit test,
      // since its lazy-loaded content can appear between input samples.
      report.inputProbes=[];
      for(let n=0;n<8;n++) {
        const start=now();
        const result=await frame.executeJavaScript(`(async()=>{let tourDismissed=false;
        const findTour=()=>[...document.querySelectorAll('h4')].find(e=>['Project navigation has moved!','项目导航已移动！'].includes(e.textContent.trim()));
        // Joyride mounts the overlay before positioning the tooltip content.
        for(let i=0;i<120&&document.querySelector('.react-joyride__overlay')&&!findTour();i++)await new Promise(requestAnimationFrame);
        const title=findTour();
        if(title){
        const button=[...title.parentElement.querySelectorAll('button')].find(e=>['Got it','知道了'].includes(e.textContent.trim()));
        if(!button)throw Error('Navigation tour dismissal missing');
        const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        if(hit!==button&&!button.contains(hit))throw Error('Navigation tour dismissal is covered');
        const counter=studioCtx._changeCounter;button.click();
        for(let i=0;i<120&&title.isConnected;i++)await new Promise(requestAnimationFrame);
        if(title.isConnected)throw Error('Navigation tour did not close');
        // Joyride can keep its overlay during the exit animation.
        for(let i=0;i<120;i++){
          const layer=document.querySelector('button[aria-label="Layers"],button[aria-label="图层"]');
          if(!layer)throw Error('Layers control missing after tour');
          const r=layer.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          if(hit===layer||layer.contains(hit))break;
          await new Promise(requestAnimationFrame);
        }
        if(studioCtx._changeCounter!==counter)throw Error('Dismissing navigation tour changed persisted model');
        tourDismissed=true;
        }
        const s=studioCtx,button=document.querySelector('button[aria-label="Layers"],button[aria-label="图层"]');if(!button)throw Error('Layers control missing');const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(hit!==button&&!button.contains(hit))throw Error('Layers control is covered');const before=s.leftTabKey,counter=s._changeCounter;button.click();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(s._changeCounter!==counter)throw Error('Panel interaction changed persisted model');return {tourDismissed,before,after:s.leftTabKey,rendered:s.viewCtxs.filter(v=>v.initialRenderReady).length}})()`);
        report.inputProbes.push({durationMs:now()-start,...result});await sleep(60);
      }
    }
    progress("await-initial-studio-ready");
    await frame.executeJavaScript("studioCtx.awaitStudioReady()");
    await until(() => frame.executeJavaScript("studioCtx.loadTimings.has('all-frames-rendered')"), "all initial artboards rendered");
    const canvasSettle = sleep(300);
    if (cleanupPolicy === "after-artboards") {
      const allRendered = await frame.executeJavaScript("studioCtx.viewCtxs.filter(v => v.initialRenderReady).length");
      if (allRendered !== atFirstReady.initialFrames || frame.osProcessId !== win.webContents.getOSProcessId()) {
        throw Error("Idle cleanup requires all initial artboards in the active renderer");
      }
      const clearedAt = await win.webContents.executeJavaScript(
        "new Promise(resolve => requestIdleCallback(() => resolve(routeCleanupProbe.opened())))"
      );
      (report.openCleanupMs ??= []).push(clearedAt - click.at);
    }
    await canvasSettle;
    const probes = [];
    for (const f of win.webContents.mainFrame.framesInSubtree) {
      try { probes.push(await f.executeJavaScript(`({url:location.href,timeOrigin:performance.timeOrigin,marks:performance.getEntriesByType('mark').map(e=>({name:e.name,start:e.startTime})),longTasks:window.__openProbe?.longTasks,computedStyles:window.__openProbe?.computedStyles,blockedInputEvents:window.__openProbe?.blockedInputEvents,studio:window.studioCtx?{ready:studioCtx.activeCanvasReady,viewportReady:studioCtx.initialViewportReady,timings:studioCtx.loadTimings.snapshot(),project:studioCtx.site.name,revision:studioCtx.dbCtx().revisionNum,changes:studioCtx._changeCounter,components:studioCtx.site.components.length,views:studioCtx.viewCtxs.length,arenas:studioCtx.site.arenas.map(a=>({name:a.name,frames:a.children.length})),pageArenas:studioCtx.site.pageArenas.length,componentArenas:studioCtx.site.componentArenas.length}:null})`)); } catch {}
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
    if (routeStudy) {
      sample.documentReused = topPaint.timeOrigin === (reuseDashboard ? click.timeOrigin : documentOrigin);
      if (sample.documentReused !== (!isolatedSessions || reuseDashboard)) throw Error("Unexpected top document ownership");
      if (!revealed || atFirstReady.rendered < 1) throw Error("Target artboard did not render");
      if (studyEdit && i === 0) {
        savedPage = await frame.executeJavaScript(`(async () => {
          const ctx = studioCtx;
          const page = ctx.site.pageArenas[0];
          const original = page.component.name;
          const updated = original + "RouteStudy";
          await ctx.changeUnsafe(() => ctx.siteOps().tryRenameArenas([{arena: page, newName: updated}]));
          await ctx.undo();
          if (page.component.name !== original) throw Error("Page rename undo failed");
          await ctx.redo();
          if (page.component.name !== updated) throw Error("Page rename redo failed");
          ctx.needsFullSave = true;
          await ctx.save();
          if (ctx.saveStatus !== "saved") throw Error("Offline save failed");
          return {name: updated, revision: ctx.dbCtx().revisionNum};
        })()`);
      } else if (studyEdit) {
        const reopened = await frame.executeJavaScript(
          "({name: studioCtx.site.pageArenas[0].component.name, revision: studioCtx.dbCtx().revisionNum})"
        );
        if (reopened.name !== savedPage.name || reopened.revision !== savedPage.revision) {
          throw Error("Reopened route lost the saved edit");
        }
        sample.savedEditRestored = true;
      }
      if (studyHeap) {
        const marker = JSON.stringify("routeStudySession" + i);
        await frame.executeJavaScript(`(() => {
          for (const object of [studioCtx, studioCtx.site, window.document, ...studioCtx.viewCtxs]) {
            Object.defineProperty(object, ${marker}, {value: true, configurable: true});
          }
        })()`);
        sample.editorSharesRenderer = frame.osProcessId === win.webContents.getOSProcessId();
        if (!sample.editorSharesRenderer) throw Error("Heap study needs the actual editor isolate");
        if (i === 0) await routeSnapshot("active");
      }
    }
    if (nativeBridge) {
      progress("native-after-open", { iteration: i });
      await nativeBridge.afterOpen(frame, i);
      progress("native-after-open-complete", { iteration: i });
    }
    if (i===opens-1) fs.writeFileSync(path.join(task,"real-project-"+mode+".png"),await win.webContents.capturePage().then(i=>i.toPNG()));
    if (i===opens-1 && process.env.PERF_OPEN_RENDERERS==='1') {
      setPhase('renderer-first-use');
      report.renderers = await require('./lazy-renderers-first-use.cjs').run(frame);
    }
    if (i===opens-1 && process.env.PERF_CODE_DISPLAY==='1') {
      setPhase('code-display');report.codeDisplay=await require('./code-display.cjs').run(frame);
    }
    if (i===opens-1 && process.env.PERF_OPEN_DOCS==='1') {
      setPhase('docs-portal');
      const docs=await require('./docs-portal.cjs').run({frame,win,ready});
      report.docsPortal=docs.result;frame=docs.frame;
    }
    if (i===opens-1 && process.env.PERF_OPEN_FUNCTIONAL==='1') {
      setPhase('functional');report.functional=(await require('./open-functional.cjs').run({frame,win,ready,progress,preview:startup.projectId==='tk89W1Akg2HjAjyHAYEro7'})).result;
      if (report.errors.length) throw Error('Renderer errors during functional replay: '+report.errors.join('; '));
      break;
    }
    if (nativeBridge?.reload) continue;
    if (projectRead) {
      const reading = sleep(5000);
      if (reuseDashboard) {
        const started = now();
        await win.prepareDashboard();
        await dashboard(win.dashboard.webContents);
        sample.nextListReadyMs = now() - started;
      }
      await reading;
    }
    if (pacedVisits) {
      await sleep(5000);
      await frame.executeJavaScript(`(async () => {
        const s = studioCtx;
        const target = s.currentArena.children[${i + 1}];
        s.changeSelection(() => s.setStudioFocusOnFrame({frame:target, autoZoom:true}));
        await s.awaitEval();
        await s.awaitStudioReady();
        if (!s.tryGetViewCtxForFrame(target)?.initialRenderReady) throw Error("Selected artboard did not render");
      })()`);
      const dwell = groupEditorDwell.get(i + 1);
      if (dwell) {
        await memoryPoint("editor-" + (i + 1) + "-selected");
        for (let seconds = 30; seconds <= dwell; seconds += 30) {
          await sleep(30000);
          await memoryPoint("editor-" + (i + 1) + "-" + seconds + "s");
        }
      } else {
        await sleep(5000);
      }
    }
    setPhase("return-list-"+i);
    if(process.env.PERF_RETURN_TIMING === "1") {app.focus({steal:true});nativeWindow.show();nativeWindow.focus();win.webContents.focus();}
    const returnStartedAt=now();activatedAt=undefined;
    const retiredPid = win.webContents.getOSProcessId();
    const retiredFramePids = process.env.PERF_SPARE_MEMORY === "1" ? [...new Set(win.webContents.mainFrame.framesInSubtree.map(f=>f.osProcessId).filter(Boolean))] : [];
    if(isolatedSessions || routeStudy) {
      await memoryPoint("canvas-"+i);
      await frame.executeJavaScript(`(()=>{const link=document.querySelector('a[href="/projects"][aria-label]');if(!link)throw Error('Missing Dashboard link');link.click();})()`);
    } else await win.webContents.executeJavaScript("history.back()");
    await dashboard();
    if (cleanupPolicy) {
      if (win.webContents.mainFrame.framesInSubtree.length !== 1) throw Error("Editor frame still attached at cleanup scheduling");
      await win.webContents.executeJavaScript("routeCleanupProbe.schedule()");
    }
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
    if (routeStudy) {
      if (!isolatedSessions) await memoryPoint("returned-" + i);
      const top = await win.webContents.executeJavaScript("performance.timeOrigin");
      if (reuseDashboard) {
        if (top === click.timeOrigin || win.webContents !== win.dashboard.webContents) throw Error("Did not activate the replacement list");
      } else if (top !== documentOrigin) throw Error("Dashboard top document was replaced");
      if (win.webContents.mainFrame.framesInSubtree.length !== 1) throw Error("Editor frame still attached");
      if (pacedVisits) {
        if (groupEditorDwell.has(i + 1)) {
          const dwell = i + 1 === opens ? 120 : 60;
          for (let seconds = 30; seconds <= dwell; seconds += 30) {
            await sleep(30000);
            await memoryPoint("list-" + (i + 1) + "-" + seconds + "s", isolatedSessions ? retiredPid : undefined);
          }
        } else {
          await sleep(5000);
        }
      }
      const settle = process.env.PERF_ROUTE_SETTLE;
      if (settle === "each" || (i === opens - 1 && settle === "1")) {
        for (const seconds of [5, 30]) {
          await sleep(seconds === 5 ? 4500 : 25000);
          await memoryPoint("settled-" + seconds + "s");
        }
      }
      if (studyHeap && i === opens - 1) await routeSnapshot("returned");
    }
    if (projectRead && i + 1 < opens) await sleep(5000);
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
  if (pacedRoute) report.idleVisits = await win.webContents.executeJavaScript("routeCleanupProbe.visits()");
  if (projectRead === "click" && (pendingOpening || report.openingReadHits !== opens)) throw Error("Expected one pending opening read per navigation");
  if (cleanupPolicy) report.cleanupCalls = await win.webContents.executeJavaScript("routeCleanupProbe.counts()");
  if (routeStudy && (report.errors.length || report.blocked.length)) {
    throw Error("Route study recorded renderer errors or blocked requests; inspect the private report");
  }
}).catch(e => {report.error=e?.stack ?? String(e);console.error(e);process.exitCode=1;}).finally(async () => {
  if (tracing) await contentTracing.stopRecording(path.join(task,"list-open.trace.json"));
  clearInterval(memoryTimer);
  fs.writeFileSync(path.join(task,"list-open-"+mode+".json"),JSON.stringify(report,null,2),{mode:0o600});
  for (const w of BrowserWindow.getAllWindows()) w.destroy();
  app.exit(process.exitCode||0);
});
const timeoutMs = pacedVisits ? 720000 : 240000;
setTimeout(()=>{
  report.timedOut = { timeoutMs, phase, currentStep: report.currentStep };
  report.error ??= "Harness deadline exceeded (" + timeoutMs + " ms); phase=" + phase + "; currentStep=" + JSON.stringify(report.currentStep);
  console.error(report.error);
  fs.writeFileSync(path.join(task,"list-open-"+mode+".json"),JSON.stringify(report,null,2),{mode:0o600});
  app.exit(2);
},timeoutMs);
