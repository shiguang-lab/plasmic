const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const source=file=>fs.readFileSync(path.join(__dirname,'../src',file),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(t){
 const dom=new JSDOM(source('island.html'),{runScripts:'outside-only'});
 t.after(()=>dom.window.close());
 const {window}=dom,commands=[];
 let listener;
 let state={mode:'island',expanded:false,context:{allowed:false,loading:false,projectName:'Project'},activity:{},appearance:'dark',update:{phase:'idle',currentVersion:'0.2.8'}};
 window.requestAnimationFrame=()=>1;
 window.desktopIsland={onState:callback=>{listener=callback},command:async(command)=>{commands.push(command);return state}};
 window.eval(source('renderer-i18n.js'));window.eval(source('island-renderer.js'));await flush();
 return {window,commands,el:id=>window.document.getElementById(id),send(value){state={...state,...value};listener(state)}};
}
test('island update badges never expand on background progress; an explicit panel keeps the canvas structure intact',async(t)=>{
 const ui=await fixture(t);
 assert.equal(ui.el('capsule-update').hidden,true);
 ui.send({update:{phase:'downloading',currentVersion:'0.2.8',version:'0.2.9',percent:42.9}});
 assert.equal(ui.el('shell').dataset.expanded,'false');
 for(const id of ['capsule-update','card-update']){
  assert.equal(ui.el(id).hidden,false);assert.match(ui.el(id).getAttribute('aria-label'),/42%/);
  assert.equal(ui.el(id).textContent,'','update entry is icon-only');
 }
 ui.el('capsule-update').click();await flush();assert.equal(ui.commands.at(-1),'update-open');
 ui.send({expanded:true,updateOpen:true});
 assert.equal(ui.el('update-panel').hidden,false);
 assert.equal(ui.el('card').querySelector('.body').hidden,true);
 assert.equal(ui.el('update-progress').value,42);
 assert.equal(ui.el('update-versions').textContent,'0.2.8 → 0.2.9');
 assert.equal(ui.el('update-install').hidden,true);
 ui.send({update:{phase:'downloaded',currentVersion:'0.2.8',version:'0.2.9'}});
 assert.equal(ui.commands.includes('update-install'),false,'completion must not request installation');
 assert.equal(ui.el('update-install').disabled,false);
 ui.el('update-later').click();await flush();assert.equal(ui.commands.at(-1),'update-close');
 ui.send({updateOpen:false});assert.equal(ui.el('card').querySelector('.body').hidden,false);
 assert.equal(ui.el('card-update').dataset.phase,'downloaded');
 ui.send({updateOpen:true});ui.el('update-install').click();await flush();
 assert.equal(ui.commands.at(-1),'update-install');
 ui.send({update:{phase:'installing',currentVersion:'0.2.8',version:'0.2.9'},updateWaiting:true});
 assert.equal(ui.el('update-dismiss').disabled,true);assert.equal(ui.el('update-later').disabled,true);
 assert.equal(ui.el('update-install').disabled,true);
 assert.equal(ui.el('update-description').textContent,'Your current operations will finish before Plasmic restarts.');
});
test('update indicators preserve animation nodes and localize the panel without raw release-note markup',async(t)=>{
 const ui=await fixture(t);
 ui.send({update:{phase:'installing',currentVersion:'0.2.8',version:'0.2.9'}});
 const icon=ui.el('capsule-update').firstChild;
 ui.send({appearance:'light'});assert.equal(ui.el('capsule-update').firstChild,icon,'metadata renders cannot restart the spinner');
 ui.send({expanded:true,updateOpen:true,update:{phase:'downloaded',currentVersion:'0.2.8',version:'0.2.9',releaseNotes:'<script>throw 1</script>'},localization:{locale:'zh-CN',messages:JSON.parse(fs.readFileSync(path.join(__dirname,'../../platform/wab/src/wab/client/i18n/locales/zh-CN.json'),'utf8'))}});
 assert.equal(ui.el('update-heading').textContent,'软件更新');
 assert.equal(ui.el('update-heading').tagName,'H2','software update is the panel heading');
 assert.equal(ui.el('update-title').getAttribute('role'),'status','the changing update state is separate from the heading');
 assert.equal(ui.el('update-install').textContent,'重启并安装');
 assert.equal(ui.window.document.querySelector('#update-panel script'),null);
 assert.equal(ui.window.document.documentElement.dataset.uiAppearance,'light');
 ui.send({update:{phase:'disabled',currentVersion:'0.2.8'}});
 assert.equal(ui.el('capsule-update').hidden,true);assert.equal(ui.el('update-install').hidden,true);
});


const canvas={allowed:true,mode:'edit',projectName:'Project',viewName:'Approval canvas',projectSummary:{pages:2,components:4},saveStatus:'saved',scale:.65};
const account={status:'ready',user:{id:'a',name:'Li Lei',email:'li@example.test'},teams:[{id:'t',name:'Team'}],workspaces:[{id:'w',teamId:'t',name:'Work'}],counts:{organizations:1,workspaces:2,projects:7}};

test('account identity, location and totals yield to work and clear on sign-out',async(t)=>{
 const ui=await fixture(t);
 ui.send({expanded:true,context:{allowed:false,workspaceId:'w',account}});
 assert.equal(ui.el('mission').textContent,'Li Lei');
 assert.equal(ui.el('account-email').textContent,'li@example.test');
 assert.equal(ui.el('account-location').textContent,'Team · Work');
 assert.equal(ui.el('project-count').textContent,'7');
 assert.equal(ui.el('account-overview').hidden,false);
 ui.send({activity:{operation:{kind:'resource',phase:'running',label:'Creating project',subject:'New orders'},queued:1}});
 assert.equal(ui.el('mission').textContent,'New orders');
 assert.equal(ui.el('phase-text').textContent,'Creating project');
 assert.equal(ui.el('queued-count').textContent,'1 queued');
 assert.equal(ui.el('account-overview').hidden,true);
 assert.equal(ui.el('account-detail').hidden,true);
 ui.send({context:{allowed:false,account:{status:'signed-out'}},activity:{},image:{src:'data:image/png;base64,old'}});
 assert.equal(ui.el('project-count').textContent,'');assert.equal(ui.el('account-email').textContent,'');
 assert.equal(ui.el('account-overview').hidden,true);assert.equal(ui.el('mirror').hasAttribute('src'),false);
});

test('sign-in remains actionable after failure and when canvas saving requires authentication',async(t)=>{
 const ui=await fixture(t);
 ui.send({expanded:true,context:{allowed:false,account:{status:'signed-out'}}});
 assert.equal(ui.el('mission').textContent,'Sign in to continue designing');
 assert.equal(ui.el('account-sign-in').hidden,false);
 ui.send({activity:{operation:{kind:'resource',phase:'failed',error:'Sign-in required'}}});
 assert.equal(ui.el('account-sign-in').hidden,false);
 assert.equal(ui.el('issue-text').textContent,'Sign in to continue.');
 assert.equal(ui.el('issue').title,'Sign-in required');
 ui.el('drag-handle').setPointerCapture=()=>assert.fail('sign-in must not start dragging');
 ui.el('account-sign-in').dispatchEvent(new ui.window.MouseEvent('pointerdown',{button:0,bubbles:true}));
 ui.el('account-sign-in').click();await flush();assert.equal(ui.commands.at(-1),'sign-in');
 ui.send({context:{...canvas,saveStatus:'unlogged'},activity:{}});
 assert.equal(ui.el('account-sign-in').hidden,false);
 assert.equal(ui.el('phase-text').textContent,'Sign in to save');
 ui.send({context:canvas});assert.equal(ui.el('account-sign-in').hidden,true);
});

test('stages retain their text while queue, concurrency and unsaved state use separate metadata',async(t)=>{
 const ui=await fixture(t);
 const task={title:'Adjust approval rows',status:'running',stage:'Check permissions and validate all table fields',stageIndex:10,stageCount:12};
 ui.send({context:{...canvas,saveStatus:'pending'},activity:{task,queued:12,running:2}});
 assert.equal(ui.el('mission').textContent,task.title);assert.equal(ui.el('phase-text').textContent,task.stage);
 assert.equal(ui.el('stage-count').textContent,'Step 10 of 12');
 assert.equal(ui.el('queued-count').textContent,'12 queued');assert.equal(ui.el('running-count').textContent,'2 running');
 assert.equal(ui.el('unsaved').textContent,'Unsaved');assert.equal(ui.el('view-metric').hidden,true);assert.equal(ui.el('running-count').hidden,true);assert.equal(ui.el('unsaved').hidden,true);assert.match(ui.el('activity-meta').title,/2 running.*Unsaved/);
 assert.equal(ui.el('progress'),null,'stage positions do not imply a percentage of completed work');
 ui.send({activity:{operation:{kind:'write',phase:'completed'}}});
 assert.equal(ui.el('phase-text').textContent,'Changes applied');assert.equal(ui.el('unsaved').textContent,'Unsaved');
 ui.send({context:canvas,activity:{operation:{kind:'save',phase:'completed'}}});
 assert.equal(ui.el('phase-text').textContent,'Saved');assert.equal(ui.el('unsaved').textContent,'');
});

test('task failure and blockers override completed child calls and expose real recovery actions',async(t)=>{
 const ui=await fixture(t);
 const task={title:'Validate layout',status:'failed',error:'The filter still overflows.'};
 ui.send({context:canvas,activity:{task,operation:{kind:'read',phase:'completed'}}});
 assert.equal(ui.el('phase-text').textContent,'Task failed');assert.equal(ui.el('phase').dataset.status,'failed');
 assert.equal(ui.window.document.querySelector('.info').dataset.tone,'error');
 assert.equal(ui.el('issue-text').textContent,task.error);assert.equal(ui.el('show-main').hidden,false);
 ui.el('show-main').click();await flush();assert.equal(ui.commands.at(-1),'show-main');
 ui.send({activity:{task:{...task,status:'blocked'},operation:{kind:'write',phase:'completed'}}});
 assert.equal(ui.el('phase-text').textContent,'Needs attention');assert.equal(ui.el('phase').dataset.status,'blocked');
 assert.equal(ui.window.document.querySelector('.info').dataset.tone,'warning');
 ui.send({activity:{operation:{kind:'read',phase:'failed',code:'CONTEXT_MISMATCH',error:'Raw technical details <script>test</script>'}}});
 assert.equal(ui.el('issue-text').textContent,'The editor context has changed.');
 assert.match(ui.el('issue').title,/Raw technical details/);assert.equal(ui.el('issue').querySelector('script'),null);
});

test('save problems displace statistics, pending saves remain concise and preview uses viewport dimensions',async(t)=>{
 const ui=await fixture(t);
 for(const [saveStatus,label]of [['error','Save failed'],['blocked','Saving blocked'],['unlogged','Sign in to save']]){
  ui.send({context:{...canvas,saveStatus},activity:{}});
  assert.equal(ui.el('view-metric').hidden,true);assert.equal(ui.el('phase-text').textContent,label);assert.equal(ui.el('mission').textContent,label);assert.equal(ui.el('phase').hidden,true);
  assert.equal(ui.el(saveStatus==='unlogged'?'account-sign-in':'show-main').hidden,false);
 }
 ui.send({context:{...canvas,saveStatus:'pending'}});assert.equal(ui.el('phase-text').textContent,'Unsaved');
 ui.send({context:{...canvas,saveStatus:'saving'}});assert.equal(ui.el('phase').dataset.status,'running');
 ui.send({context:canvas});assert.equal(ui.el('view-metric').textContent,'');assert.match(ui.el('drag-handle').title,/2 Pages · 4 Components/);assert.equal(ui.el('page-count'),null);
 ui.send({context:{...canvas,mode:'preview',previewContext:{width:390,height:844}}});
 assert.equal(ui.el('view-metric').textContent,'390 × 844');assert.equal(ui.el('view-metric').hidden,false);
 assert.equal(ui.el('context').textContent,'Preview');assert.equal(ui.el('phase').hidden,true,'idle Preview mode belongs in the trailing header only');
 ui.send({context:{...canvas,loading:true}});assert.equal(ui.el('phase-text').textContent,'Preparing preview image…');assert.equal(ui.el('view-metric').hidden,true);
 assert.equal(ui.el('mission').textContent,canvas.viewName,'loading does not replace known identity with repeated loading copy');
 ui.send({context:{...canvas,viewName:''}});assert.equal(ui.el('phase').hidden,true);assert.equal(ui.el('show-main').hidden,false);assert.equal(ui.el('mission').textContent,'No canvas open');
});

test('loading only masks unknown identity and authenticated account failures retain identity',async(t)=>{
 const ui=await fixture(t);
 ui.send({context:{allowed:false,account:{status:'loading'}}});
 assert.equal(ui.el('account-loading').hidden,false);assert.equal(ui.el('mission').hidden,true);
 assert.equal(ui.el('account-stats-loading').hidden,true);
 ui.send({context:{allowed:false,account:{status:'loading',user:account.user}}});
 assert.equal(ui.el('account-loading').hidden,true);assert.equal(ui.el('mission').hidden,false);
 assert.equal(ui.el('mission').textContent,'Li Lei');assert.equal(ui.el('account-detail').hidden,false);
 assert.equal(ui.el('account-stats-loading').hidden,false);
 ui.send({context:{allowed:false,account:{status:'error',user:account.user}}});
 assert.equal(ui.el('mission').textContent,'Li Lei');assert.equal(ui.el('phase-text').textContent,'Statistics unavailable');
 assert.equal(ui.el('account-sign-in').hidden,true);assert.equal(ui.el('show-main').hidden,false);
 ui.send({context:canvas});assert.equal(ui.el('account-stats-loading').hidden,true,'hidden account scaffolding cannot leak into canvas');
 assert.equal(ui.el('account-overview').hidden,true);assert.equal(ui.el('account-loading').hidden,true);
});

test('compact labels avoid duplicate sign-in state, retain mode and label their queue',async(t)=>{
 const ui=await fixture(t);
 ui.send({context:{allowed:false,account:{status:'signed-out'}}});
 assert.equal(ui.el('project').textContent,'Sign in');assert.equal(ui.el('pill-context').textContent,'');
 ui.send({context:{...canvas,mode:'preview'}});assert.equal(ui.el('pill-context').textContent,'Preview');
 ui.send({context:canvas,activity:{operation:{kind:'write',phase:'running'},queued:3}});
 assert.equal(ui.el('context').textContent,'Canvas');assert.equal(ui.el('context').className,'');assert.equal(ui.el('context').hidden,false);assert.equal(ui.el('queue').textContent,'+3');
 assert.equal(ui.el('queue').getAttribute('aria-label'),'3 queued');assert.equal(ui.el('shell').dataset.expanded,'false');
});

test('theme and language remain available in the identity tooltip without occupying content rows',async(t)=>{
 const ui=await fixture(t);
 ui.send({context:{allowed:false,account}});
 assert.match(ui.el('drag-handle').title,/Theme: Dark/);assert.match(ui.el('drag-handle').title,/Language: English/);
 assert.equal(ui.el('account-preferences'),null);
 ui.send({appearance:'light',localization:{locale:'zh-CN',messages:JSON.parse(fs.readFileSync(path.join(__dirname,'../../platform/wab/src/wab/client/i18n/locales/zh-CN.json'),'utf8'))}});
 assert.match(ui.el('drag-handle').title,/主题: 浅色/);assert.match(ui.el('drag-handle').title,/语言: 简体中文/);
 assert.equal(ui.el('mission').textContent,'Li Lei');
});

test('failed updates remain distinct from a successful check and retry only on explicit action',async(t)=>{
 const ui=await fixture(t);
 ui.send({expanded:true,updateOpen:true,update:{phase:'error',currentVersion:'0.2.17'}});
 assert.equal(ui.el('update-title').textContent,'Update could not be completed');
 assert.equal(ui.el('update-retry').hidden,false);assert.equal(ui.el('update-install').hidden,true);
 assert.equal(ui.commands.includes('update-check'),false);
 ui.el('update-retry').click();await flush();assert.equal(ui.commands.at(-1),'update-check');
 ui.send({update:{phase:'checking'}});assert.equal(ui.el('update-retry').hidden,true);
 ui.send({update:{phase:'current'}});assert.equal(ui.el('update-title').textContent,"You're up to date");
});

test('a completed task cannot replace the action or result of a later tool call',async(t)=>{
 const ui=await fixture(t);
 const task={title:'Old task',stage:'Old stage',status:'completed',finishedAt:1000};
 ui.send({context:canvas,activity:{task,operation:{kind:'write',phase:'running',startedAt:new Date(1100).toISOString()}}});
 assert.equal(ui.el('mission').textContent,canvas.viewName);assert.equal(ui.el('phase-text').textContent,'Applying changes');
 ui.send({activity:{task,operation:{kind:'write',phase:'completed',startedAt:new Date(1100).toISOString()}}});
 assert.equal(ui.el('phase-text').textContent,'Changes applied');
});

test('resource operations expose actual elapsed time and known preview actions stay specific',async(t)=>{
 const ui=await fixture(t);t.mock.method(ui.window.Date,'now',()=>14000);
 ui.send({context:{allowed:false,account},activity:{operation:{kind:'resource',phase:'running',label:'Generating image',startedAt:new Date(2000).toISOString()}}});
 assert.equal(ui.el('mission').textContent,'Generating image');assert.equal(ui.el('phase-text').textContent,'Elapsed 12s');
 ui.send({context:canvas,activity:{operation:{kind:'preview',operation:'fill',phase:'running'}}});
 assert.equal(ui.el('phase-text').textContent,'Entering text in preview');
});

test('unchanged snapshots do not repeat live status and error announcements',async(t)=>{
 const ui=await fixture(t);
 const value={context:canvas,activity:{operation:{kind:'write',phase:'failed',error:'Technical detail'}}};
 ui.send(value);
 const changes=[];
 const observer=new ui.window.MutationObserver(records=>changes.push(...records));
 for(const id of ['phase-text','issue-text'])observer.observe(ui.el(id),{childList:true,subtree:true});
 ui.send(value);await flush();observer.disconnect();
 assert.equal(changes.length,0);
});
