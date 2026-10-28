const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { inspectVisualState } = require("../src/island-visual-state.cjs");

function fixture(t) {
  const dom = new JSDOM('<html><body><main><p>Before</p><input><img></main></body></html>', {runScripts:"outside-only"});
  t.after(() => dom.window.close());
  dom.window.crypto.randomUUID = require("node:crypto").randomUUID;
  const read = () => JSON.parse(JSON.stringify(dom.window.eval(`(${inspectVisualState.toString()})()`)));
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
