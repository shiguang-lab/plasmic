// Real Chromium CSS iterations; isolated profile and fixture-only IPC.
const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'plasmic-scan-cycle-'));
app.setPath('userData',profile);
app.on('window-all-closed',()=>{});
let win,state;
ipcMain.handle('desktop:presentation',()=>state);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const watchdog=setTimeout(()=>{console.error('Scan cycle test timed out');app.exit(1);},45000);
async function until(check,label){
 const end=Date.now()+7000;
 while(Date.now()<end){if(await check())return;await pause(20);}
 throw Error(label);
}
app.whenReady().then(async()=>{
 state={expanded:true,context:{allowed:true,loading:false,identity:'initial',mode:'edit'},activity:{},appearance:'dark',update:{phase:'disabled'}};
 win=new BrowserWindow({width:456,height:180,show:false,webPreferences:{preload:path.join(__dirname,'../src/island-preload.cjs'),sandbox:true,contextIsolation:true,backgroundThrottling:false,offscreen:true}});
 await win.loadFile(path.join(__dirname,'../src/island.html'));
 const inspect=source=>win.webContents.executeJavaScript(source);
 for(const [kind,result]of [['read','completed'],['write','failed']]){
  const id=kind+'-operation';
  state={...state,context:{...state.context,identity:id},image:{identity:id,width:400,height:300,src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=',feedback:{id,kind,regions:[{x:0,y:0,width:1,height:1}]}},activity:{operation:{id,kind,phase:'running'}}};
  win.webContents.send('desktop:island-state',state);
  const selector=kind==='read'?'.feedback-sweep':'.feedback-region';
  await until(()=>inspect(`!!document.querySelector('${selector}')?.getAnimations().length`),'CSS scan must start');
  const duration=await inspect(`(()=>{
   window.scan=document.querySelector('${selector}');window.group=scan.closest('.feedback-operation');
   window.scanAnimation=scan.getAnimations()[0];window.cycleDuration=scanAnimation.effect.getTiming().duration;
   window.completedCycles=[];scan.addEventListener('animationiteration',event=>completedCycles.push(event.elapsedTime));
   scanAnimation.pause();scanAnimation.currentTime=cycleDuration*2.3;
   return cycleDuration;
  })()`);
  await pause(50);
  state={...state,activity:{operation:{id,kind,phase:result}}};
  win.webContents.send('desktop:island-state',state);
  await pause(100);
  assert.equal(await inspect("scan.isConnected && group.dataset.phase==='running' && scanAnimation.playState==='paused'"),true,'operation completion cannot cancel the active CSS iteration');
  await inspect('scanAnimation.play();true');
  await until(()=>inspect("group.dataset.phase==='completed'"),'current iteration must finish before result fade');
  const cycles=await inspect('completedCycles');
  assert.ok(cycles.some(elapsed=>Math.abs(elapsed-duration*3/1000)<.01),`expected cycle boundary ${duration*3/1000}, got ${cycles}`);
  assert.equal(await inspect('scan.isConnected'),true,'result remains through its finite fade');
  await until(()=>inspect("document.getElementById('feedback').hidden"),'fade must eventually remove feedback');
  console.log(`${kind}: ${result} retains the scan until a real CSS iteration boundary`);
 }
 clearTimeout(watchdog);win.destroy();fs.rmSync(profile,{recursive:true,force:true});app.exit(0);
}).catch(error=>{console.error(error);clearTimeout(watchdog);if(win&&!win.isDestroyed())win.destroy();fs.rmSync(profile,{recursive:true,force:true});app.exit(1);});
