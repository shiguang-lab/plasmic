const { app, BrowserWindow } = require('electron');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { sendCdp } = require('../../src/cdp.cjs');
const fixture = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]);
const captureSnapshots = !process.argv.includes('--summary-only');
fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'plasmic-retention-profile-'));
app.setPath('userData',profile);let win;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const watchdog=setTimeout(()=>app.exit(2),90000);
app.whenReady().then(async()=>{
 win=new BrowserWindow({show:false,width:1000,height:600,webPreferences:{sandbox:true,contextIsolation:true,backgroundThrottling:false}});
 await win.loadFile(path.join(fixture,'index.html'));
 const evaluate=source=>win.webContents.executeJavaScript(source);
 const stats=[];
 async function collect(label,snapshot=false){
  await sleep(100); await sendCdp(win.webContents,'HeapProfiler.collectGarbage');
  stats.push({label,...await evaluate('__retention.stats()'),heap:await sendCdp(win.webContents,'Runtime.getHeapUsage'),metrics:app.getAppMetrics().map(p=>({pid:p.pid,type:p.type,rssKiB:p.memory.workingSetSize}))});
  if(snapshot){
   const file=fs.openSync(path.join(out,label+'.heapsnapshot'),'w');
   const listener=(_,method,params)=>{if(method==='HeapProfiler.addHeapSnapshotChunk')fs.writeSync(file,params.chunk)};
   win.webContents.debugger.on('message',listener);
   try{await sendCdp(win.webContents,'HeapProfiler.takeHeapSnapshot',{reportProgress:false});}
   finally{win.webContents.debugger.off('message',listener);fs.closeSync(file);}
  }
 }
 // Warm Monaco/editor initialization, then take a stable baseline.
 await evaluate('__retention.open();true');await sleep(500);await evaluate('__retention.close();true');
 await collect('baseline',captureSnapshots);
 await evaluate('__retention.open();true');await sleep(200);await collect('target',captureSnapshots);
 await evaluate('__retention.close();true');await collect('final',captureSnapshots);
 for(let i=0;i<10;i++){await evaluate('__retention.open();true');await sleep(40);await evaluate('__retention.close();true');await collect('cycle-'+(i+1));}
 let activeEditorRegression;
 if(process.argv[4]==='--verify'){await evaluate('__retention.open();true');await sleep(150);activeEditorRegression=await evaluate('__retention.closeOneAndEdit()');if(activeEditorRegression.models!==5||activeEditorRegression.extraLibs!==3)throw Error('Other editor resources changed: '+JSON.stringify(activeEditorRegression));await evaluate('__retention.close();true');}
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({activeEditorRegression,electron:process.versions.electron,scope:'Focused real-source lifecycle fixture, not full Studio. GC/snapshots separate from timing. RSS includes native allocations.',stats},null,2));
 console.log(JSON.stringify(stats.map(s=>({label:s.label,envIds:s.envIds,fullKeys:s.fullKeys,models:s.models.length,modelChars:s.models.reduce((n,m)=>n+m.chars,0),deletedArgumentCount:s.deletedArgumentCount,jsHeap:s.heap.usedSize}))));
}).catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{clearTimeout(watchdog);win?.destroy();fs.rmSync(profile,{recursive:true,force:true});app.exit(process.exitCode||0)});
