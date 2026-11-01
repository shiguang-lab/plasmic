// Diagnostic only: fresh profile, offline fixtures, no application source changes.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { app, BrowserWindow, session, ipcMain } = require("electron");
const root = process.env.PLASMIC_PERF_DESKTOP || path.resolve(__dirname, "../..");
const implementation = process.env.PLASMIC_PERF_DESKTOP ? "before" : "fixed";
const mode = process.argv[2], output = process.argv[3];
if (!mode || !output) throw Error("Required: scenario output.json");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-seven-"));
app.setPath("userData", profile);
app.setActivationPolicy?.("prohibited");
app.on("window-all-closed", () => {});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const report = { mode, implementation, electron: process.versions.electron, node: process.versions.node,
  platform: process.platform, arch: process.arch, scope: "isolated offline native diagnostic" };
function metrics() { return app.getAppMetrics().map(p => ({pid:p.pid,type:p.type,cpu:p.cpu.cumulativeCPUUsage,rssKiB:p.memory.workingSetSize})); }
async function sample(action, durationMs = 3000) {
  const begin = metrics(), start = performance.now(), rss = [];
  let ticks = 0;
  while (performance.now() - start < durationMs) {
    if (action) await action(ticks);
    ticks++;
    rss.push(metrics().reduce((n,p) => n+p.rssKiB,0)/1024);
    await sleep(500);
  }
  const end = metrics(), elapsedMs = performance.now()-start;
  const cpuMs = end.reduce((n,p) => { const prev=begin.find(b=>b.pid===p.pid);return n+(prev?Math.max(0,p.cpu-prev.cpu)*1000:0);},0);
  return {elapsedMs,ticks,cpuMs,cpuOneCorePercent:cpuMs/elapsedMs*100,
    rssSumMiBMean:rss.reduce((a,b)=>a+b,0)/rss.length,rssSumMiBPeak:Math.max(...rss),processes:end};
}
function ui() {
  const locales = path.join(profile,"locales");
  fs.cpSync(path.resolve(__dirname,"../../../platform/wab/src/wab/client/i18n/locales"),locales,{recursive:true});
  fs.copyFileSync(path.resolve(__dirname,"../../../platform/wab/src/wab/client/i18n/locale-resolution.cjs"),path.join(locales,"locale-resolution.cjs"));
  return {i18n:require(root+"/src/i18n.cjs").createDesktopI18n(locales,["zh-CN"]),
    appearance:require(root+"/src/ui-appearance.cjs").createDesktopAppearance("light")};
}
async function reference() {
  const {ReferenceBrowser} = require(root+"/src/reference-browser.cjs");
  const parent = new BrowserWindow({show:false,width:1450,height:950,webPreferences:{backgroundThrottling:false}});
  await parent.loadURL("data:text/html,<h1>Offline editor</h1>");
  parent.show = () => {}; // Keep the diagnostic off the user's desktop.
  const browser = new ReferenceBrowser({getParent:()=>parent,...ui(),dispatch:(_m,v)=>browser.command(v)});
  const ses=session.fromPartition("plasmic-reference-browser");
  ses.protocol.handle("https",()=>new Response(`<!doctype html><style>body{font:16px system-ui}#card{padding:20px;width:600px}</style><div id="card"><input id="field" value="original"><button onclick="this.textContent='clicked'">Action</button>${"<p>客户评论：测试内容</p>".repeat(800)}</div>` ,{headers:{"Content-Type":"text/html;charset=utf-8"}}));
  await browser.command({action:"load_page",url:"https://reference.test/"});
  const contents=browser.view.webContents;
  let calls=0;
  const execute=contents.executeJavaScriptInIsolatedWorld.bind(contents);
  contents.executeJavaScriptInIsolatedWorld=(...args)=>{calls++;return execute(...args);};
  await contents.executeJavaScript("document.querySelector('#field').value='unsaved';window.marker=crypto.randomUUID();document.querySelector('button').click();true");
  const selectedBefore=await browser.picker("select","#card");
  const before=await contents.executeJavaScript("({marker,field:document.querySelector('#field').value,button:document.querySelector('button').textContent})");
  await sleep(600);
  calls=0;report.open=await sample();report.open.calls=calls;
  await browser.command({action:"close"});calls=0;
  report.hidden=await sample();report.hidden.calls=calls;
  if(implementation==="fixed")assert.equal(calls,0);
  await browser.open();
  const after=await contents.executeJavaScript("({marker,field:document.querySelector('#field').value,button:document.querySelector('button').textContent})");
  assert.deepEqual(after,before);
  assert.equal((await browser.picker("snapshot")).selector,selectedBefore.selector);
  parent.showInactive();await sleep(500);
  const image=await contents.capturePage();assert(!image.isEmpty());parent.hide();
  // Reopen/close while polling is in flight; none may restart the hidden timer.
  for(let i=0;i<5;i++){await browser.open();const pending=browser.poll();browser.hide();await pending;}
  await sleep(200);calls=0;await sleep(450);report.hiddenAfterRaceCalls=calls;if(implementation==="fixed")assert.equal(calls,0);
  await browser.open();
  report.functional={samePage:true,unsavedInputPreserved:true,buttonStatePreserved:true,selectionPreserved:true,screenshot:true,
    inFlightCloseAndReopen:true,sameRendererPid:contents.getOSProcessId(),visible:browser.visible};
  browser.dispose();parent.destroy();
}
async function hidden() {
  const win=new BrowserWindow({show:false,width:1000,height:700,webPreferences:{backgroundThrottling:false}});
  await win.loadURL('data:text/html,<canvas width="800" height="500"></canvas><script>window.framesSeen=0;function draw(){framesSeen++;const c=document.querySelector("canvas").getContext("2d");c.fillStyle=framesSeen%2?"red":"blue";c.fillRect(0,0,800,500);requestAnimationFrame(draw)}draw()</script>');
  win.showInactive();await sleep(300);win.hide();await sleep(500);
  for(const allowed of [false,true,false]) {
    win.webContents.setBackgroundThrottling(allowed);
    win.showInactive();await sleep(100);win.hide();await sleep(1000);
    const n=await win.webContents.executeJavaScript("framesSeen");
    const s=await sample();
    const end=await win.webContents.executeJavaScript("({framesSeen,visibility:document.visibilityState})");
    const raf=await win.webContents.executeJavaScript("new Promise(r=>{let done=false;requestAnimationFrame(()=>requestAnimationFrame(()=>{done=true;r(true)}));setTimeout(()=>{if(!done)r(false)},1400)})");
    (report.samples??=[]).push({backgroundThrottling:allowed,...s,rafCount:end.framesSeen-n,visibility:end.visibility,twoRafOperationCompleted:raf});
  }
  win.destroy();
}
async function dashboard() {
  const fixture=process.argv[4];if(!fixture)throw Error("Dashboard requires offline fixture directory");
  const opening=JSON.parse(fs.readFileSync(path.join(fixture,"project-response.json"))),startup=opening.startup;
  const models={...JSON.parse(fs.readFileSync(path.join(fixture,"model-resources.json"))),...JSON.parse(fs.readFileSync(path.join(fixture,"plume-resources.json")))};
  const codes=JSON.parse(fs.readFileSync(path.join(fixture,"code-resources.json")));
  const canonical=s=>{const u=new URL(s,"https://plasmic-studio.shiguanglab.com");u.searchParams.sort();return u.pathname+u.search;};
  const codeMap=new Map(Object.entries(codes).map(([k,v])=>[canonical(k),v]));
  const studioOrigin="https://plasmic-studio.shiguanglab.com",ses=session.fromPartition("dashboard-seven");
  report.unknown=[];
  const remoteFetch=async req=>{
    const u=new URL(req.url),s=u.pathname;
    const headers={"Content-Type":"application/json","Access-Control-Allow-Origin":"*"};
    if(req.method!=="GET"&&req.method!=="HEAD")return new Response(null,{status:405});
    if(models[s])return new Response(models[s].body,{headers:{...headers,...models[s].headers}});
    const code=codeMap.get(canonical(req.url));if(code)return new Response(Buffer.from(code.body,"base64"),{headers:{...headers,...code.headers,"Content-Type":"application/javascript"}});
    if(s===`/api/v1/projects/${startup.projectId}`)return Response.json(opening,{headers});
    if(s==="/api/v1/hosts")return Response.json(startup.hosts,{headers});
    if(s==="/api/v1/app-config")return Response.json(startup.appConfig,{headers});
    if(s==="/api/v1/auth/self")return Response.json(startup.selfInfo,{headers});
    if(s==="/api/v1/latest-bundle-version")return Response.json({latestBundleVersion:startup.latestBundleVersion},{headers});
    if(!report.unknown.includes(s))report.unknown.push(s);return new Response("Offline asset missing",{status:404});
  };
  const fontDir=root+"/renderer/static/desktop-fonts";
  const bundledFontCss=fs.readdirSync(fontDir).filter(f=>f.endsWith(".css")).map(f=>fs.readFileSync(path.join(fontDir,f),"utf8")).join("\n");
  const handler=require(root+"/src/asset-handler.cjs").createAssetHandler({root:root+"/renderer",studioOrigin,bundledFontCss,
    canvasOrigin:"https://plasmic-canvas.shiguanglab.com",remoteFetch,previewHostPath:root+"/src/preview-host.html"});
  ses.protocol.handle("https",handler);ses.protocol.handle("http",remoteFetch);
  ses.webRequest.onBeforeRequest({urls:["ws://*/*","wss://*/*"]},(_d,cb)=>cb({cancel:true}));
  const parent=new BrowserWindow({show:false,webPreferences:{session:ses,backgroundThrottling:false}});
  await parent.loadURL("data:text/html,Dashboard diagnostic");
  let invoke;const handle=ipcMain.handle.bind(ipcMain);
  ipcMain.handle=(name,fn)=>{if(name==="desktop:dashboard-preview")invoke=fn;return handle(name,fn);};
  const previews=require(root+"/src/dashboard-preview.cjs").createDashboardPreviews({session:ses,studioOrigin,trustedSender:e=>e.sender===parent.webContents});
  ipcMain.handle=handle;
  const request={projectId:startup.projectId,revision:opening.rev.revision,flags:startup.appConfig.config,staticBaseUrl:studioOrigin+"/static"};
  const src=studioOrigin+"/canvas-preview/index.html#live=true&origin="+encodeURIComponent(studioOrigin)+"&staticBaseUrl="+encodeURIComponent(request.staticBaseUrl);
  report.samples=[];
  for(const scale of [2,1,2,2,2,2,2,2,2,2,2,2]) {
    let peak=0,peakProcesses=0,peakWindows=0;
    const timer=setInterval(()=>{const all=metrics();peak=Math.max(peak,all.reduce((n,p)=>n+p.rssKiB,0)/1024);peakProcesses=Math.max(peakProcesses,all.length);peakWindows=Math.max(peakWindows,BrowserWindow.getAllWindows().length);},50);
    const start=performance.now();let bytes;
    try{bytes=await invoke({sender:parent.webContents},crypto.randomUUID(),src,request,scale);}finally{clearInterval(timer);}
    const ms=performance.now()-start;
    const image=require("electron").nativeImage.createFromBuffer(Buffer.from(bytes));assert(!image.isEmpty());
    await sleep(700);
    report.samples.push({scale,ms,outputBytes:bytes.length,pixelHash:hash(image.toBitmap()),imageSize:image.getSize(),peakRssSumMiB:peak,peakProcesses,peakWindows,
      windowsAfter:BrowserWindow.getAllWindows().length,after:metrics()});
    assert.equal(BrowserWindow.getAllWindows().length,1);
  }
  report.afterIdle=await sample(undefined,6000);
  previews.dispose();parent.destroy();
}
async function lease() {
  const {EventEmitter}=require("node:events");
  const {screen}=require("electron");screen.getCursorScreenPoint=()=>({x:-10000,y:-10000});
  const {IslandActivity}=require(root+"/src/island-activity.cjs");
  const {createIsland}=require(root+"/src/island.cjs");
  const ses=session.fromPartition("lease-seven");
  ses.protocol.handle("https",()=>new Response('<!doctype html><style>body{margin:0;font:18px system-ui}</style><div class="live-root-container" data-plasmic-preview-component="page">客户评论查询</div>',{headers:{"Content-Type":"text/html;charset=utf-8"}}));
  const main=new BrowserWindow({show:false,width:1100,height:760,webPreferences:{session:ses,backgroundThrottling:false}});
  const activity=new IslandActivity();let refreshes=0,captures=0;
  const originalCapture=main.webContents.capturePage.bind(main.webContents);
  main.webContents.capturePage=(...args)=>{captures++;return originalCapture(...args);};
  const identity=Object.assign(new EventEmitter(),{read:async()=>({user:{id:"fixture",firstName:"诊断"}})});
  const controller={activity,state:async()=>{refreshes++;return {url:main.webContents.getURL(),ready:true,projectId:"p",editorContext:{mode:"preview",previewKind:"in-app",projectName:"诊断",componentName:"客户评论",saveStatus:"saved",sessionId:"s",changeCounter:0,previewContext:{componentUuid:"page",path:"/comments",width:1100,height:760}}};},requestStudio:async()=>({teams:[],workspaces:[]})};
  const island=createIsland({getWindow:()=>main,controller,identity,...ui(),config:{studioOrigin:"https://lease.test"},isQuitting:()=>false});
  try {
    island.attach(main);await main.loadURL("https://lease.test/projects/p/preview");await island.setMode("island");
    activity.enqueue("read","execute",{name:"read"});activity.start("read");
    for(let i=0;i<50&&!island.snapshot().image?.src;i++)await sleep(100);
    assert(island.snapshot().image?.src);activity.finish("read");await sleep(800);
    const startRefreshes=refreshes,startCaptures=captures;
    report.postOperationIdle=await sample(undefined,6000);
    report.postOperationIdle.refreshes=refreshes-startRefreshes;report.postOperationIdle.newPixelCaptures=captures-startCaptures;
    report.postOperationIdle.activeOperations=activity.operations.size;
    report.postOperationIdle.expanded=island.snapshot().expanded;
    report.postOperationIdle.leaseRemainingMs=activity.idleUntil-performance.now();
    assert(island.snapshot().expanded);assert.equal(activity.operations.size,0);
    activity.dismissExpansion();await sleep(150);
    assert.equal(island.snapshot().expanded,false);
    const previous=captures;report.dismissed=await sample();report.dismissed.newPixelCaptures=captures-previous;
    assert.equal(captures,previous);
  }finally{island.dispose();main.destroy();}
}
async function capture() {
  const ses=session.fromPartition("capture-seven"),canvasKind=process.env.PLASMIC_PERF_CANVAS||"2d";
  assert(["2d","webgl"].includes(canvasKind));report.canvasKind=canvasKind;
  let canvas=false;
  ses.protocol.handle("https",req=>new Response(new URL(req.url).pathname==="/board"?
    `<!doctype html><html data-plasmic-render-ready><style>body{margin:0;font:14px system-ui}p{margin:0}</style><body>${canvas?'<canvas id="chart" width="640" height="300"></canvas>':''}<div id="business">客户评论</div>${"<p>客户名称 评论内容 处理状态 已完成</p>".repeat(1000)}<script>
      window.drawChart=color=>{const canvas=document.querySelector('canvas');if(!canvas)return;
        if(${JSON.stringify(canvasKind)}==='webgl'){const gl=canvas.getContext('webgl',{preserveDrawingBuffer:true});if(!gl)throw Error('WebGL unavailable');const c=Array.isArray(color)?color:color==='red'?[1,0,0]:[0,128/255,0];gl.clearColor(...c,1);gl.clear(gl.COLOR_BUFFER_BIT);}
        else{const c=canvas.getContext('2d');c.fillStyle=Array.isArray(color)?'rgb('+color.map(x=>x*255).join(',')+')':color;c.fillRect(0,0,640,300);}};
      drawChart('green');window.canvasReads=0;const original=HTMLCanvasElement.prototype.toDataURL;HTMLCanvasElement.prototype.toDataURL=function(...args){canvasReads++;return original.apply(this,args)};
    </script></body></html>`:
    `<!doctype html><style>body{margin:0}.canvas-editor__canvas-clipper{width:1000px;height:700px}</style><div class="canvas-editor__canvas-clipper"><iframe class="canvas-editor__viewport" data-plasmic-frame-uuid="f" data-plasmic-component-uuid="c" style="width:900px;height:650px;border:0" src="/board"></iframe></div>${'<iframe src="about:blank" style="display:none"></iframe>'.repeat(16)}`,
    {headers:{"Content-Type":"text/html;charset=utf-8"}}));
  const win=new BrowserWindow({show:false,width:1100,height:760,webPreferences:{session:ses,backgroundThrottling:false}});
  const context={projectId:"p",sessionId:"s",arenaId:"a",mode:"edit",changeCounter:0};report.samples=[];
  for(const withCanvas of [false,true]) {
    canvas=withCanvas;await win.loadURL("https://capture.test/projects/p");await sleep(500);
    const board=win.webContents.mainFrame.frames[0];report.stage={withCanvas,step:"initial"};
    let snapshots=0,htmlBytes=0,inspectCalls=0,tailFrameCalls=0;const restores=[];
    for(const f of win.webContents.mainFrame.framesInSubtree) {
      const original=f.executeJavaScript.bind(f);
      f.executeJavaScript=async(script,...args)=>{
        if(script.includes("inspectScene")){inspectCalls++;if(f!==win.webContents.mainFrame&&f!==board)tailFrameCalls++;}
        const value=await original(script,...args);
        if(/^\(function snapshotDocument\(/.test(script)){snapshots++;htmlBytes+=Buffer.byteLength(value);}return value;
      };restores.push(()=>{f.executeJavaScript=original;});
    }
    const mirror=require(root+"/src/island-capture.cjs").createIslandCapture(),first=await mirror.capture(win,context,undefined,[]);
    assert(first?.src);snapshots=htmlBytes=inspectCalls=tailFrameCalls=0;await board.executeJavaScript("canvasReads=0;true");
    report.stage.step="sampling";const latencies=[];let last;
    const measured=await sample(async()=>{const start=performance.now();last=await mirror.capture(win,context,undefined,[]);latencies.push(performance.now()-start);},4500);
    const idleSnapshots=snapshots,idleHtmlBytes=htmlBytes,idleCanvasReads=await board.executeJavaScript("canvasReads");
    assert.equal(first.src,last.src);report.stage.step="dom-change";
    await board.executeJavaScript("document.querySelector('#business').textContent='已更新';true");await sleep(200);
    const changed=await mirror.capture(win,context,undefined,[]);assert.notEqual(changed.src,last.src);
    let canvasChanged=null,continuousDomChangeDetected=null,animatedCanvasChangeDetected=null;
    if(withCanvas){
      report.stage.step="canvas-change";await board.executeJavaScript("drawChart('red');true");await sleep(200);
      const next=await mirror.capture(win,context,undefined,[]);canvasChanged=next.src!==changed.src;assert(canvasChanged);
      await board.executeJavaScript("window.__diagnosticChanges=0;window.__diagnosticTimer=setInterval(()=>{document.querySelector('#business').textContent='运行中 '+(++window.__diagnosticChanges)},80);true");
      await sleep(250);const a=await mirror.capture(win,context,undefined,[]);await sleep(250);const b=await mirror.capture(win,context,undefined,[]);
      await board.executeJavaScript("clearInterval(window.__diagnosticTimer);true");continuousDomChangeDetected=a.src!==b.src;assert(continuousDomChangeDetected);
      report.stage.step="canvas-animation";
      await board.executeJavaScript("window.chartTicks=0;window.__chartTimer=setInterval(()=>drawChart([(++chartTicks%200)/200,0.3,0.1]),60);true");
      await sleep(250);const c=await mirror.capture(win,context,undefined,[]);await sleep(250);const d=await mirror.capture(win,context,undefined,[]);
      await board.executeJavaScript("clearInterval(window.__chartTimer);true");animatedCanvasChangeDetected=c.src!==d.src;assert(animatedCanvasChangeDetected);
    }
    report.samples.push({withCanvas,...measured,idleSnapshots,idleHtmlBytes,idleCanvasReads,inspectCalls,tailFrameCalls,
      captureMsMean:latencies.reduce((a,b)=>a+b,0)/latencies.length,stableSame:true,domChangeDetected:true,
      canvasChangeDetected:canvasChanged,continuousDomChangeDetected,animatedCanvasChangeDetected,lastPixelHash:hash(last.src)});
    mirror.reset();for(const restore of restores)restore();
  }
  win.destroy();
}
app.whenReady().then(async()=>{
  if(mode==="reference")await reference();
  else if(mode==="hidden")await hidden();
  else if(mode==="capture")await capture();
  else if(mode==="dashboard")await dashboard();
  else if(mode==="lease")await lease();
  else throw Error("Unknown mode");
}).catch(e=>{report.error={message:e?.message||String(e),stack:e?.stack,keys:Object.keys(e||{})};console.error(e);process.exitCode=1;}).finally(()=>{
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
  for(const w of BrowserWindow.getAllWindows())w.destroy();
  fs.rmSync(profile,{recursive:true,force:true});console.log(JSON.stringify({mode,passed:!report.error,error:report.error?.message,output}));app.exit(process.exitCode||0);
});
setTimeout(()=>{report.error={message:"Diagnostic timeout"};fs.writeFileSync(output,JSON.stringify(report,null,2));app.exit(2);},120000).unref();
