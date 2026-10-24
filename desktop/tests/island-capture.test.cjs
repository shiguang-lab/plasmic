const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { inspectViewport, presentationRect, captureIslandView } = require("../src/island-capture.cjs");

test("canvas mirror excludes floating editor chrome, follows panel visibility, and never changes DOM", (t) => {
  const dom = new JSDOM('<div class="canvas-editor__canvas-clipper"><iframe class="canvas-editor__viewport"></iframe></div><aside class="canvas-editor__left-pane-container"></aside><aside class="canvas-editor__left-pane" hidden></aside><aside class="canvas-editor__right-pane"></aside><header class="canvas-editor__top-bar"></header><footer data-test-id="canvas-view-controls"></footer>', { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const doc = dom.window.document;
  doc.querySelector('iframe').checkVisibility = () => false;
  const rects = [
    [".canvas-editor__canvas-clipper", 0, 0, 1000, 700],
    [".canvas-editor__left-pane-container", 8, 58, 36, 634],
    [".canvas-editor__left-pane", 52, 58, 260, 590],
    [".canvas-editor__right-pane", 672, 58, 320, 590],
    [".canvas-editor__top-bar", 8, 8, 984, 42],
    ['[data-test-id="canvas-view-controls"]', 750, 656, 242, 36],
  ];
  for (const [selector, x, y, width, height] of rects) {
    const el = doc.querySelector(selector);
    el.checkVisibility = () => !el.hidden;
    el.getBoundingClientRect = () => ({ x, y, width, height, left: x, top: y, right: x + width, bottom: y + height });
  }
  const before = doc.body.innerHTML;
  const inspect = () => dom.window.eval(`(${inspectViewport.toString()})("edit")`);
  assert.deepEqual(JSON.parse(JSON.stringify(inspect())), { x: 44, y: 50, width: 628, height: 606 });
  assert.equal(doc.body.innerHTML, before);
  doc.querySelector("iframe").remove();
  assert.deepEqual(JSON.parse(JSON.stringify(inspect())), { x: 44, y: 50, width: 628, height: 606 }, "new projects without artboards still mirror their real empty canvas");
  doc.querySelector(".canvas-editor__left-pane").hidden = false;
  assert.equal(inspect().x, 312);
  doc.querySelector(".canvas-editor__right-pane").hidden = true;
  assert.equal(inspect().width, 688);
});

test("editor framing trims only outer workspace around every visible artboard and preserves empty/Preview views", (t) => {
  const dom = new JSDOM('<div class="canvas-editor__canvas-clipper"><iframe class="canvas-editor__viewport"></iframe><iframe class="canvas-editor__viewport"></iframe><iframe class="canvas-editor__viewport"></iframe></div><div class="live-root-container" data-plasmic-preview-component="page"></div>', {runScripts:'outside-only'});
  t.after(() => dom.window.close());
  const doc = dom.window.document;
  const boxes = [[0,0,1000,700],[150,100,200,300],[450,150,300,400],[1100,0,200,300]];
  [doc.querySelector('.canvas-editor__canvas-clipper'),...doc.querySelectorAll('iframe')].forEach((el,index) => {
    const [x,y,width,height]=boxes[index];
    el.checkVisibility=()=>!el.hidden;
    el.getBoundingClientRect=()=>({x,y,width,height,left:x,top:y,right:x+width,bottom:y+height});
  });
  const inspect=(mode='edit')=>JSON.parse(JSON.stringify(dom.window.eval(`(${inspectViewport.toString()})(${JSON.stringify(mode)},"page")`)));
  const before=doc.body.innerHTML;
  assert.deepEqual(inspect(),{x:134,y:84,width:632,height:482});
  assert.equal(doc.body.innerHTML,before,'framing must not pan, zoom or mutate the source');
  doc.querySelectorAll('iframe')[1].hidden=true;
  assert.deepEqual(inspect(),{x:134,y:84,width:232,height:332},'hidden and offscreen pages do not pull framing away');
  doc.querySelector('iframe').hidden=true;
  assert.deepEqual(inspect(),{x:0,y:0,width:1000,height:700},'empty workspace stays visible');
  assert.deepEqual(inspect('preview'),{x:0,y:0,width:1024,height:768},'Preview retains its real full viewport');
});

test("native capture maps nested frame borders/scales and retains source aspect ratio while hidden", async () => {
  const calls = [];
  const parent = { frames: [], executeJavaScript: async () => ({ x: 20, y: 30, sx: .5, sy: .5 }) };
  const frame = { parent, executeJavaScript: async () => ({ x: 40, y: 50, width: 1200, height: 800 }) };
  parent.frames.push(frame);
  assert.deepEqual(await presentationRect(frame, { x: 40, y: 50, width: 1200, height: 800 }), { x: 40, y: 55, width: 600, height: 400 });
  const image = { isEmpty: () => false, getSize: () => ({ width: 1200, height: 800 }), resize: (size) => { calls.push(size); return image; }, toJPEG: () => Buffer.from("jpeg") };
  const win = { isDestroyed: () => false, getContentBounds: () => ({ width: 1000, height: 800 }), webContents: {
    getURL: () => "https://studio.test/projects/p", getZoomFactor: () => 1.25,
    mainFrame: { framesInSubtree: [frame] }, capturePage: async (...args) => { calls.push(args); return image; },
  } };
  const result = await captureIslandView(win, { mode: "edit" });
  assert.deepEqual(calls[0], [{ x: 50, y: 69, width: 750, height: 500 }, { stayHidden: true, stayAwake: true }]);
  assert.deepEqual(calls[1], { width: 600, height: 400 });
  assert.equal(result.width / result.height, 1.5);
  assert.equal(result.src, "data:image/jpeg;base64,anBlZw==");
});

test("invisible background inspections cannot invalidate feedback for a visible canvas", async () => {
  const parent = { frames: [], executeJavaScript: async () => null };
  const hidden = { parent };
  parent.frames.push(hidden);
  assert.equal(await presentationRect(hidden, { x:0,y:0,width:1440,height:1024 }), null);
  const frame = { executeJavaScript: async () => ({x:0,y:0,width:800,height:600}) };
  const background = { parent, executeJavaScript: async () => [{x:0,y:0,width:1440,height:1024}] };
  const image = { isEmpty:()=>false,getSize:()=>({width:800,height:600}),resize(){return this},toJPEG:()=>Buffer.from('pixels') };
  const context = {projectId:'p',sessionId:'s',mode:'edit',arenaId:'a'};
  const win = {isDestroyed:()=>false,getContentBounds:()=>({width:800,height:600}),webContents:{
    getURL:()=>'url',getZoomFactor:()=>1,mainFrame:{framesInSubtree:[frame,background]},capturePage:async()=>image,
  }};
  // The visible document has no matching target; only the hidden inspection does.
  let reads=0;frame.executeJavaScript=async()=> ++reads===1 ? {x:0,y:0,width:800,height:600} : [];
  const result=await captureIslandView(win,context,{...context,id:'read',url:'url',kind:'read',phase:'running',targets:[{componentUuid:'offscreen'}]});
  assert.ok(result.src);
  assert.equal(result.feedback,null);
});
