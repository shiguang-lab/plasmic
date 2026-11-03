const test = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const Module = require('node:module');
const original = Module._load;
let nextId = 0;
class View {
  constructor() {
    const contents = this.webContents = new EventEmitter();
    contents.id = ++nextId;
    contents.url = '';
    contents.getURL = () => contents.url;
    contents.isDestroyed = () => !!contents.destroyed;
    contents.close = options => {assert.deepEqual(options,{waitForBeforeUnload:false});contents.destroyed=true;contents.emit('destroyed');};
    contents.loads = [];
    contents.loadURL = async url => {contents.loads.push(url);contents.url=url;contents.emit('did-navigate',{},url);};
    contents.send = (channel, state) => {if(channel==='desktop:view-state' && state.active && state.url)contents.url=state.url;};
    contents.getTitle = () => 'Fixture';
    contents.isCrashed = () => false;
    contents.focus = () => {};
  }
  setVisible(visible) {this.visible=visible;}
  setBounds(bounds) {this.bounds=bounds;}
  setBackgroundColor(color) {this.color=color;}
}
Module._load = function(name,...args) {return name==='electron'?{WebContentsView:View}:original.call(this,name,...args)};
const {StudioWindow}=require('../src/studio-window.cjs');
Module._load=original;
function fixture(beforeNavigate=async()=>{}) {
  const window=new EventEmitter(),children=[];
  window.contentView={addChildView:v=>{const i=children.indexOf(v);if(i>=0)children.splice(i,1);children.unshift(v);},removeChildView:v=>{const i=children.indexOf(v);if(i>=0)children.splice(i,1);}};
  window.getContentSize=()=>[1200,800];window.isDestroyed=()=>!!window.destroyed;window.isFocused=()=>true;window.setTitle=title=>{window.title=title;};
  const studio=new StudioWindow(window,{webPreferences:{sandbox:true},studioOrigin:'https://studio.test',backgroundColor:'#fff',projectId:url=>new URL(url||'about:blank').pathname.match(/^\/projects\/([^/]+)/)?.[1],beforeNavigate});
  return {window,studio,children};
}
test('keeps the Dashboard runtime and destroys only project renderers',async()=>{
  const {window,studio,children}=fixture();
  await studio.loadURL('https://studio.test/projects');const dashboard=studio.webContents;
  await studio.loadURL('https://studio.test/projects/first');const editor=studio.webContents;
  assert.notEqual(editor.id,dashboard.id);assert.equal(dashboard.isDestroyed(),false);assert.equal(studio.dashboard.visible,false);
  await studio.loadURL('https://studio.test/projects/first/preview');assert.equal(studio.webContents,editor);
  await studio.loadURL('https://studio.test/projects');assert.equal(editor.isDestroyed(),true);
  assert.equal(studio.webContents,dashboard);assert.equal(dashboard.loads.length,1);
  assert.equal(studio.window,window);assert.equal(children.length,1);assert.deepEqual(studio.view.bounds,{x:0,y:0,width:1200,height:800});
});
test('a pending or failed draft backup keeps the current renderer intact',async()=>{
  let release;let protect=async()=>{};
  const {studio}=fixture(()=>protect());await studio.loadURL('https://studio.test/projects/first');const editor=studio.webContents;
  protect=()=>new Promise(resolve=>{release=resolve;});const leaving=studio.loadURL('https://studio.test/projects');await new Promise(setImmediate);
  assert.equal(studio.webContents,editor);assert.equal(editor.isDestroyed(),false);release();await leaving;
  protect=async()=>{throw Error('Draft not protected');};const dashboard=studio.webContents;
  await assert.rejects(studio.loadURL('https://studio.test/projects/second'),/Draft not protected/);
  assert.equal(studio.webContents,dashboard);assert.equal(dashboard.isDestroyed(),false);
  protect=async()=>{};await studio.loadURL('https://studio.test/projects/second');assert.notEqual(studio.webContents,dashboard);
});
test('closing the native window destroys its owned WebContentsView',async()=>{
  const {studio,window}=fixture();await studio.loadURL('https://studio.test/projects/first');const editor=studio.webContents;
  window.destroyed=true;window.emit('closed');assert.equal(editor.isDestroyed(),true);assert.equal(studio.webContents,undefined);assert.equal(window.listenerCount('resize'),0);
});
test('direct trusted navigations use the same boundary; foreign origins are rejected',async()=>{
  const {studio}=fixture();await studio.loadURL('https://studio.test/projects/first');const old=studio.webContents;let prevented=false;
  old.emit('will-navigate',{preventDefault(){prevented=true}},'https://studio.test/projects');await new Promise(setImmediate);await studio.navigation;
  assert.equal(prevented,true);assert.equal(old.isDestroyed(),true);
  const current=studio.webContents;await assert.rejects(studio.loadURL('https://other.test/projects/first'),/Invalid Studio destination/);assert.equal(studio.webContents,current);
});

test('reuses Dashboard state but never a previous project renderer',async()=>{
  const {studio}=fixture();await studio.loadURL('https://studio.test/projects');
  const dashboard=studio.webContents;dashboard.selection={filter:'customer',scroll:230};
  await studio.loadURL('https://studio.test/projects/first');const first=studio.webContents;
  await studio.loadURL('https://studio.test/projects/second');assert(first.isDestroyed());
  const second=studio.webContents;await studio.loadURL('https://studio.test/projects');
  assert(second.isDestroyed());assert.equal(studio.webContents,dashboard);
  assert.deepEqual(dashboard.selection,{filter:'customer',scroll:230});assert.equal(dashboard.loads.length,1);
});
test('invalidates hidden Dashboard contents when the sign-in session changes',async()=>{
  const {studio}=fixture();await studio.loadURL('https://studio.test/projects');const old=studio.webContents;
  await studio.loadURL('https://studio.test/projects/first');const editor=studio.webContents;
  studio.invalidateDashboard();assert(old.isDestroyed());assert.equal(studio.webContents,editor);
  await studio.loadURL('https://studio.test/projects');assert.notEqual(studio.webContents,old);
  assert.equal(studio.webContents.getURL(),'https://studio.test/projects');assert(editor.isDestroyed());
});
test('a hidden Dashboard cannot initiate a project navigation',async()=>{
  const {studio}=fixture();await studio.loadURL('https://studio.test/projects');const dashboard=studio.webContents;
  await studio.loadURL('https://studio.test/projects/first');const editor=studio.webContents;
  let prevented=false;dashboard.emit('will-navigate',{preventDefault(){prevented=true}},'https://studio.test/projects/second');
  await new Promise(setImmediate);assert(prevented);assert.equal(studio.webContents,editor);
});

test('direct project launches prepare one hidden Dashboard without changing the active editor',async()=>{
  const {studio}=fixture();await studio.loadURL('https://studio.test/projects/first');
  await studio.dashboardLoad;
  assert.equal(studio.webContents,studio.editor.webContents);
  assert.equal(studio.dashboard.webContents.getURL(),'https://studio.test/projects');
  assert.equal(studio.dashboard.visible,false);
  await studio.prepareDashboard();assert.equal(studio.dashboard.webContents.loads.length,1);
});
test('failed Dashboard preparation can retry without disturbing the editor',async()=>{
  const {studio}=fixture();await studio.loadURL('https://studio.test/projects');
  await studio.loadURL('https://studio.test/projects/first');const editor=studio.webContents;
  const dashboard=studio.dashboard.webContents,load=dashboard.loadURL;
  dashboard.url='';dashboard.loadURL=async()=>{throw Error('Offline');};
  await assert.rejects(studio.prepareDashboard(),/Offline/);
  dashboard.loadURL=load;await studio.prepareDashboard();
  assert.equal(studio.webContents,editor);assert.equal(editor.isDestroyed(),false);
  assert.equal(dashboard.getURL(),'https://studio.test/projects');
});
