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
const canvas={allowed:true,mode:'edit',projectName:'Project',viewName:'Approval canvas',projectSummary:{pages:2,components:4,artboards:3,canvases:1,images:12,libraries:2},saveStatus:'saved'};
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
 assert.deepEqual(numbers(ui,'left-statistics'),[]);assert.deepEqual(numbers(ui,'right-statistics'),[]);assert.equal(ui.el('user-name').textContent,'Signed out');assert.equal(ui.el('account-sign-in').hidden,false);
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
 const changes=[],observer=new ui.window.MutationObserver(records=>changes.push(...records));for(const id of ['phase-text','issue-tooltip'])observer.observe(ui.el(id),{childList:true,subtree:true});
 ui.send(value);await flush();observer.disconnect();assert.equal(changes.length,0);
});
