// Native eligibility probe. All documents and profiles are isolated fixtures.
// electron spare-renderer-probe.cjs <off|on> <default|persistent> <plain|arguments> <output>
const { app, BrowserWindow, session } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { StudioWindow } = require('../../src/studio-window.cjs');
const [policy, partition, preferences, output] = process.argv.slice(2);
assert(['off','on'].includes(policy));
assert(['default','persistent'].includes(partition));
assert(['plain','arguments'].includes(preferences));
app.commandLine.appendSwitch(policy === 'on' ? 'enable-features' : 'disable-features', 'SpareRendererForSitePerProcess');
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(),'spare-probe-')));
const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
const processes = () => app.getAppMetrics().map(p => ({pid:p.pid,type:p.type,rssKiB:p.memory.workingSetSize}));
const report = {electron:process.versions.electron,policy,partition,preferences,points:[],opens:[]};
let win;
const timer=setTimeout(()=>app.exit(2),30000);
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
  app.setActivationPolicy?.('accessory');
  const ses = partition === 'default' ? session.defaultSession : session.fromPartition('persist:spare-probe');
  ses.protocol.handle('https', () => new Response('<html><body>Probe</body></html>', {headers:{'Content-Type':'text/html'}}));
  await pause(500);
  report.points.push({label:'before-owner',processes:processes()});
  const webPreferences={session:ses,sandbox:true,contextIsolation:true,nodeIntegration:false,...(preferences==='arguments'?{additionalArguments:[`--shiguang-system-languages=${JSON.stringify(app.getPreferredSystemLanguages())}`]}:{})};
  win=new BrowserWindow({show:false,webPreferences});
  const studio=new StudioWindow(win,{webPreferences,studioOrigin:'https://probe.test',projectId:url=>new URL(url||'about:blank').pathname.match(/^\/projects\/(.+)/)?.[1],backgroundColor:'#fff',beforeNavigate:async()=>{}});
  const created=[];
  studio.on('contents-created',c=>created.push({contentsId:c.id,pidAtCreation:c.getOSProcessId()}));
  await studio.loadURL('https://probe.test/projects');
  await pause(500);
  for(let i=0;i<5;i++){
    const before=processes();
    const start=performance.now();
    await studio.loadURL('https://probe.test/projects/example');
    const pid=studio.webContents.getOSProcessId();
    report.opens.push({iteration:i+1,loadMs:performance.now()-start,pid,reusedExistingProcess:before.some(p=>p.pid===pid),created:created.at(-1),before});
    await studio.loadURL('https://probe.test/projects');
    await pause(500);
    const returned=processes();
    assert(!returned.some(p=>p.pid===pid),'Old editor renderer survived');
    report.points.push({label:'returned-'+i,processes:returned});
  }
}).catch(e=>{report.error=e.stack;process.exitCode=1;}).finally(()=>{
  clearTimeout(timer);fs.writeFileSync(output,JSON.stringify(report,null,2));win?.destroy();app.exit(process.exitCode||0);
});
