const {app,BrowserWindow,screen}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {EventEmitter}=require('node:events');
const mode=process.argv[2],output=process.argv[3];
if(!['before','after'].includes(mode))throw new Error('Invalid mode');
const impl=path.join(__dirname,mode,'src');
const {createIsland}=require(path.join(impl,'island.cjs'));
const {IslandActivity}=require(path.join(impl,'island-activity.cjs'));
const {createDesktopI18n}=require(path.join(impl,'i18n.cjs'));
const {createDesktopAppearance}=require(path.join(impl,'ui-appearance.cjs'));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'island-benefit-profile-'));
app.setPath('userData',profile);app.on('window-all-closed',()=>{});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(fn)=>{const end=Date.now()+8000;while(Date.now()<end){if(await fn())return;await sleep(20);}throw new Error('Fixture timed out');};
let main,presentation,traffic=[],recording=false,summaryRequests=0;
app.on('browser-window-created',(_,win)=>{const send=win.webContents.send.bind(win.webContents);win.webContents.send=(channel,...args)=>{if(recording&&channel==='desktop:island-state')traffic.push(args[0]);return send(channel,...args);};});
function metrics(){return app.getAppMetrics().map(p=>({pid:p.pid,type:p.type,cpuSeconds:p.cpu.cumulativeCPUUsage,rssKiB:p.memory.workingSetSize}));}
async function sample(label,action){
 traffic=[];const startRequests=summaryRequests;const start=metrics();const now=performance.now();recording=true;
 const samples=[];if(action)await action();
 while(performance.now()-now<3000){await sleep(500);samples.push(metrics());}
 const durationMs=performance.now()-now,end=samples.at(-1);recording=false;
 const cpuSeconds=end.reduce((sum,p)=>{const prev=start.find(x=>x.pid===p.pid);return sum+(prev&&Number.isFinite(p.cpuSeconds)&&Number.isFinite(prev.cpuSeconds)?Math.max(0,p.cpuSeconds-prev.cpuSeconds):0);},0);
 const totals=samples.map(row=>row.reduce((sum,p)=>sum+p.rssKiB,0));
 return {label,durationMs,messages:traffic.length,jsonEquivalentBytes:traffic.reduce((n,v)=>n+Buffer.byteLength(JSON.stringify(v)),0),pixelMessages:traffic.filter(v=>v.image&&Object.hasOwn(v.image,'src')).length,pixelBytes:traffic.reduce((n,v)=>n+Buffer.byteLength(v.image?.src||''),0),summaryRequests:summaryRequests-startRequests,cpuOneCorePercent:cpuSeconds/(durationMs/1000)*100,rssSumMiB:totals.reduce((a,b)=>a+b,0)/totals.length/1024,processes:end};
}
app.whenReady().then(async()=>{
 screen.getCursorScreenPoint=()=>({x:-10000,y:-10000});
 const session=require('electron').session.fromPartition('benefit');
 session.protocol.handle('https',()=>new Response('<!doctype html><html><head><style>body{margin:0;background:#f5f5f5;font:16px -apple-system}.live-root-container{padding:40px}table{background:white;border-collapse:collapse}td,th{padding:20px;border:1px solid #ccc}</style></head><body><div class="live-root-container" data-plasmic-preview-component="page"><h2>客户评论查询</h2><table><tr><th>客户</th><th>评论</th><th>状态</th></tr><tr><td>示例客户</td><td>测试内容</td><td>已处理</td></tr></table></div></body></html>',{headers:{'Content-Type':'text/html;charset=utf-8'}}));
 main=new BrowserWindow({show:false,width:1100,height:760,webPreferences:{session,nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 const activity=new IslandActivity();const identity=Object.assign(new EventEmitter(),{read:async()=>({user:{id:'fixture',firstName:'测试账户'}})});
 const controller={activity,state:async()=>({url:main.webContents.getURL(),ready:true,projectId:'p',editorContext:{mode:'preview',previewKind:'in-app',projectName:'测试项目',componentName:'客户评论查询',saveStatus:'saved',sessionId:'s',changeCounter:0,previewContext:{componentUuid:'page',path:'/comments',width:1100,height:760}}}),requestStudio:async url=>{summaryRequests++;return url.includes('projects?')?{projects:[{id:'p'}]}:{teams:[],workspaces:[]};}};
 const i18n=createDesktopI18n(path.join(__dirname,'ui-locales'),['zh-CN']);
 presentation=createIsland({getWindow:()=>main,controller,identity,i18n,appearance:createDesktopAppearance('dark'),config:{studioOrigin:'https://benefit.test'},isQuitting:()=>false});presentation.attach(main);
 const url='https://benefit.test/projects/p/preview';await main.loadURL(url);
 await presentation.setMode('island');await until(()=>presentation.snapshot().context.allowed&&!presentation.snapshot().context.loading);await sleep(1400);
 const collapsed=await sample('collapsed-idle');
 activity.enqueue('hold','execute',{name:'read'});activity.start('hold');activity.bind('hold',{projectId:'p',sessionId:'s',mode:'preview'},url);
 await until(()=>presentation.snapshot().image?.src);await sleep(1000);
 const expanded=await sample('expanded-static');
 const island=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/island.html'));
 const islandPid=island.webContents.getOSProcessId();
 const exitStart=performance.now();await presentation.setMode('window');const exitMs=performance.now()-exitStart;activity.finish('hold');await sleep(1000);
 const exited=await sample('exited-with-three-navigations',async()=>{for(const suffix of ['?route=1','?route=2','']){await main.webContents.executeJavaScript(`history.replaceState({},'',${JSON.stringify(url+suffix)});true`);await sleep(100);}});
 const reopenStart=performance.now();await presentation.setMode('island');const reopenWindowMs=performance.now()-reopenStart;
 await until(()=>presentation.snapshot().image?.src);const reopened=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/island.html'));
 await until(()=>reopened.webContents.executeJavaScript("!document.getElementById('mirror').hidden && document.getElementById('mirror').naturalWidth>0"));
 const reopenImageMs=performance.now()-reopenStart;
 const result={mode,electron:process.versions.electron,platform:process.platform,collapsed,expanded,exited,islandPid,islandDestroyedAfterExit:!exited.processes.some(p=>p.pid===islandPid),exitMs,reopenWindowMs,reopenImageMs};
 fs.writeFileSync(output,JSON.stringify(result,null,2));presentation.dispose();main.destroy();fs.rmSync(profile,{recursive:true,force:true});app.exit(0);
}).catch(error=>{console.error(error);presentation?.dispose();if(main&&!main.isDestroyed())main.destroy();fs.rmSync(profile,{recursive:true,force:true});app.exit(1);});
