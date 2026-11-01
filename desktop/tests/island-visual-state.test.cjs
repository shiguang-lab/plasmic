const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { inspectVisualState } = require("../src/island-visual-state.cjs");

function fixture(t) {
  const dom = new JSDOM('<html><body><main><p>Before</p><input><img></main></body></html>', {runScripts:"outside-only"});
  t.after(() => dom.window.close());
  dom.window.crypto.randomUUID = require("node:crypto").randomUUID;
  const read = (input) => JSON.parse(JSON.stringify(dom.window.eval(`(${inspectVisualState.toString()})(${JSON.stringify(input)})`)));
  return {window:dom.window,document:dom.window.document,read};
}

test("visual revisions ignore editor overlays and readiness bookkeeping but detect rendered content",t=>{
  const {document,read}=fixture(t), initial=read();
  assert.deepEqual(read(),initial,"idle inspection never invalidates the image");
  const overlay=document.createElement("div"); overlay.setAttribute("data-plasmic-editor-only","");
  document.body.append(overlay); overlay.textContent="Selection handles";
  document.documentElement.setAttribute("data-plasmic-render-ready","");
  assert.equal(read().revision,initial.revision);
  overlay.remove();
  assert.equal(read().revision,initial.revision);
  document.querySelector("p").textContent="After";
  const changed=read();
  assert.equal(changed.id,initial.id); assert.ok(changed.revision>initial.revision);
  assert.ok(changed.changedAt>0);
});

test("runtime input, scrolling, image loading and font completion invalidate without model edits",t=>{
  const {window,document,read}=fixture(t);
  document.fonts=new window.EventTarget();
  let revision=read().revision;
  for(const [target,event] of [[document.querySelector("input"),"input"],[document.querySelector("main"),"scroll"],[document.querySelector("img"),"load"],[document.fonts,"loadingdone"]]) {
    target.dispatchEvent(new window.Event(event));
    const next=read(); assert.ok(next.revision>revision,event); revision=next.revision;
  }
});

test("active animations and canvas pixels request live refreshes",t=>{
  const {document,read}=fixture(t);
  document.getAnimations=()=>[{playState:"running",effect:{target:document.querySelector("p")}}];
  assert.equal(read().dynamic,true);
  document.getAnimations=()=>[{playState:"paused"}];
  assert.equal(read().dynamic,false);
  document.body.append(document.createElement("canvas"));
  assert.equal(read().dynamic,true);
});

test("edit mirrors read canvas pixels once per inspection and invalidate only on changes",t=>{
  const {window,document,read}=fixture(t);
  let now=1000,pixels="data:image/png;base64,green",reads=0;
  t.mock.method(window.Date,"now",()=>now);
  const canvas=document.createElement("canvas");canvas.toDataURL=()=>{reads++;return pixels;};document.body.append(canvas);
  const first=read({captureCanvasPixels:true});assert.equal(first.dynamic,true);
  now+=200;
  const stable=read({captureCanvasPixels:true});assert.equal(stable.dynamic,false);assert.equal(stable.revision,first.revision);assert.equal(reads,2);
  pixels="data:image/png;base64,red";
  const changed=read({captureCanvasPixels:true});assert.equal(changed.dynamic,true);assert.ok(changed.revision>stable.revision);
  assert.equal(window.__plasmicIslandVisualState.canvasPixels.get(canvas),pixels);
  assert.equal(read({captureCanvasPixels:true}).dynamic,false);
  document.querySelector("p").textContent="Continuously changing content";
  assert.equal(read({captureCanvasPixels:true}).dynamic,true,"DOM changes in a canvas document retain immediate refresh");
  const count=reads;assert.equal(read().dynamic,true);assert.equal(reads,count,"Preview must not read or change canvas buffers");
});

test("unreadable canvas pixels keep live refresh and discard any cached pixel data",t=>{
  const {window,document,read}=fixture(t),canvas=document.createElement("canvas");
  canvas.toDataURL=()=>"data:image/png;base64,pixels";document.body.append(canvas);read({captureCanvasPixels:true});
  canvas.toDataURL=()=>{throw new window.DOMException("Tainted canvas","SecurityError");};
  assert.equal(read({captureCanvasPixels:true}).dynamic,true);
  assert.equal(window.__plasmicIslandVisualState.canvasPixels.has(canvas),false);
});
