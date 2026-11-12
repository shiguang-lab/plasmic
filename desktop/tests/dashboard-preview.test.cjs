const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const Module=require('node:module');
const ipcMain=new EventEmitter(),handlers=new Map(),windows=[];
ipcMain.handle=(name,handler)=>handlers.set(name,handler);
ipcMain.removeHandler=name=>handlers.delete(name);
class BrowserWindow {
  constructor(options){this.options=options;this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=()=>{};this.webContents.send=()=>{};this.webContents.stopPainting=()=>{this.painting=false;};windows.push(this);}
  async loadURL(){assert.equal(this.painting,false,'OSR frame capture must stop before loading the preview');}
  isDestroyed(){return !!this.destroyed;}
  destroy(){this.destroyed=true;}
}
const load=Module._load;
Module._load=function(name,...args){return name==='electron'?{BrowserWindow,app:{isPackaged:false},ipcMain}:load.call(this,name,...args);};
const {createDashboardPreviews}=require('../src/dashboard-preview.cjs');
Module._load=load;
const createPreviews = options => createDashboardPreviews({
  session: {}, studioOrigin: 'https://studio.test', trustedSender: () => true, waitForEditorExit: () => {}, ...options,
});
test('retiring a Dashboard cancels its running and queued previews without cancelling another owner',async()=>{
  const previews=createPreviews();
  const owner=new EventEmitter(),other=new EventEmitter();
  const render=(sender,id)=>handlers.get('desktop:dashboard-preview')({sender},id,'https://studio.test/canvas-preview/index.html',{projectId:'fixture',revision:1},1);
  const first=render(owner,'first'),queued=render(owner,'queued'),next=render(other,'other');
  const rejectedFirst=assert.rejects(first,{name:'AbortError'}),rejectedQueued=assert.rejects(queued,{name:'AbortError'});
  await new Promise(setImmediate);assert.equal(windows.length,1);
  assert.deepEqual(windows[0].options.webPreferences.offscreen,{deviceScaleFactor:1});
  assert.equal(windows[0].options.webPreferences.backgroundThrottling,false);
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

test('opening an editor cancels pending thumbnail admission; returning can try again',async()=>{
  const offset=windows.length;
  let admission;
  const previews = createPreviews({waitForEditorExit: signal => new Promise((resolve, reject) => {
    admission = {signal, resolve};
    signal.addEventListener('abort', () => reject(signal.reason), {once: true});
  })});
  const owner = new EventEmitter();
  const render = id => handlers.get('desktop:dashboard-preview')({sender:owner},id,'https://studio.test/canvas-preview/index.html',{projectId:'fixture',revision:1},1);
  const cancelled = assert.rejects(render('first-return'), {name:'AbortError'});
  await new Promise(setImmediate);
  assert.equal(windows.length, offset);
  const first = admission;
  previews.cancelFor(owner);
  await cancelled;
  assert(first.signal.aborted);
  const result = render('second-return');
  await new Promise(setImmediate);
  assert.notEqual(admission, first);
  assert.equal(windows.length, offset);
  admission.resolve();
  await new Promise(setImmediate);
  assert.equal(windows.length, offset+1);
  ipcMain.emit('desktop:preview-host-result',{sender:windows[offset].webContents},Buffer.from('image'));
  assert.deepEqual(await result, new Uint8Array(Buffer.from('image')));
  previews.dispose();
});

for(const action of ['destroyed','navigation','account-invalidation']) {test(`owned work cancels on ${action}`,async()=>{
  const offset=windows.length;
  const previews=createPreviews();
  const owner=new EventEmitter();
  const render=id=>handlers.get('desktop:dashboard-preview')({sender:owner},id,'https://studio.test/canvas-preview/index.html',{projectId:'fixture',revision:1},1);
  const running=render('retire-running'),queued=render('retire-queued');
  const stopped=Promise.all([assert.rejects(running,{name:'AbortError'}),assert.rejects(queued,{name:'AbortError'})]);
  await new Promise(setImmediate);
  if(action==='destroyed'){owner.emit('destroyed');}
  else if(action==='navigation'){owner.emit('did-start-navigation',{},'https://studio.test/desktop/sign-in',false,true);}
  else {previews.cancelFor(owner);}
  await stopped; await new Promise(setImmediate);
  assert.equal(windows[offset].isDestroyed(),true);
  assert.equal(windows.length,offset+1);
  assert.equal(owner.listenerCount('destroyed'),0);
  assert.equal(owner.listenerCount('did-start-navigation'),0);
  previews.dispose();
});}

test('a hidden owner can release only its own registered job from its main frame',async()=>{
  const offset=windows.length;
  const owner=new EventEmitter(),other=new EventEmitter();owner.mainFrame={};other.mainFrame={};let active=owner;
  const previews=createPreviews({trustedSender:event=>event.sender===active});
  const pending=handlers.get('desktop:dashboard-preview')({sender:owner},'owned-job','https://studio.test/canvas-preview/index.html',{projectId:'fixture',revision:1},1);
  const stopped=assert.rejects(pending,{name:'AbortError'});
  await new Promise(setImmediate);active=other;
  ipcMain.emit('desktop:dashboard-preview-cancel',{sender:other,senderFrame:other.mainFrame},'owned-job');
  ipcMain.emit('desktop:dashboard-preview-cancel',{sender:owner,senderFrame:{}},'owned-job');
  assert.equal(windows[offset].isDestroyed(),false);
  await assert.rejects(async()=>handlers.get('desktop:dashboard-preview')({sender:owner},'new-hidden-job','https://studio.test/canvas-preview/index.html',{projectId:'fixture',revision:1},1),/Invalid Studio page/);
  ipcMain.emit('desktop:dashboard-preview-cancel',{sender:owner,senderFrame:owner.mainFrame},'owned-job');
  await stopped;
  assert.equal(windows[offset].isDestroyed(),true);
  previews.dispose();
});
