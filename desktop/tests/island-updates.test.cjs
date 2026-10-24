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
 assert.equal(ui.el('update-description').textContent,'Waiting for MCP operations to finish…');
});
test('update indicators preserve animation nodes and localize the panel without raw release-note markup',async(t)=>{
 const ui=await fixture(t);
 ui.send({update:{phase:'installing',currentVersion:'0.2.8',version:'0.2.9'}});
 const icon=ui.el('capsule-update').firstChild;
 ui.send({appearance:'light'});assert.equal(ui.el('capsule-update').firstChild,icon,'metadata renders cannot restart the spinner');
 ui.send({expanded:true,updateOpen:true,update:{phase:'downloaded',currentVersion:'0.2.8',version:'0.2.9',releaseNotes:'<script>throw 1</script>'},localization:{locale:'zh-CN',messages:JSON.parse(fs.readFileSync(path.join(__dirname,'../../platform/wab/src/wab/client/i18n/locales/zh-CN.json'),'utf8'))}});
 assert.equal(ui.el('update-heading').textContent,'软件更新');
 assert.equal(ui.el('update-install').textContent,'重启并安装');
 assert.equal(ui.window.document.querySelector('#update-panel script'),null);
 assert.equal(ui.window.document.documentElement.dataset.uiAppearance,'light');
 ui.send({update:{phase:'disabled',currentVersion:'0.2.8'}});
 assert.equal(ui.el('capsule-update').hidden,true);assert.equal(ui.el('update-install').hidden,true);
});
