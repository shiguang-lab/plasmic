const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { EventEmitter } = require("node:events");
const { JSDOM } = require("jsdom");
const surfaces = [];
class Surface {
  constructor(options) {
    this.options = options; this.width = options.width; this.height = options.height;
    this.webContents = Object.assign(new EventEmitter(), {setWindowOpenHandler(){}, executeJavaScript:async script=>{if(script.includes("loadScene"))this.document=script;}, mainFrame:{frames:[{executeJavaScript:async()=>{}}]},
      invalidate:()=>queueMicrotask(()=>this.webContents.emit("paint", {}, {}, {isEmpty:()=>false,getSize:()=>({width:this.width,height:this.height}),toJPEG:()=>Buffer.from("pixels")}))});
    surfaces.push(this);
  }
  setContentSize(width,height) { this.width=width; this.height=height; }
  async loadURL(url) { assert.equal(url,"about:blank","large compositions never travel through a data URL"); }
  destroy() { this.destroyed=true; this.webContents.emit("destroyed"); }
}
const originalLoad = Module._load;
Module._load = function(name,...args) { return name === "electron" ? {app:{isPackaged:true},BrowserWindow:Surface} : originalLoad.call(this,name,...args); };
const { inspectScene, sceneDocument, presentationRect, createIslandCapture } = require("../src/island-capture.cjs");
const { snapshotDocument } = require("../src/canvas.cjs");
Module._load = originalLoad;

function fixture(t) {
  const dom = new JSDOM('<div class="canvas-editor__canvas-clipper"><iframe class="canvas-editor__viewport"></iframe><iframe class="canvas-editor__viewport"></iframe><iframe class="canvas-editor__viewport" hidden></iframe></div><aside class="canvas-editor__left-pane">Structure tree</aside><div class="floating-toolbar">Tools</div>', {runScripts:"outside-only"});
  t.after(()=>dom.window.close());
  const doc=dom.window.document, boards=[...doc.querySelectorAll("iframe")];
  doc.querySelector(".canvas-editor__canvas-clipper").checkVisibility=()=>true;
  let scale=1, pan={x:100,y:50};
  boards.forEach((el,index)=>{
    el.checkVisibility=()=>!el.hidden;
    for (const [key,value] of Object.entries({clientWidth:400,clientHeight:300,offsetWidth:400,offsetHeight:300})) Object.defineProperty(el,key,{value});
    el.getBoundingClientRect=()=>({x:pan.x+index*1200*scale,y:pan.y+index*100*scale,width:400*scale,height:300*scale});
  });
  const inspect=()=>JSON.parse(JSON.stringify(dom.window.eval(`(${inspectScene.toString()})("edit")`)));
  return {dom,doc,boards,inspect,move:()=>{scale=2.5;pan={x:-3000,y:-1800};}};
}

test("complete artboards include offscreen boards and retain layout independently of editor zoom, pan and chrome", t=>{
  const f=fixture(t), before=f.doc.body.innerHTML, scene=f.inspect();
  assert.deepEqual(scene.boards,[{index:0,frameUuid:null,componentUuid:null,x:16,y:16,width:400,height:300},{index:1,frameUuid:null,componentUuid:null,x:1216,y:116,width:400,height:300}]);
  assert.equal(scene.width,1632); assert.equal(scene.height,432);
  f.move();
  assert.deepEqual(f.inspect(),scene,"offscreen translation and editor zoom cannot crop or reframe artboards");
  assert.equal(f.doc.body.innerHTML,before,"inspection never changes live DOM, panels or viewport");
  f.boards[1].hidden=true;
  assert.equal(f.inspect().width,432,"display:none artboards belong to other views and are excluded");
  f.boards[0].hidden=true;
  assert.deepEqual(f.inspect().boards,[],"empty canvases retain a clean workspace");
});

test("scene fitting preserves each source viewport and puts the full composition inside the thumbnail",()=>{
  const scene={width:3200,height:1800,background:"rgb(30, 32, 34)"};
  const board={x:1600,y:800,width:1440,height:900,html:'<html><body><p title="a & b">Complete page</p></body></html>'};
  const result=sceneDocument(scene,[board]);
  assert.equal(result.width,711); assert.equal(result.height,400);
  assert.ok(result.html.includes('width:1440px;height:900px'));
  assert.ok(result.html.includes('&lt;html>'));
  assert.ok(!result.html.includes('<p title='),"source markup stays inside its isolated srcdoc");
});

test("static source copies remove editor-only overlays and executable content without mutating the live artboard",t=>{
  const dom=new JSDOM('<html><head><style>p{color:red}</style><script>window.bad=true</script></head><body><main><p>Business page</p><input><canvas width="40" height="30"></canvas><div data-plasmic-editor-only>Floating tools</div><div data-plasmic-slot-placeholder>Slot hint</div><button onclick="bad()">Save</button></main></body></html>',{runScripts:"outside-only",url:"https://canvas.test/host"});
  t.after(()=>dom.window.close());
  dom.window.crypto.randomUUID=require("node:crypto").randomUUID;
  dom.window.document.querySelector("input").value="Current value";
  dom.window.document.querySelector("canvas").toDataURL=()=>"data:image/png;base64,cGl4ZWxz";
  const before=dom.window.document.documentElement.outerHTML;
  const html=dom.window.eval(`(${snapshotDocument.toString()})()`);
  assert.ok(html.includes("Business page") && html.includes("Current value"));
  assert.ok(html.includes("data:image/png;base64,cGl4ZWxz") && !html.includes("<canvas"),"live canvas pixels survive static capture");
  assert.ok(!html.includes("Floating tools") && !html.includes("Slot hint"));
  assert.ok(!html.includes("window.bad") && !html.includes("onclick="));
  assert.equal(dom.window.document.documentElement.outerHTML,before);
});

test("mirror copies preserve content isolation styles while normal exports and editor chrome stay excluded",t=>{
  const dom=new JSDOM('<html data-plasmic-content-editor><head><style data-plasmic-editor-style data-plasmic-content-editor-style>html[data-plasmic-content-editor] body * {visibility:hidden} [data-plasmic-content-target] {visibility:visible;position:absolute;left:32px;top:48px;overflow:visible}</style><style data-plasmic-editor-style>.selection-only {outline:1px solid red}</style></head><body data-plasmic-content-ancestor><aside>Other page content</aside><main data-plasmic-content-target>Expanded scroll content</main><div data-plasmic-editor-only>Editor toolbar</div></body></html>',{runScripts:"outside-only",url:"https://canvas.test/host"});
  t.after(()=>dom.window.close());
  dom.window.crypto.randomUUID=require("node:crypto").randomUUID;
  for(const style of dom.window.document.querySelectorAll("style")) Object.defineProperty(style.sheet,"ownerNode",{value:style});
  const before=dom.window.document.documentElement.outerHTML;
  const capture=input=>dom.window.eval(`(${snapshotDocument.toString()})(${JSON.stringify(input)})`);
  const mirror=capture({preserveContentEditor:true}), exported=capture({});
  assert.ok(mirror.includes("body * {visibility: hidden;}"));
  assert.ok(mirror.includes("position: absolute;") && mirror.includes("overflow: visible;"));
  assert.ok(!mirror.includes(".selection-only") && !mirror.includes("Editor toolbar"));
  assert.ok(!exported.includes("body * {visibility: hidden;}"));
  assert.equal(dom.window.document.documentElement.outerHTML,before,"copying never exits or changes the live editing mode");
});

test("clean compositor is reused, never captures editor chrome, and is released on mode exit",async()=>{
  const scene={width:1632,height:432,background:"#202126",boards:[{index:0,x:16,y:16,width:400,height:300},{index:1,x:1216,y:116,width:400,height:300}]};
  const largeDocument="<html><body>"+"Full board ".repeat(220_000)+"</body></html>";
  const source={executeJavaScript:async script=>script.includes("snapshotDocument")?largeDocument:script.includes("data-plasmic-render-ready")?true:[]};
  const frame={frames:[source,source],executeJavaScript:async()=>scene};
  const win={isDestroyed:()=>false,webContents:{getURL:()=>"url",session:{},mainFrame:{framesInSubtree:[frame]},capturePage:()=>assert.fail("Editor compositor must not be captured")}};
  const mirror=createIslandCapture(), before=surfaces.length;
  const context={mode:"edit",projectId:"p",sessionId:"s",arenaId:"a"};
  const result=await mirror.capture(win,context,{...context,id:"read",url:"url",kind:"read",phase:"running",targets:[{viewport:true}]},[]);
  assert.equal(result.width,1632); assert.equal(result.height,432);
  assert.deepEqual(result.feedback.regions,[{x:0,y:0,width:1,height:1}]);
  await mirror.capture(win,context,undefined,[]);
  assert.equal(surfaces.length,before+1);
  const renderer=surfaces.at(-1);
  assert.equal(renderer.options.webPreferences.offscreen,true);
  assert.equal(renderer.options.webPreferences.nodeIntegration,false);
  assert.equal((renderer.document.match(/<iframe /g)||[]).length,2);
  assert.equal(renderer.webContents.listenerCount("will-navigate"),1,"repeated refreshes do not accumulate handlers");
  mirror.close(); assert.equal(renderer.destroyed,true);
});

test("releasing capture resources preserves the displayed page after operation completion and expiry",async()=>{
  const scene={width:772,height:562,background:"#222",boards:[
    {index:0,frameUuid:"a",componentUuid:"page-a",x:16,y:16,width:360,height:400},
    {index:1,frameUuid:"b",componentUuid:"page-b",x:416,y:86,width:340,height:460},
  ]};
  const source={executeJavaScript:async script=>script.includes("data-plasmic-render-ready")?true:"<html><body>Page</body></html>"};
  const frame={frames:[source,source],executeJavaScript:async()=>scene};
  const win={isDestroyed:()=>false,webContents:{getURL:()=>"url",session:{},mainFrame:{framesInSubtree:[frame]}}};
  const context={mode:"edit",projectId:"p",sessionId:"s",arenaId:"arena"};
  const read={...context,id:"read",kind:"read",phase:"running",targets:[{frameUuid:"b"}]};
  const mirror=createIslandCapture();
  const focused=await mirror.capture(win,context,read,[read]);
  assert.equal(focused.framing,"page"); assert.equal(focused.width,340); assert.equal(focused.height,460);
  const renderer=surfaces.at(-1);
  mirror.close();
  assert.equal(renderer.destroyed,true,"collapse still releases the hidden renderer");
  const completed=await mirror.capture(win,context,{...read,phase:"completed"},[]);
  assert.equal(completed.framing,"page"); assert.equal(completed.src,focused.src); assert.equal(completed.width,340); assert.equal(completed.height,460);
  mirror.close();
  const expired=await mirror.capture(win,context,undefined,[]);
  assert.equal(expired.framing,"page"); assert.equal(expired.width,340); assert.equal(expired.height,460);
  const changed=await mirror.capture(win,{...context,arenaId:"another"},undefined,[]);
  assert.equal(changed.framing,"overview","actual canvas changes still discard the previous page scope");
  mirror.close();
});

test("closing the mirror cancels pending capture work before reopening",{timeout:1000},async()=>{
  let started;
  const snapshotStarted=new Promise(resolve=>{started=resolve;});
  const scene={width:432,height:332,boards:[{index:0,x:16,y:16,width:400,height:300}]};
  const source={executeJavaScript:async script=>{
    if(script.includes("snapshotDocument")){started();return new Promise(()=>{});}
    return true;
  }};
  const frame={frames:[source],executeJavaScript:async()=>scene};
  const win={isDestroyed:()=>false,webContents:{getURL:()=>"url",session:{},mainFrame:{framesInSubtree:[frame]}}};
  const mirror=createIslandCapture(), pending=mirror.capture(win,{mode:"edit"},undefined,[]);
  await snapshotStarted;
  mirror.close();
  await assert.rejects(pending,{name:"AbortError"});
  source.executeJavaScript=async script=>script.includes("data-plasmic-render-ready")?true:"<html><body>Ready</body></html>";
  assert.ok((await mirror.capture(win,{mode:"edit"},undefined,[])).src);
  mirror.close();
});

test("cached pixels survive collapse; only content, scope and dynamic changes render again",async()=>{
  const stamp={id:"document",revision:0,changedAt:0,dynamic:false};
  let snapshots=0;
  const source={executeJavaScript:async script=>{
    if(script.includes("inspectVisualState")) return {...stamp};
    if(script.includes("snapshotDocument")){snapshots++;return "<html><body>Page</body></html>";}
    return true;
  }};
  const scene={width:432,height:332,boards:[{index:0,x:16,y:16,width:400,height:300}]};
  const frame={frames:[source],executeJavaScript:async()=>scene};
  const win={isDestroyed:()=>false,webContents:{getURL:()=>"url",session:{},mainFrame:{framesInSubtree:[frame]}}};
  const context={projectId:"p",sessionId:"s",arenaId:"a",mode:"edit",changeCounter:0};
  const mirror=createIslandCapture(), first=await mirror.capture(win,context,undefined,[]);
  await mirror.capture(win,context,undefined,[]);
  assert.equal(snapshots,1,"idle polling never clones or renders the document again");
  mirror.close();
  const count=surfaces.length;
  const read={...context,id:"read",url:"url",kind:"read",phase:"running",targets:[{viewport:true}]};
  const reopened=await mirror.capture(win,context,read,[read]);
  assert.equal(reopened.capturedAt,first.capturedAt); assert.equal(reopened.feedback.id,"read");
  assert.equal(surfaces.length,count,"reopening a clean view does not recreate a rendering window");
  await mirror.capture(win,{...context,changeCounter:1},undefined,[]);
  assert.equal(snapshots,2,"unsaved model changes refresh");
  stamp.revision++;
  await mirror.capture(win,{...context,changeCounter:1},undefined,[]);
  assert.equal(snapshots,3,"runtime and asynchronous document changes refresh");
  stamp.revision++; stamp.changedAt=Date.now();
  await mirror.capture(win,{...context,changeCounter:1},undefined,[]);
  assert.equal(snapshots,3,"a burst of changes retains the old image until settled");
  stamp.changedAt=Date.now()-200;
  await mirror.capture(win,{...context,changeCounter:1},undefined,[]);
  assert.equal(snapshots,4);
  stamp.dynamic=true;
  await mirror.capture(win,{...context,changeCounter:1},undefined,[]);
  await mirror.capture(win,{...context,changeCounter:1},undefined,[]);
  assert.equal(snapshots,6,"active animations and canvas content retain live refreshes");
  stamp.dynamic=false; scene.boards[0].width=500;
  await mirror.capture(win,{...context,changeCounter:1},undefined,[]);
  assert.equal(snapshots,7,"artboard layout is part of the cache identity");
  await mirror.capture(win,{...context,sessionId:"other",changeCounter:1},undefined,[]);
  assert.equal(snapshots,8,"another project session cannot reuse the old pixels");
  mirror.close();
});

test("Preview retains its current complete viewport and nested presentation mapping",async()=>{
  const parent={frames:[],executeJavaScript:async()=>({x:20,y:30,sx:.5,sy:.5})};
  const frame={parent,executeJavaScript:async()=>({width:1200,height:800})}; parent.frames.push(frame);
  assert.deepEqual(await presentationRect(frame,{x:40,y:50,width:1200,height:800}),{x:40,y:55,width:600,height:400});
  const calls=[], image={isEmpty:()=>false,getSize:()=>({width:1200,height:800}),resize:size=>{calls.push(size);return image;},toJPEG:()=>Buffer.from("jpeg")};
  const win={isDestroyed:()=>false,webContents:{getURL:()=>"url",getZoomFactor:()=>1.25,mainFrame:{framesInSubtree:[frame]},capturePage:async(...args)=>{calls.push(args);return image;}}};
  const mirror=createIslandCapture(), result=await mirror.capture(win,{mode:"preview"},undefined,[]);
  assert.deepEqual(calls[0],[{x:25,y:38,width:750,height:500},{stayHidden:true,stayAwake:true}]);
  assert.deepEqual(calls[1],{width:600,height:400});
  assert.equal(result.width/result.height,1.5);
});

test("overview activates source rendering and waits for every artboard before publishing a complete image",async()=>{
  let ready=false, enabled=false;
  const source={executeJavaScript:async script=>script.includes("data-plasmic-render-ready")?ready:"<html><body>Ready</body></html>"};
  const scene={width:432,height:332,background:"#222",boards:[{index:0,x:16,y:16,width:400,height:300}]};
  const frame={frames:[source],executeJavaScript:async script=>{
    if(script.includes("setAttribute")){enabled=true;return;}
    if(script.includes("removeAttribute")){enabled=false;return;}
    return scene;
  }};
  const win={isDestroyed:()=>false,webContents:{getURL:()=>"url",session:{},mainFrame:{framesInSubtree:[frame]}}};
  const mirror=createIslandCapture();
  assert.equal(await mirror.capture(win,{mode:"edit"},undefined,[]),null);
  assert.equal(enabled,true);
  ready=true;
  assert.ok((await mirror.capture(win,{mode:"edit"},undefined,[])).src);
  mirror.close();
  await Promise.resolve();
  assert.equal(enabled,false,"closing the mirror releases background rendering");
});
