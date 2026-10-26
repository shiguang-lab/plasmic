const {app,BrowserWindow,ipcMain}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'plasmic-island-layout-'));
app.setPath('userData',profile);
app.on('window-all-closed',()=>{});
const canvas={allowed:true,mode:'edit',projectName:'采购管理系统 Enterprise Purchasing',viewName:'跨部门采购审批与预算占用明细',projectSummary:{pages:1234,components:6789},saveStatus:'saved'};
const user={name:'梁彦先',email:'designer@example.test'};
const account={status:'ready',user,teams:[{id:'t',name:'数禾科技'}],workspaces:[{id:'w',teamId:'t',name:'业务中台工作区'}],counts:{organizations:2,workspaces:5,projects:18}};
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
    const el=id=>document.getElementById(id),rect=node=>node.getBoundingClientRect(),info=document.querySelector('.info'),box=rect(info);
    const visible=node=>node.checkVisibility({checkVisibilityCSS:true})&&!node.closest('[hidden]');
    const inside=node=>{const r=rect(node);return r.left>=box.left-.5&&r.right<=box.right+.5&&r.top>=box.top-.5&&r.bottom<=box.bottom+.5};
    const controls=['account-sign-in','show-main'].map(el).filter(visible);
    const metadata=['stage-count','queued-count','running-count','unsaved'].map(el).filter(node=>visible(node)&&node.textContent);
    const panel=el('update-panel'),visual=document.querySelector('.visual'),phase=el('phase'),heading=document.querySelector('.heading');
    return {width:rect(el('shell')).width,height:rect(el('shell')).height,
      infoFits:info.scrollHeight<=info.clientHeight&&info.scrollWidth<=info.clientWidth,
      metadataFits:metadata.length<=2&&metadata.every(node=>inside(node)&&node.scrollWidth<=node.clientWidth),
      controlsFit:controls.every(node=>inside(node)&&node.scrollWidth<=node.clientWidth&&node.scrollHeight<=node.clientHeight),
      phaseWidth:rect(el('phase-text')).width,infoWidth:box.width,phaseGap:rect(phase).top-rect(heading).bottom,
      titleSize:getComputedStyle(el('mission')).fontSize,phaseSize:getComputedStyle(phase).fontSize,
      previewWidth:rect(visual).width,previewHeight:rect(visual).height,previewFit:getComputedStyle(el('mirror')).objectFit,
      headerFits:visible(el('page'))&&inside(el('page'))&&visible(el('context'))!==visible(el('account-presence'))&&[el('context'),el('account-presence')].filter(visible).every(node=>inside(node)&&rect(node).left>=rect(el('page')).right-0.5),visualHidden:visual.hidden,
      panelFits:panel.scrollHeight<=panel.clientHeight&&panel.scrollWidth<=panel.clientWidth,
      panelControlsFit:['update-dismiss','update-later','update-retry','update-install'].map(el).filter(visible).every(node=>{const r=rect(node),p=rect(panel);return r.left>=p.left&&r.right<=p.right&&r.bottom<=p.bottom&&node.scrollWidth<=node.clientWidth&&node.scrollHeight<=node.clientHeight}),
      title:el('mission').textContent,stageText:el('phase-text').textContent,
      signIn:!el('account-sign-in').hidden,phaseHidden:phase.hidden,statsFits:!visible(el('account-statistics'))||inside(el('account-statistics'))&&el('account-statistics').scrollWidth<=el('account-statistics').clientWidth,
      idleMetadataRemoved:!el('page-count')&&!el('summary'),accountAvatar:!el('account-avatar').hidden,
    };
   })()`);
   const label=appearance+'/'+locale+'/'+name;
   const hasVisual=state.context.allowed&&!!(state.context.loading||state.context.viewName||state.image);
   const accountIdle=!state.context.allowed&&!state.activity?.task&&!state.activity?.operation;
   const expectedWidth=state.updateOpen||hasVisual||accountIdle&&state.context.account?.user?440:accountIdle&&state.context.account?.status==='signed-out'?400:320;
   assert.equal(result.width,expectedWidth,label+' width');assert.equal(result.height,144,label+' height');
   if(patch.updateOpen){assert.ok(result.panelFits&&result.panelControlsFit,label+' update layout');}
   else{
    assert.ok(result.headerFits,label+' title and trailing status remain visible');
    assert.equal(result.visualHidden,!hasVisual,label+' no empty preview column');
    assert.ok(result.infoFits,label+' information overflow');
    assert.ok(result.metadataFits,label+' metadata clipping');assert.ok(result.controlsFit,label+' recovery action clipping');
    assert.equal(result.titleSize,'15px',label+' primary text');assert.equal(result.phaseSize,'12px',label+' action text');
    assert.ok(result.idleMetadataRemoved,label+' statistics should not occupy canvas content');assert.ok(result.statsFits,label+' account totals');
    if(!result.phaseHidden)assert.ok(result.phaseGap>=4&&result.phaseGap<=8,label+' grouped title and action');
    if(hasVisual){assert.equal(result.previewWidth,200,label+' preview width');assert.equal(result.previewHeight,110,label+' preview height');assert.equal(result.previewFit,'contain',label+' complete image');}
    if(name==='stages'){assert.equal(result.stageText,task.stage,label+' full stage text retained');assert.ok(result.phaseWidth>=result.infoWidth-24,label+' stage width');}
    if(name==='task-failed')assert.equal(result.title,messages['Task failed'],label+' failure priority');
    if(name==='signed-out-failure'||name==='save-unlogged')assert.ok(result.signIn,label+' sign-in recovery');
    if(name==='account'){assert.equal(result.infoWidth,406,label+' full-width identity');assert.ok(result.accountAvatar,label+' account identity');}
   }
   checked++;
  }
 }
 console.log(JSON.stringify({passed:true,states:cases.length,locales:5,themes:2,checked}));
 win.destroy();clearTimeout(watchdog);fs.rmSync(profile,{recursive:true,force:true});app.exit(0);
}).catch(error=>{console.error(error.stack);win?.destroy();clearTimeout(watchdog);fs.rmSync(profile,{recursive:true,force:true});app.exit(1)});
