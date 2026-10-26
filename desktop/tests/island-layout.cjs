const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'plasmic-island-layout-'));
app.setPath('userData',profile);
app.on('window-all-closed',()=>{});
const canvas={allowed:true,mode:'edit',projectName:'采购管理系统 Enterprise Purchasing',viewName:'跨部门采购审批与预算占用明细',projectSummary:{pages:1234,components:6789,artboards:12,canvases:5,images:42,libraries:3},saveStatus:'saved'};
const user={name:'梁彦先',email:'designer@example.test'};
const account={status:'ready',user,teams:[{id:'t',name:'数禾科技'}],workspaces:[{id:'w',teamId:'t',name:'业务中台工作区',projects:6,members:8}],counts:{organizations:2,workspaces:5,projects:18}};
const task={title:'调整采购审批列表、筛选条件与权限设置',status:'running',stage:'逐项检查筛选区域、分页及表格字段的布局',stageIndex:10,stageCount:12};
const op=(kind,phase='running',extra={})=>({operation:{kind,phase,startedAt:new Date(Date.now()-12000).toISOString(),...extra}});
const cases=[
 ['idle',{}],
 ...['pending','saving','error','blocked','unlogged'].map(saveStatus=>['save-'+saveStatus,{context:{...canvas,saveStatus}}]),
 ['preview',{context:{...canvas,mode:'preview',previewContext:{width:390,height:844}}}],
 ['loading',{context:{...canvas,loading:true,viewName:'',saveStatus:null,projectSummary:null}}],
 ['no-canvas',{context:{...canvas,viewName:''}}],
 ...['read','write','save','view','preview'].map(kind=>[kind,{activity:op(kind)}]),
 ['queued',{activity:{...op('write','queued'),queued:12}}],
 ['stages',{activity:{task,queued:12,running:2},context:{...canvas,saveStatus:'pending'}}],
 ['failed',{activity:op('write','failed',{error:'Technical details: element not found. Please inspect the editor.'})}],
 ['task-failed',{activity:{...op('read','completed'),task:{...task,status:'failed',error:'筛选区域仍然溢出，请检查字段宽度。'}}}],
 ['task-blocked',{activity:{task:{...task,status:'blocked',error:'需要项目编辑权限才能继续。'}}}],
 ['completed',{activity:op('write','completed'),context:{...canvas,saveStatus:'pending'}}],
 ['task-completed',{activity:{task:{...task,status:'completed',stageIndex:12}}}],
 ['account',{context:{allowed:false,account,workspaceId:'w'}}],
 ['account-zero',{context:{allowed:false,account:{...account,counts:{organizations:0,workspaces:0,projects:0}}}}],
 ['account-loading',{context:{allowed:false,account:{status:'loading'}}}],
 ['statistics-loading',{context:{allowed:false,account:{status:'loading',user}}}],
 ['statistics-error',{context:{allowed:false,account:{status:'error',user}}}],
 ['signed-out',{context:{allowed:false,account:{status:'signed-out'}}}],
 ['signed-out-failure',{context:{allowed:false,account:{status:'signed-out'}},activity:op('resource','failed',{error:'Sign-in required'})}],
 ['resource',{context:{allowed:false,account},activity:op('resource','running',{label:'Generating image'})}],
 ...['idle','checking','available','downloading','downloaded','installing','current','disabled','error'].map(phase=>['update-'+phase,{updateOpen:true,update:{phase,currentVersion:'0.2.17',version:'0.2.18',percent:42}}]),
 ['install-waiting',{updateOpen:true,update:{phase:'installing',currentVersion:'0.2.17',version:'0.2.18'},updateWaiting:true}],
];
let win,state;
ipcMain.handle('desktop:presentation',()=>state);
const watchdog=setTimeout(()=>{console.error('Island layout check timed out');app.exit(1)},60000);
app.whenReady().then(async()=>{
 state={mode:'island',expanded:true,context:canvas,activity:{},appearance:'dark',update:{phase:'disabled'}};
 win=new BrowserWindow({width:456,height:180,show:false,frame:false,transparent:true,hasShadow:false,webPreferences:{preload:path.join(__dirname,'../src/island-preload.cjs'),sandbox:true,contextIsolation:true,backgroundThrottling:false,offscreen:true}});
 await win.loadFile(path.join(__dirname,'../src/island.html'));
 const inspect=source=>win.webContents.executeJavaScript(source);
 // This suite checks settled layout; island-native.cjs exercises real transitions.
 await inspect('window.matchMedia=()=>({matches:true});true');
 await win.webContents.insertCSS('*,*::before,*::after{transition:none!important;animation:none!important}');
 let checked=0;
 for(const appearance of ['dark','light'])for(const locale of ['en','zh-CN','zh-TW','ja','ko']){
  const messages=JSON.parse(fs.readFileSync(path.join(__dirname,'../../platform/wab/src/wab/client/i18n/locales',locale+'.json')));
  for(const [name,patch]of cases){
   state={mode:'island',expanded:true,context:canvas,activity:{},appearance,localization:{locale,messages},image:null,stale:false,updateOpen:false,updateWaiting:false,update:{phase:'disabled'},...patch};
   win.webContents.send('desktop:island-state',state);
   await inspect('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
   const result=await inspect(`(()=>{
    const el=id=>document.getElementById(id),rect=node=>node.getBoundingClientRect(),shell=rect(el('shell'));
    const visible=node=>node.checkVisibility({checkVisibilityCSS:true})&&!node.closest('[hidden],[inert]');
    const within=(node,box)=>{const r=rect(node);return r.left>=box.left-.5&&r.right<=box.right+.5&&r.top>=box.top-.5&&r.bottom<=box.bottom+.5};
    const main=rect(document.querySelector('.main')),left=rect(document.querySelector('.info')),right=rect(document.querySelector('.right')),header=rect(el('drag-handle')),footer=rect(document.querySelector('.info-footer')),visual=rect(document.querySelector('.visual'));
    const errors=[];
    for(const node of document.querySelectorAll('button,.statistics,.identity,.info-footer'))if(visible(node)&&!within(node,shell))errors.push(node.id||node.className);
    if(!el('update-panel').hidden){for(const node of document.querySelectorAll('#update-panel button'))if(visible(node)&&(node.scrollWidth>node.clientWidth||node.scrollHeight>node.clientHeight))errors.push('update control clipping');}
    else{
     if(left.right>right.left||right.width!==144||main.top-shell.top!==34)errors.push('unstable columns');
     for(const stats of document.querySelectorAll('.statistics'))if(visible(stats)){const box=rect(stats.closest('.info,.right'));if(!within(stats,box)||stats.scrollHeight>stats.clientHeight)errors.push('statistics overflow');}
     if(!document.querySelector('.visual').hidden&&(Math.abs(visual.width/visual.height-16/9)>.001||visual.top-header.bottom<7||footer.top-visual.bottom<7))errors.push('preview ratio or spacing');
     const prefs=[...document.querySelectorAll('.preference')].filter(visible);if(!el('phase').hidden&&rect(el('phase')).left<rect(prefs.at(-1)).right)errors.push('footer collision');
    }
    return {width:shell.width,height:shell.height,errors,phase:el('phase-text').textContent,heading:el('page').textContent,fit:getComputedStyle(el('mirror')).objectFit,signIn:!el('account-sign-in').hidden};
   })()`);
   const label=appearance+'/'+locale+'/'+name;
   assert.equal(result.width,360,label+' width');assert.equal(result.height,144,label+' height');assert.deepEqual(result.errors,[],label);
   assert.equal(result.fit,'contain',label+' image must not stretch');
   if(name==='stages')assert.equal(result.phase,task.stage,label+' real action');
   if(name==='task-failed')assert.equal(result.phase,messages['Task failed'],label+' failure priority');
   if(name==='account')assert.equal(result.heading,'数禾科技 · 业务中台工作区',label+' account heading');
   if(name==='signed-out-failure'||name==='save-unlogged')assert.ok(result.signIn,label+' sign-in recovery');
   if(process.env.PLASMIC_ISLAND_REPORT_DIR&&appearance==='dark'&&locale==='zh-CN'&&['idle','account','no-canvas','stages','task-failed','update-downloading'].includes(name)){
    fs.mkdirSync(process.env.PLASMIC_ISLAND_REPORT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.PLASMIC_ISLAND_REPORT_DIR,name+'.png'),(await win.webContents.capturePage()).toPNG());
   }
   checked++;
  }
 }
 console.log(JSON.stringify({passed:true,states:cases.length,locales:5,themes:2,checked}));
 win.destroy();clearTimeout(watchdog);fs.rmSync(profile,{recursive:true,force:true});app.exit(0);
}).catch(error=>{console.error(error.stack);win?.destroy();clearTimeout(watchdog);fs.rmSync(profile,{recursive:true,force:true});app.exit(1)});
