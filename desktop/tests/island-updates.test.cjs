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
 const reduced=new window.EventTarget();reduced.matches=false;window.matchMedia=()=>reduced;
 window.desktopIsland={onState:callback=>{listener=callback},command:async(command)=>{commands.push(command);return state}};
 window.eval(source('renderer-i18n.js'));window.eval(source('island-renderer.js'));await flush();
 return {window,commands,el:id=>window.document.getElementById(id),send(value){state={...state,...value};listener(state)}};
}
test('state-only image updates retain pixels, update feedback, and explicit null clears them',async t=>{
 const ui=await fixture(t);
 ui.window.Image=class {set src(value){this.value=value;queueMicrotask(()=>this.onload?.());}};
 const context={allowed:true,loading:false,identity:'current',viewName:'Page'};
 const pixels='data:image/jpeg;base64,cGl4ZWxz';
 ui.send({context,expanded:true,image:{src:pixels,identity:'current',width:400,height:300,feedback:null}});await flush();
 assert.equal(ui.el('mirror').src,pixels);assert.equal(ui.el('mirror').hidden,false);
 const feedback={id:'read',regions:[{x:0,y:0,width:1,height:1}]};
 ui.send({image:{identity:'current',width:400,height:300,feedback},activity:{operation:{id:'read',phase:'running'}}});await flush();
 assert.equal(ui.el('mirror').src,pixels);assert.equal(ui.el('mirror').hidden,false);assert.equal(ui.el('feedback').hidden,false);
 assert.equal(ui.el('feedback').children.length,1);
 ui.send({image:null});assert.equal(ui.el('mirror').hasAttribute('src'),false);assert.equal(ui.el('feedback').hidden,true);
});
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
const canvas={allowed:true,mode:'edit',projectName:'Project',viewName:'Approval canvas',projectSummary:{pages:2,components:4,artboards:3,canvases:1,images:12,libraries:2},saveStatus:'saved'};
test('local draft badges explain protection on hover and remain visible during AI activity',async(t)=>{
 const ui=await fixture(t);
 ui.send({expanded:true,context:{...canvas,saveStatus:'error',desktopDraftStatus:{state:'local',savedAt:100,pendingDrafts:0}}});
 assert.equal(ui.window.document.body.dataset.tone,'warning');
 assert.equal(ui.el('phase-text').textContent,'Saved on this device');
 assert.match(ui.el('capsule-draft').title,/backed up on this device/);
 assert.match(ui.el('capsule-draft').title,/Last local backup/);
 assert.equal(ui.el('draft-status').hidden,true);
 ui.send({activity:{task:{id:'task',title:'Generate page',status:'running',stage:'Generating'}}});
 assert.equal(ui.el('draft-status').hidden,false);
 assert.equal(ui.el('draft-status').textContent,'Saved on this device');
 ui.el('draft-status').click();await flush();assert.equal(ui.commands.at(-1),'show-drafts');
 ui.send({context:{...canvas,saveStatus:'error',desktopDraftStatus:{state:'error',error:'disk full',pendingDrafts:0}}});
 assert.equal(ui.window.document.body.dataset.tone,'error');
 assert.match(ui.el('draft-status').title,/Keep the editor open/);
 assert.match(ui.el('draft-status').title,/disk full/);
 ui.send({context:{...canvas,desktopDraftStatus:{state:'conflict',pendingDrafts:1}}});
 assert.equal(ui.el('draft-status').textContent,'Drafts need attention');
 assert.equal(ui.el('draft-status').dataset.tone,'warning');
 ui.send({context:{...canvas,mode:'preview',desktopDraftStatus:{state:'conflict',pendingDrafts:1}}});
 assert.equal(ui.el('draft-status').hidden,true);
 assert.equal(ui.el('capsule-draft').hidden,true);
});
const account={status:'ready',user:{id:'a',name:'Li Lei',email:'li@example.test'},teams:[{id:'t',name:'Team'}],workspaces:[{id:'w',teamId:'t',name:'Work',projects:6,members:8}],counts:{organizations:1,workspaces:2,projects:7}};
const numbers=(ui,id)=>[...ui.el(id).querySelectorAll('b')].map(n=>n.textContent);
test('header, identity and statistics remain stable across task, save and error states',async(t)=>{
 const ui=await fixture(t);const context={...canvas,account};
 ui.send({expanded:true,context});const header=ui.el('page').textContent;
 assert.equal(header,'Project · Approval canvas');assert.equal(ui.el('user-name').textContent,'Li Lei');
 assert.deepEqual(numbers(ui,'left-statistics'),['2','4','3']);
 const task={title:'Adjust approval rows',status:'running',stage:'Check permissions and table fields',stageIndex:2,stageCount:5};
 ui.send({activity:{task,queued:3,running:2}});
 assert.equal(ui.el('phase-text').textContent,task.stage);assert.equal(ui.el('stage-count').textContent,'Step 2/5');
 assert.equal(ui.el('queue').textContent,'+3');assert.equal(ui.el('phase').textContent.includes('queued'),false);
 for(const saveStatus of ['pending','saving','error','blocked','unlogged']){
  ui.send({context:{...context,saveStatus},activity:{}});
  assert.equal(ui.el('page').textContent,header);assert.deepEqual(numbers(ui,'left-statistics'),['2','4','3']);
 }
 assert.equal(ui.el('account-sign-in').hidden,false);ui.el('account-sign-in').click();await flush();assert.equal(ui.commands.at(-1),'sign-in');
});
test('failed tasks survive completed child calls; real details are available only through the tooltip',async(t)=>{
 const ui=await fixture(t);const task={status:'failed',title:'Validate layout',error:'Filter overflows <script>bad</script>'};
 ui.send({context:canvas,activity:{task,operation:{kind:'read',phase:'completed'}}});
 assert.equal(ui.el('phase-text').textContent,'Task failed');assert.equal(ui.el('issue-detail').hidden,false);
 assert.equal(ui.el('issue-tooltip').hidden,true);assert.match(ui.el('issue-tooltip').textContent,/Filter overflows/);
 assert.equal(ui.el('issue-tooltip').querySelector('script'),null);assert.equal(ui.el('show-main'),null);
 ui.el('issue-detail').dispatchEvent(new ui.window.MouseEvent('mouseenter'));assert.equal(ui.el('issue-tooltip').hidden,false);
 ui.el('issue-detail').dispatchEvent(new ui.window.MouseEvent('mouseleave'));assert.equal(ui.el('issue-tooltip').hidden,true);
 ui.el('issue-detail').focus();assert.equal(ui.el('issue-tooltip').hidden,false);
 ui.el('shell').dispatchEvent(new ui.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(ui.el('issue-tooltip').hidden,true);
 ui.send({activity:{}});assert.equal(ui.el('issue-detail').hidden,true);assert.equal(ui.el('issue-tooltip').hidden,true);
});
test('account totals are on the left and selected workspace counts on the right without email or redundant login copy',async(t)=>{
 const ui=await fixture(t);ui.send({context:{allowed:false,workspaceId:'w',account}});
 assert.equal(ui.el('page').textContent,'Team · Work');assert.deepEqual(numbers(ui,'left-statistics'),['1','2','7']);assert.deepEqual(numbers(ui,'right-statistics'),['6','8']);
 assert.equal(ui.el('account-email'),null);assert.equal(ui.el('phase').hidden,true);
 ui.send({activity:{operation:{kind:'resource',phase:'running',label:'Creating project',subject:'New orders'}}});
 assert.equal(ui.el('phase-text').textContent,'Creating project');assert.equal(ui.el('page').textContent,'Team · Work');assert.deepEqual(numbers(ui,'right-statistics'),['6','8']);
 ui.send({context:{allowed:false,account:{status:'signed-out'}},activity:{}});
 assert.deepEqual(numbers(ui,'left-statistics'),[]);assert.deepEqual(numbers(ui,'right-statistics'),[]);assert.equal(ui.el('user-name').textContent,'Signed out');assert.equal(ui.el('account-sign-in').hidden,true);
 assert.equal(ui.el('capsule-sign-in').hidden,false);assert.equal(ui.el('project').textContent,'Plasmic');assert.equal(ui.el('shell').dataset.expanded,'false');
 ui.el('capsule-sign-in').click();await flush();assert.equal(ui.commands.at(-1),'sign-in');
});
test('missing statistics never become zero and no-canvas resources swap sides in the fixed grid',async(t)=>{
 const ui=await fixture(t);ui.send({context:{allowed:false,account:{status:'loading'}}});assert.deepEqual(numbers(ui,'left-statistics'),['—','—','—']);
 ui.send({context:{allowed:false,account:{...account,counts:{organizations:0,workspaces:0,projects:0}}}});assert.deepEqual(numbers(ui,'left-statistics'),['0','0','0']);
 ui.send({context:{...canvas,viewName:''}});assert.deepEqual(numbers(ui,'left-statistics'),['1','12','2']);assert.deepEqual(numbers(ui,'right-statistics'),['2','4']);
 assert.equal(ui.window.document.querySelector('.visual').hidden,true);assert.equal(ui.el('phase-text').textContent,'No canvas open');
 ui.send({context:{...canvas,loading:true,projectSummary:null}});assert.deepEqual(numbers(ui,'left-statistics'),['—','—','—']);
 ui.send({context:{...canvas,mode:'preview',previewContext:{width:390,height:844}}});assert.deepEqual(numbers(ui,'left-statistics'),['390','844']);
});
test('completed tasks do not replace subsequent actions and preview actions remain specific',async(t)=>{
 const ui=await fixture(t);const task={title:'Old task',stage:'Old stage',status:'completed',finishedAt:1000};
 ui.send({context:canvas,activity:{task,operation:{kind:'write',phase:'running',startedAt:new Date(1100).toISOString()}}});assert.equal(ui.el('phase-text').textContent,'Applying changes');
 ui.send({activity:{operation:{kind:'preview',operation:'fill',phase:'running'}}});assert.equal(ui.el('phase-text').textContent,'Entering text in preview');
 ui.send({activity:{operation:{kind:'resource',phase:'running',label:'Generating image'}}});assert.equal(ui.el('phase-text').textContent,'Generating image');
});
test('localization updates preferences and statistics without replacing business names',async(t)=>{
 const ui=await fixture(t);ui.send({context:{...canvas,account},appearance:'light',localization:{locale:'zh-CN',messages:JSON.parse(fs.readFileSync(path.join(__dirname,'../../platform/wab/src/wab/client/i18n/locales/zh-CN.json'),'utf8'))}});
 assert.equal(ui.el('theme-label').textContent,'浅色');assert.equal(ui.el('language-label').textContent,'简体中文');assert.equal(ui.el('page').textContent,'Project · Approval canvas');assert.match(ui.el('left-statistics').textContent,/页面/);
});
test('failed updates retry only on explicit action',async(t)=>{
 const ui=await fixture(t);ui.send({expanded:true,updateOpen:true,update:{phase:'error',currentVersion:'0.2.18'}});
 assert.equal(ui.el('update-retry').hidden,false);assert.equal(ui.commands.includes('update-check'),false);
 ui.el('update-retry').click();await flush();assert.equal(ui.commands.at(-1),'update-check');
 ui.send({update:{phase:'current'}});assert.equal(ui.el('update-retry').hidden,true);
});
test('unchanged snapshots do not repeat live announcements',async(t)=>{
 const ui=await fixture(t);const value={context:canvas,activity:{operation:{kind:'write',phase:'failed',error:'Technical detail'}}};ui.send(value);
 const changes=[],observer=new ui.window.MutationObserver(records=>changes.push(...records));for(const id of ['phase-text','issue-tooltip']){observer.observe(ui.el(id),{childList:true,subtree:true});}
 ui.send(value);await flush();observer.disconnect();assert.equal(changes.length,0);
});

async function feedbackFixture(t, kind='read', regions=[{x:0,y:0,width:1,height:1}]) {
 const ui=await fixture(t);
 ui.window.Image=class {set src(value){queueMicrotask(()=>this.onload?.());}};
 ui.send({context:{allowed:true,loading:false,identity:'canvas',mode:'edit'},expanded:true,
  image:{src:'data:image/png;base64,cGl4ZWxz',identity:'canvas',width:400,height:300,feedback:{id:'first',kind,regions}},
  activity:{operation:{id:'first',phase:'running'}}});
 await flush();
 return {...ui,cycle(node){node.dispatchEvent(new ui.window.Event('animationiteration',{bubbles:true}));},end(node){node.dispatchEvent(new ui.window.Event('animationend',{bubbles:true}));}};
}
test('read completion retains the actual scan through its current iteration and result fade',async t=>{
 const ui=await feedbackFixture(t),scan=ui.el('feedback').querySelector('.feedback-sweep'),region=scan.parentElement;
 ui.send({activity:{operation:{id:'first',phase:'completed'}}});
 assert.equal(ui.el('feedback').hidden,false);
 assert.equal(region.parentElement.dataset.phase,'running','a tool result does not stop an in-progress CSS iteration');
 ui.send({activity:{},image:{identity:'canvas',width:400,height:300,feedback:null}});
 assert.equal(scan.isConnected,true,'expired operation metadata cannot truncate a visible scan');
 ui.cycle(scan);
 assert.equal(region.parentElement.dataset.phase,'completed');
 assert.equal(scan.isConnected,true,'result fade owns final removal');
 ui.end(region);assert.equal(ui.el('feedback').hidden,true);
});
test('consecutive calls on the same target reuse the scan and cancel its pending exit',async t=>{
 const ui=await feedbackFixture(t),scan=ui.el('feedback').querySelector('.feedback-sweep');
 ui.send({activity:{operation:{id:'first',phase:'completed'}}});
 ui.send({image:{identity:'canvas',width:400,height:300,feedback:{id:'next',kind:'read',regions:[{x:0,y:0,width:1,height:1}]}},activity:{operation:{id:'next',phase:'running'}}});
 assert.equal(ui.el('feedback').querySelector('.feedback-sweep'),scan);
 ui.cycle(scan);assert.equal(scan.parentElement.parentElement.dataset.phase,'running');
 ui.send({activity:{operation:{id:'next',phase:'completed'}}});
 ui.cycle(scan);assert.equal(scan.parentElement.parentElement.dataset.phase,'completed');
 ui.end(scan.parentElement);assert.equal(ui.el('feedback').hidden,true);
});
test('each write region completes its own pulse before the group fades, including failure',async t=>{
 const ui=await feedbackFixture(t,'write',[{x:0,y:0,width:.4,height:1},{x:.6,y:0,width:.4,height:1}]);
 const [a,b]=ui.el('feedback').querySelectorAll('.feedback-region');
 ui.send({activity:{operation:{id:'first',phase:'failed'}}});
 assert.equal(a.isConnected,true);
 ui.cycle(a);assert.equal(a.parentElement.dataset.phase,'running');
 ui.cycle(b);assert.equal(a.parentElement.dataset.phase,'completed');
 ui.end(a);assert.equal(ui.el('feedback').hidden,false);
 ui.end(b);assert.equal(ui.el('feedback').hidden,true);
});
test('a new target leaves the previous scan intact until its cycle ends',async t=>{
 const ui=await feedbackFixture(t),scan=ui.el('feedback').querySelector('.feedback-sweep');
 ui.send({image:{identity:'canvas',width:400,height:300,feedback:{id:'next',kind:'write',regions:[{x:0,y:0,width:.5,height:1}]}},activity:{operation:{id:'next',phase:'running'}}});
 assert.equal(scan.isConnected,true);
 assert.equal(ui.el('feedback').querySelectorAll('.feedback-operation').length,2);
 ui.cycle(scan);ui.end(scan.parentElement);
 assert.equal(ui.el('feedback').querySelectorAll('.feedback-operation').length,1);
 assert.equal(ui.el('feedback').dataset.kind,'write');
});
test('reduced motion retires completed feedback without waiting for absent CSS events',async t=>{
 const ui=await feedbackFixture(t);
 const reduced=ui.window.matchMedia();reduced.matches=true;reduced.dispatchEvent(new ui.window.Event('change'));
 ui.send({activity:{operation:{id:'first',phase:'completed'}}});
 assert.equal(ui.el('feedback').hidden,true);
 ui.send({activity:{operation:{id:'first',phase:'completed'}}});
 assert.equal(ui.el('feedback').hidden,true,'metadata refresh cannot restart completed feedback');
});
