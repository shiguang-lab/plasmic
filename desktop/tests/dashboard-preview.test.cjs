const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const Module=require('node:module');
const ipcMain=new EventEmitter(),handlers=new Map(),windows=[];
ipcMain.handle=(name,handler)=>handlers.set(name,handler);
ipcMain.removeHandler=name=>handlers.delete(name);
class BrowserWindow {
  constructor(){this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=()=>{};this.webContents.send=()=>{};windows.push(this);}
  async loadURL(){}
  isDestroyed(){return !!this.destroyed;}
  destroy(){this.destroyed=true;}
}
const load=Module._load;
Module._load=function(name,...args){return name==='electron'?{BrowserWindow,app:{isPackaged:false},ipcMain}:load.call(this,name,...args);};
const {createDashboardPreviews}=require('../src/dashboard-preview.cjs');
Module._load=load;
test('deactivating a Dashboard cancels its running and queued previews without cancelling another owner',async()=>{
  const previews=createDashboardPreviews({session:{},studioOrigin:'https://studio.test',trustedSender:()=>true});
  const owner=new EventEmitter(),other=new EventEmitter();
  const render=(sender,id)=>handlers.get('desktop:dashboard-preview')({sender},id,'https://studio.test/canvas-preview/index.html',{projectId:'fixture',revision:1},1);
  const first=render(owner,'first'),queued=render(owner,'queued'),next=render(other,'other');
  const rejectedFirst=assert.rejects(first,{name:'AbortError'}),rejectedQueued=assert.rejects(queued,{name:'AbortError'});
  await new Promise(setImmediate);assert.equal(windows.length,1);
  previews.cancelFor(owner);
  await Promise.all([rejectedFirst,rejectedQueued]);await new Promise(setImmediate);
  assert.equal(windows.length,2);assert.equal(windows[0].destroyed,true);assert.equal(windows[1].isDestroyed(),false);
  ipcMain.emit('desktop:preview-host-result',{sender:windows[1].webContents},Buffer.from('image'));
  assert.deepEqual(await next,new Uint8Array(Buffer.from('image')));
  assert.equal(windows[1].destroyed,true);
  assert.equal(owner.listenerCount('destroyed'),0);assert.equal(owner.listenerCount('did-start-navigation'),0);
  assert.equal(ipcMain.listenerCount('desktop:preview-host-result'),0);
  previews.dispose();assert.equal(handlers.size,0);
});
