// Reuses the offline production-Studio harness, with a fresh private directory.
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),Module=require("node:module"),assert=require("node:assert/strict");
const {app}=require("electron");
const root=path.resolve(__dirname,"../.."),fixture=process.argv[2],output=path.resolve(process.argv[3]);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const privateDir=fs.mkdtempSync(path.join(os.tmpdir(),"plasmic-seven-studio-"));
for(const name of ["project-response.json","model-resources.json","plume-resources.json","plume-opening.json","code-resources.json","build-baseline"])
  fs.symlinkSync(path.join(fixture,name),path.join(privateDir,name));
process.argv[2]=privateDir;process.argv[3]="baseline";
process.env.PERF_RUN_ID="seven";
exports.run=async({frame,win})=>{
  const report={scope:"offline production Studio renderer; synthetic 120-node project; current Desktop capture source",electron:process.versions.electron,
    privateArtifacts:privateDir,samples:[]};
  const metrics=()=>app.getAppMetrics().map(p=>({pid:p.pid,type:p.type,cpu:p.cpu.cumulativeCPUUsage,rssKiB:p.memory.workingSetSize}));
  const {createIslandCapture}=require(root+"/src/island-capture.cjs");
  const mirror=createIslandCapture(),context={mode:"edit",projectId:"fixture",sessionId:"s",changeCounter:0};
  try {
    const first=await mirror.capture(win,context,undefined,[]);assert(first?.src,"Actual Studio must yield an island image");
    let snapshots=0,sceneInspections=0,bytes=0;const restore=[];
    for(const f of win.webContents.mainFrame.framesInSubtree){const original=f.executeJavaScript.bind(f);
      f.executeJavaScript=async(script,...args)=>{const v=await original(script,...args);if(/^\(function snapshotDocument\(/.test(script)){snapshots++;bytes+=Buffer.byteLength(v);}if(script.includes("function inspectScene"))sceneInspections++;return v;};restore.push(()=>{f.executeJavaScript=original;});}
    const start=performance.now(),before=metrics();let last,latencies=[];
    for(let i=0;i<10;i++){const t=performance.now();last=await mirror.capture(win,context,undefined,[]);latencies.push(performance.now()-t);await sleep(500);}
    const durationMs=performance.now()-start,after=metrics();
    const cpuMs=after.reduce((n,p)=>{const prev=before.find(x=>x.pid===p.pid);return n+(prev?Math.max(0,p.cpu-prev.cpu)*1000:0);},0);
    report.staticCapture={durationMs,ticks:10,snapshots,htmlBytes:bytes,sceneInspections,meanMs:latencies.reduce((a,b)=>a+b,0)/latencies.length,
      cpuOneCorePercent:cpuMs/durationMs*100,cachedPixelsSame:first.src===last.src,frameCount:win.webContents.mainFrame.framesInSubtree.length};
    for(const restoreFrame of restore)restoreFrame();mirror.reset();
    for(const throttle of [false,true,false]) {
      win.webContents.setBackgroundThrottling(throttle);win.showInactive();await sleep(150);win.hide();await sleep(500);
      const r=await frame.executeJavaScript("new Promise(resolve=>{let done=false;requestAnimationFrame(()=>requestAnimationFrame(()=>{done=true;resolve({rafCompleted:true,visibility:document.visibilityState})}));setTimeout(()=>{if(!done)resolve({rafCompleted:false,visibility:document.visibilityState})},1200)})");
      report.samples.push({backgroundThrottling:throttle,...r});
    }
    win.webContents.setBackgroundThrottling(false);
    report.functional=await frame.executeJavaScript(`(async()=>{const s=studioCtx,c=s.site.pageArenas[0].component,before=c.name;await s.changeUnsafe(()=>s.siteOps().tryRenameArenas([{arena:s.site.pageArenas[0],newName:before+'Diagnostic'}]));if(c.name===before)throw Error('Rename failed');await s.undo();if(c.name!==before)throw Error('Undo failed');await s.redo();if(c.name===before)throw Error('Redo failed');await s.undo();await s.awaitStudioReady();return {rename:true,undo:true,redo:true,restored:c.name===before,hidden:document.visibilityState}})()`);
  }catch(e){report.error={message:e?.message||String(e),stack:e?.stack};throw e;}
  finally{mirror.reset();fs.writeFileSync(output,JSON.stringify(report,null,2));}
  return {report:output};
};
const filename=path.join(__dirname,"studio-optimization-fixture.cjs");
let source=fs.readFileSync(filename,"utf8");
const marker="    await sleep(3000);\n    report.stable";
assert(source.includes(marker));
source=source.replace(marker,`    report.seven=await require(${JSON.stringify(__filename)}).run({frame,win});\n    return;\n    await sleep(3000);\n    report.stable`);
source=source.replace('      show: true,','      show: false,');
const harness=new Module(filename,module);harness.filename=filename;harness.paths=Module._nodeModulePaths(path.dirname(filename));
harness._compile(source,filename);
