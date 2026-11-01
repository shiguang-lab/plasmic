const test=require("node:test"),assert=require("node:assert/strict"),vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
function fixture() {
  const timers=new Map();let id=0,calls=0;
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/reference-browser.cjs"),"utf8"),{
    module,__dirname:path.join(__dirname,"../src"),require:name=>name.startsWith("node:")?require(name):{},
    setTimeout:(fn,delay)=>{const key={id:++id,unref(){}};timers.set(key,{fn,delay});return key;},clearTimeout:key=>timers.delete(key),
  });
  const browser=Object.create(module.exports.ReferenceBrowser.prototype);
  browser.visible=true;browser.pollGeneration=0;browser.state={selection:null,picking:false};
  browser.view={setVisible(){},webContents:{isDestroyed:()=>false}};
  browser.publish=()=>{};browser.snapshot=()=>browser.state;
  browser.picker=async()=>{calls++;return {selector:"#card",picking:false};};
  return {browser,timers,calls:()=>calls};
}
test("closing keeps the webpage but cancels polling; explicit hidden reads are one-shot",async()=>{
  const f=fixture(),view=f.browser.view;
  await f.browser.poll();assert.equal(f.timers.size,1);
  f.browser.hide();assert.equal(f.timers.size,0);assert.equal(f.browser.view,view);
  const calls=f.calls();await f.browser.poll();assert.equal(f.calls(),calls);
  await f.browser.command({action:"get_state"});assert.equal(f.calls(),calls+1);assert.equal(f.timers.size,0);
  f.browser.visible=true;await f.browser.poll();assert.equal(f.timers.size,1);
});
test("a pre-close response cannot overwrite reopened state or restart its polling",async()=>{
  const f=fixture();let resolve;
  f.browser.picker=method=>method==="clearRead"?Promise.resolve():new Promise(r=>{resolve=r;});
  const pending=f.browser.poll();f.browser.hide();f.browser.visible=true;f.browser.state.selection={selector:"#new"};
  resolve({selector:"#old",picking:true});await pending;
  assert.equal(f.browser.state.selection.selector,"#new");assert.equal(f.timers.size,0);
});
test("concurrent foreground polls leave one timer, and a disposed view cannot reschedule",async()=>{
  const f=fixture();await Promise.all([f.browser.poll(),f.browser.poll()]);assert.equal(f.timers.size,1);
  let resolve;f.browser.picker=()=>new Promise(r=>{resolve=r;});const pending=f.browser.poll();
  f.browser.view=undefined;resolve({selector:"#stale"});await pending;assert.equal(f.timers.size,0);
});
