const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const {EventEmitter} = require('node:events');
const originalLoad = Module._load;
let destroyed = 0;
let capturedRect;
const image = {toPNG: () => Buffer.from('png'), toJPEG: () => Buffer.from('jpeg'), getSize: () => ({width:1366,height:1000}), crop: rect => {capturedRect=rect;return image;}};
const main = {webContents: {getURL: () => "https://studio.example/projects/test", session: {}, mainFrame: {framesInSubtree: [{url: 'https://canvas.example/static/host.html#canvas=true', executeJavaScript: async (script) => script.includes('snapshotDocument') ? '<html>snapshot</html>' : {ready: true, width: 1366, height: 900, elements: [{tag: "main"}], images: []}}]}}};
class Preview {
 constructor(options) { assert.equal(options.webPreferences.nodeIntegration, false); assert.equal(options.webPreferences.sandbox, true); this.webContents = Object.assign(new EventEmitter(), {setWindowOpenHandler(){},invalidate(){queueMicrotask(()=>this.emit('paint',{}, {},image));},executeJavaScript: async script => script.includes("Element is not visible") ? {x: 20, y: 30, width: 200, height: 80} : 1000, capturePage: async () => {throw new Error('Offscreen capturePage must not be used');}, printToPDF: async () => Buffer.from('%PDF')}); }
 async loadURL(url) {assert.ok(url.startsWith('data:text/html'));}
 setContentSize(width,height) {assert.equal(width,1366);assert.equal(height,1000);}
 destroy(){destroyed++;}
}
Module._load = function(name,...args) {return name === 'electron' ? {BrowserWindow: Preview} : originalLoad.call(this,name,...args)};
const {renderCanvas, exportCanvas, canvasFrames} = require('../src/canvas.cjs');
Module._load = originalLoad;
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
test('render uses an isolated static window and destroys it after capture', async () => {
 const result = await renderCanvas(main,'https://canvas.example',{width:1366});
 assert.equal(result.image,image);assert.equal(result.height,1000);assert.equal(destroyed,1);
 assert.equal((await canvasFrames(main,'https://canvas.example'))[0].layout.width,1366);
});
test('export checks path and extension, writes PDF bytes, and never overwrites',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'plasmic-export-test-'));
 try {
  await assert.rejects(exportCanvas(main,'https://canvas.example',{format:'png',outputPath:'relative.png'}),/absolute/);
  await assert.rejects(exportCanvas(main,'https://canvas.example',{format:'png',outputPath:path.join(dir,'wrong.html')}),/extension/);
  const outputPath=path.join(dir,'design.pdf');
  const result=await exportCanvas(main,'https://canvas.example',{format:'pdf',outputPath});
  assert.equal(result.interactive,false);assert.equal(await fs.readFile(outputPath,'utf8'),'%PDF');
  await assert.rejects(exportCanvas(main,'https://canvas.example',{format:'pdf',outputPath}),/EEXIST/);
 } finally {await fs.rm(dir,{recursive:true,force:true});}
});
test('live preview ignores retained editor canvases and reads only runtime state', async () => {
 const live = {url:'https://canvas.example/static/host.html#live=true',executeJavaScript:async()=>({ready:true,elements:[{text:'Count 13'}],images:[]})};
 const retained = {url:'https://canvas.example/static/host.html#canvas=true',executeJavaScript:async()=>{throw new Error('Read stale editor frame')}};
 const preview = {webContents:{getURL:()=> 'https://studio.example/projects/test/preview/workbench',mainFrame:{framesInSubtree:[retained,live]}}};
 const result=await canvasFrames(preview,'https://canvas.example');
 assert.equal(result.length,1);assert.equal(result[0].layout.elements[0].text,'Count 13');
});

test('crops a requested model UUID while keeping the artboard layout context', async () => {
 const result = await renderCanvas(main, 'https://canvas.example', {width: 1366, elementUuid: 'node'});
 assert.deepEqual(capturedRect, {x: 20, y: 30, width: 200, height: 80});
 assert.equal(result.width, 200); assert.equal(result.height, 80);
});
test('empty ready artboards remain capturable', async () => {
 const empty = {webContents: {getURL: () => 'https://studio.example/projects/test', mainFrame: {framesInSubtree: [{url: 'https://canvas.example/static/host.html#canvas=true', executeJavaScript: async () => ({ready: true, elements: [], images: [], width: 1366, height: 900})}]}}};
 assert.equal((await canvasFrames(empty, 'https://canvas.example')).length, 1);
});
test('captures the requested artboard when multiple pages have the same viewport', async () => {
 let captured;
 const frame = id => ({url:'https://canvas.example/static/host.html#canvas=true',executeJavaScript:async script=>{
  if(script.includes('snapshotDocument')){captured=id;return '<html>snapshot</html>';}
  return {ready:true,width:1366,height:900,elements:[{elementUuid:id}],images:[]};
 }});
 const overview={webContents:{...main.webContents,mainFrame:{framesInSubtree:[frame('first'),frame('second')]}}};
 await renderCanvas(overview,'https://canvas.example',{width:1366,artboardElementUuid:'first'});
 assert.equal(captured,'first');
 await assert.rejects(renderCanvas(overview,'https://canvas.example',{width:1366,artboardElementUuid:'missing'}),/not rendered/);
});
