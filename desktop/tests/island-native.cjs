// Electron integration fixture: real IPC, stdio MCP, hidden compositor and windows.
// The deterministic editor below is a fixture, not the full Studio application.
const { app, BrowserWindow, ipcMain, session, Menu, screen } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { DesktopController } = require("../src/controller.cjs");
const { createIsland, containsPoint } = require("../src/island.cjs");
const { createDesktopI18n } = require("../src/i18n.cjs");
const { createDesktopAppearance } = require("../src/ui-appearance.cjs");
const { startRpc } = require("../src/local-rpc.cjs");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-island-native-"));
app.setPath("userData", profile);
app.setName("Plasmic Island integration");
// This fixture owns shutdown, including the test that closes its main window.
app.on("window-all-closed", () => {});
const origin = "https://island.studio.test", canvasOrigin = "https://island.canvas.test";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const root = path.resolve(__dirname, "..");
const reportDir = process.env.PLASMIC_ISLAND_REPORT_DIR || path.join(os.tmpdir(), "plasmic-island-native-report");
fs.mkdirSync(reportDir, { recursive: true });
let main, island, controller, presentation, stopRpc, client;
const passed = [];
// Advance only the monotonic presentation clock; real IPC and animation keep running.
const realNow = performance.now.bind(performance);
let elapsed = 0, cursor = {x:-10000,y:-10000};
Object.defineProperty(performance, "now", {configurable:true,value:()=>realNow()+elapsed});

const watchdog = setTimeout(() => { console.error("Island integration timed out", passed); app.exit(1); }, 90000);
async function until(check, label, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await delay(40); }
  throw new Error("Timed out: " + label);
}
const editorScript = `
  window.fixture = { mode:'edit', name:'审批列表', counter:0, saveStatus:'saved', calls:[], page:'page', path:'/approvals' };
  const result = output => ({success:true,output:JSON.stringify(output)});
  const context = () => ({ projectId:'p', projectName:'审批系统', projectSummary:{pages:2,components:4},saveStatus:fixture.saveStatus,canvasName:'审批组合画布', sessionId:'session', canEdit:true,
    mode:fixture.mode, previewKind:fixture.mode==='preview'?'in-app':null, changeCounter:fixture.counter,
    componentUuid:'page', componentName:fixture.name, frameUuid:'frame', editorView:{arenaId:'arena',scale:.65},
    previewContext:fixture.mode==='preview'?{componentUuid:fixture.page,componentName:'审批预览',path:fixture.path,width:360,height:560}:null });
  window.PLASMIC_AI_TOOLS = {
    _meta:{read:{},changeElement:{},save:{},preview:{},getEditorContext:{}},
    getEditorContext:async()=>result(context()),
    read:async input=>{fixture.calls.push('read');await new Promise(r=>setTimeout(r,900));return result({nodes:['Table']});},
    changeElement:async input=>{fixture.calls.push('changeElement');await new Promise(r=>setTimeout(r,900));
      if(input.elementUuid==='missing')return {success:false,error:{message:'Element missing'}};
      fixture.counter++;fixture.saveStatus='pending';document.querySelector('iframe').contentWindow.postMessage({fixtureWrite:true},'${canvasOrigin}');return result({changed:true});},
    save:async()=>{fixture.saveStatus='saved';return result({saved:true});},
    preview:async input=>{fixture.mode=input.action==='close'?'edit':'preview';
      history.pushState({},'',fixture.mode==='edit'?'/projects/p':'/projects/p/preview/page');
      document.querySelector('iframe').style.width=fixture.mode==='edit'?'1100px':'360px';
      document.querySelector('iframe').style.height=fixture.mode==='edit'?'650px':'560px';
      document.querySelector('iframe').src=fixture.mode==='edit'?'${canvasOrigin}/editor':'${canvasOrigin}/preview#live=true';
      return result({componentUuid:'page',closed:input.action==='close'});}
  };
`;
async function finish(code) {
  await client?.close(); await stopRpc?.();
  presentation?.dispose(); controller?.close(); if (main && !main.isDestroyed()) main.destroy();
  fs.rmSync(profile, { recursive: true, force: true });
  clearTimeout(watchdog);
  app.exit(code);
}
app.whenReady().then(async () => {
  app.dock?.hide();
  screen.getCursorScreenPoint = () => cursor;
  const localeSource = path.join(root, "../platform/wab/src/wab/client/i18n");
  const localeDir = path.join(profile, "ui-locales");
  fs.cpSync(path.join(localeSource, "locales"), localeDir, {recursive:true});
  fs.copyFileSync(path.join(localeSource, "locale-resolution.cjs"), path.join(localeDir, "locale-resolution.cjs"));
  const i18n = createDesktopI18n(localeDir, ["zh-CN"]);
  const appearance = createDesktopAppearance("dark");
  ipcMain.handle("desktop:ui-appearance", () => {});
  ipcMain.handle("desktop:ui-locale", () => i18n.snapshot());
  const partition = session.fromPartition("island-native");
  partition.protocol.handle("https", async (request) => {
    const url = new URL(request.url);
    if (["editor-bridge.js", "renderer-i18n.js"].includes(url.pathname.slice(1))) {
      return new Response(fs.readFileSync(path.join(root, "src", url.pathname.slice(1))), { headers: { "Content-Type": "application/javascript" } });
    }
    if (url.origin === origin && url.searchParams.has("slow")) await delay(1200);
    let html;
    if (url.origin === origin) html = `<header style="height:44px"><span data-desktop-update-slot="header"></span></header><iframe class="studio-frame" style="border:0;width:1100px;height:650px" src="${canvasOrigin}/editor"></iframe>
      <script>${editorScript}</script><script src="/editor-bridge.js"></script><script src="/renderer-i18n.js"></script>`;
    else if (url.pathname === "/editor") html = `<div class="canvas-editor__canvas-clipper" style="position:absolute;left:180px;top:20px;width:820px;height:570px;background:#303238"><iframe class="canvas-editor__viewport" style="position:absolute;left:0;top:0;width:360px;height:400px;border:0;pointer-events:none" src="${canvasOrigin}/page"></iframe><iframe class="canvas-editor__viewport" style="position:absolute;left:400px;top:70px;width:340px;height:460px;border:0;pointer-events:none" src="${canvasOrigin}/page-two"></iframe></div><script>addEventListener('message',event=>{if(event.origin==='${origin}'&&event.data?.fixtureWrite)document.querySelector('.canvas-editor__canvas-clipper').style.background='#243e38';});</script>`;
    else if (url.pathname === "/preview") html = `<div class="live-root-container" data-plasmic-preview-component="page" style="height:100vh;background:#f5f5f5;padding:32px"><button onclick="document.getElementById('result').textContent='Submitted'">Submit</button><output id="result"></output></div>`;
    else html = `<main data-plasmic-valkey="root.table" style="margin:30px;background:white;padding:24px;border-radius:8px"><h3>审批列表</h3><p>采购申请　　审批中</p><p>费用报销　　已完成</p></main>`;
    return new Response(`<html ${url.pathname === "/page" ? 'data-plasmic-frame-uuid="frame" data-plasmic-component-uuid="page"' : url.pathname === "/page-two" ? 'data-plasmic-frame-uuid="frame-two" data-plasmic-component-uuid="page-two"' : ''}><head><style>body{margin:0;font:14px -apple-system;background:#222;color:#ddd}iframe{display:block}main{color:#222}</style></head><body>${html}</body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  });
  main = new BrowserWindow({ width: 1100, height: 760, show: false, webPreferences: {
    session: partition, preload: path.join(root, "src/preload.cjs"), sandbox: true,
    contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
  } });
  controller = new DesktopController(() => main, { studioOrigin: origin });
  presentation = createIsland({ getWindow: () => main, controller, config: { studioOrigin: origin }, i18n, appearance });
  presentation.attach(main);
  await main.loadURL(origin + "/projects/p");
  await until(async () => (await controller.state()).ready, "editor bridge ready");
  await presentation.setMode("island");
  island = BrowserWindow.getAllWindows().find((win) => win !== main);
  const inspect = (code) => island.webContents.executeJavaScript(code);
  await until(() => presentation.snapshot().context.allowed, "editor eligible");
  assert.equal(main.isVisible(), false);
  assert.equal(main.webContents.getBackgroundThrottling(), false);
  await until(async () => await inspect("document.getElementById('shell').dataset.expanded==='false'"), "initial idle editor capsule");
  assert.equal(presentation.snapshot().image, null, "idle startup does not capture a hidden card");
  const initialState = await controller.dispatch("get_app_state", {});
  assert.equal(initialState.operations, undefined, "metadata calls must not report themselves as business operations");
  await until(async () => await inspect("document.getElementById('shell').dataset.expanded==='true'"), "external metadata call expands card");
  await until(() => presentation.snapshot().image?.src, "external call starts mirroring");
  await until(async () => await inspect("!document.getElementById('summary').hidden && document.getElementById('save-text').textContent==='已保存'"), "idle project information");
  assert.equal(await inspect("document.getElementById('page').textContent"), "审批系统");
  assert.equal(await inspect("document.getElementById('mission').textContent"), "审批组合画布", "freeform views use the canvas name rather than the focused child page");
  assert.equal(await inspect("document.getElementById('page-count').textContent"), "2");
  assert.equal(await inspect("document.getElementById('component-count').textContent"), "4");
  assert.equal(await inspect("document.getElementById('view-metric').textContent"), "65%");
  await delay(500);
  fs.writeFileSync(path.join(reportDir, "idle-info.png"), (await island.webContents.capturePage()).toPNG());
  await inspect("window.shapeChanges=[];new MutationObserver(records=>{for(const r of records)shapeChanges.push(document.getElementById('shell').dataset.expanded)}).observe(document.getElementById('shell'),{attributes:true,attributeFilter:['data-expanded']});true");
  assert.equal(await main.webContents.executeJavaScript("typeof desktopPresentation"), "undefined");
  assert.equal(await main.webContents.mainFrame.frames[0].executeJavaScript("typeof desktopPresentation"), "undefined");
  await assert.rejects(inspect("desktopIsland.command('mode','window')"), /Invalid island command/);
  assert.equal(containsPoint({ x: 0, y: 0 }, { x: 0, y: 0, width: 420, height: 136, radius: 22 }), false);
  assert.equal(containsPoint({ x: 25, y: 25 }, { x: 0, y: 0, width: 420, height: 136, radius: 22 }), true);
  passed.push("native island starts compact; all dispatched calls expand and mirror without throttling; bridge restrictions and rounded hit geometry");

  stopRpc = await startRpc(profile, (method, input) => controller.dispatch(method, input));
  client = new Client({ name: "island-native", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(root, "src/entry.cjs"), "--mcp"], env: { ...process.env, PLASMIC_DESKTOP_PROFILE: profile }, stderr: "pipe" }));
  const call = async (name, input, error = false) => {
    const value = await client.callTool({ name, arguments: input });
    assert.equal(!!value.isError, error, JSON.stringify(value.content));
    return JSON.parse(value.content.find((entry) => entry.type === "text").text);
  };
  const read = call("execute", { name: "read", input: { collection: "components" } });
  await until(async () => await inspect(`document.getElementById('shell').dataset.expanded==='true' && document.getElementById('phase-text').textContent===${JSON.stringify(i18n.t("Reading"))}`), "real MCP read expands");
  assert.equal(await inspect("document.getElementById('summary').hidden"), true, "actual MCP work replaces idle information");
  await until(() => presentation.snapshot().image?.src, "hidden compositor capture");
  await until(async () => await inspect("!document.getElementById('feedback').hidden && document.getElementById('feedback').dataset.kind==='read' && getComputedStyle(document.querySelector('.feedback-sweep')).animationName==='feedback-scan'"), "real read scans the mirrored view");
  await inspect("window.scanNode=document.querySelector('.feedback-sweep');window.scanTime=scanNode.getAnimations()[0].currentTime;true");
  await delay(200);
  assert.equal(await inspect("document.querySelector('.feedback-sweep')===scanNode && scanNode.getAnimations()[0].currentTime>scanTime+100"), true, "capture updates must not restart the scan animation");
  const before = presentation.snapshot().image;
  assert.equal(before.width, 820); assert.equal(before.height, 570);
  await read;
  await until(async () => await inspect("!document.getElementById('mirror').hidden"), "mirror displays");
  assert.equal(await inspect("getComputedStyle(document.getElementById('mirror')).objectFit"), "contain");
  await delay(500);
  assert.equal(await inspect("document.querySelector('.visual').getBoundingClientRect().bottom <= document.getElementById('shell').getBoundingClientRect().bottom - 10"), true, "mirror stays inside card padding");
  assert.equal(await inspect("document.getElementById('progress').hidden"), true);
  await delay(650);
  assert.deepEqual(await main.webContents.executeJavaScript("fixture.calls"), ["read"], "mirroring never invokes model reads");
  await delay(2600);
  assert.equal(await inspect("document.getElementById('shell').dataset.expanded"), "true", "completed calls and analysis gaps cannot collapse editor cards");
  assert.equal(await inspect("document.getElementById('feedback').hidden"), true, "idle must not scan");
  passed.push("stdio MCP read scans; idle and completed calls retain the current canvas without extra model reads or inferred progress");

  const composite = call("execute", { name:"read", input:{componentUuids:["page","page-two"]} });
  await until(async () => await inspect("document.querySelectorAll('.feedback-region').length===2"), "both artboards share the same mirror");
  const regions = presentation.snapshot().image.feedback.regions;
  assert.equal(regions.length, 2);
  assert.ok(regions[1].x > regions[0].x + regions[0].width && regions[1].y > regions[0].y, "artboard spacing and vertical offset survive the composite mirror");
  await composite;
  await main.webContents.executeJavaScript("window.fixtureTools=PLASMIC_AI_TOOLS;window.PLASMIC_AI_TOOLS=undefined");
  await until(() => presentation.snapshot().context.loading, "bridge loading");
  assert.equal(presentation.snapshot().image, null, "loading clears old pixels");
  assert.equal(await inspect("document.querySelector('#summary .counts').hidden"), true, "loading cannot show stale project counts");
  assert.equal(await inspect("document.getElementById('save-state').hidden"), true, "loading cannot claim a previous save state");
  assert.equal(await inspect("document.getElementById('shell').dataset.expanded"), "true");
  assert.equal(await inspect("document.getElementById('unavailable').textContent"), i18n.t("Loading current view…"));
  fs.writeFileSync(path.join(reportDir, "loading.png"), (await island.webContents.capturePage()).toPNG());
  await delay(700);
  await main.webContents.executeJavaScript("window.PLASMIC_AI_TOOLS=fixtureTools;true");
  await until(() => !presentation.snapshot().context.loading && presentation.snapshot().image?.src, "bridge recovers in place");
  const loading = main.loadURL(origin+"/projects/p?slow=1");
  await until(() => presentation.snapshot().context.loading, "editor full navigation loading");
  assert.equal(await inspect("document.getElementById('shell').dataset.expanded"), "true", "main-document loading remains a card");
  await loading;
  await until(() => !presentation.snapshot().context.loading && presentation.snapshot().image?.src, "loaded editor mirrors again");
  assert.deepEqual(await inspect("shapeChanges"), [], "no capsule transition during idle, MCP completion, bridge gaps or full editor reload");
  passed.push("multi-artboard layout/spacing is preserved; editor loading clears stale pixels and never collapses the card");

  const task = { taskId: "approval-task", projectId: "p", sequence: 0, title: "调整审批表格", status: "running", stage: "调整操作列", stageIndex: 2, stageCount: 3 };
  await call("report_task", task);
  await until(async () => await inspect("document.getElementById('mission').textContent==='调整审批表格' && document.getElementById('stage-count').textContent==='2/3'"), "task metadata");
  assert.equal(await inspect("document.getElementById('feedback').hidden"), true, "task metadata alone must not invent scans");
  await main.webContents.executeJavaScript("history.pushState({},'', '/projects/p?arena=other')");
  await delay(650);
  assert.equal(await inspect("document.getElementById('shell').dataset.expanded"), "true", "editor navigation retains the card");
  await call("report_task", { ...task, sequence: 1, status: "blocked", error: "组件库访问被拒绝" });
  await until(async () => await inspect("document.getElementById('issue-text').textContent==='组件库访问被拒绝'"), "real reported blocker");
  await delay(2400);
  assert.equal(await inspect("document.getElementById('shell').dataset.expanded"), "true");
  await call("report_task", { ...task, sequence: 2, status: "completed" });
  const write = call("execute", { name: "changeElement", input: { componentUuid: "page", elementUuid: "table" } });
  await until(async () => await inspect("document.getElementById('phase-text').textContent==='应用更改'"), "write applying");
  await until(async () => await inspect("!document.getElementById('feedback').hidden && document.getElementById('feedback').dataset.kind==='write' && document.querySelector('.feedback-region').getBoundingClientRect().width < document.getElementById('feedback').getBoundingClientRect().width"), "write highlights the actual target, not the whole canvas");
  await write;
  await until(async () => await inspect("document.getElementById('phase-text').textContent==='更改已应用'"), "write completion is not saved");
  await until(() => presentation.snapshot().image?.src !== before.src, "hidden view updates after write");
  const dark = await island.webContents.capturePage();
  fs.writeFileSync(path.join(reportDir, "edit.png"), dark.toPNG());
  await until(async () => await inspect("!document.getElementById('summary').hidden && document.getElementById('save-state').dataset.status==='pending'"), "write completion returns to genuine unsaved status");
  await call("execute",{name:"save",input:{}});
  await until(async () => await inspect("!document.getElementById('summary').hidden && document.getElementById('save-state').dataset.status==='saved'"), "successful save updates idle information");
  assert.equal(await inspect("document.getElementById('save-text').scrollWidth <= document.getElementById('save-text').clientWidth"), true, "Chinese saved status fits");
  await call("execute", { name: "changeElement", input: { elementUuid: "missing" } }, true);
  await until(async () => await inspect("document.getElementById('issue-text').textContent.includes('Element missing')"), "actual editor error");
  assert.equal(await inspect("document.getElementById('feedback').hidden"), true, "failed calls clear visual feedback");
  passed.push("task stages, explicit plan, blocker persistence, actual write/result/error and continuously updating hidden mirror");

  await main.webContents.executeJavaScript("history.pushState({},'', '/projects/p/docs')");
  await until(() => !presentation.snapshot().context.allowed, "other pages forbidden");
  assert.equal(await inspect("document.getElementById('shell').dataset.expanded"), "true", "navigation does not revoke the idle lease");
  assert.equal(await inspect("document.getElementById('card').inert"), false);
  assert.equal(presentation.snapshot().image, null);
  await main.webContents.executeJavaScript("history.pushState({},'', '/workspaces/w')");
  await until(() => presentation.snapshot().context.surface === "dashboard" && presentation.snapshot().context.projectId === null, "workspace dashboard");
  elapsed += 600_001;
  await until(async () => await inspect("document.getElementById('shell').dataset.expanded==='false'"), "ten idle minutes collapse on dashboard");
  await delay(500);
  await until(async () => await inspect("Math.abs(document.getElementById('shell').getBoundingClientRect().width - document.getElementById('capsule').getBoundingClientRect().width - 2) < 1"), "capsule fits its content");
  assert.ok(await inspect("document.getElementById('shell').getBoundingClientRect().width < 180"), "idle capsule has no excessive fixed width");
  const originalRequest = controller.requestStudio;
  let releaseCreate;
  controller.requestStudio = async (url, input) => {
    assert.equal(url, "/api/v1/projects");
    if(input.name === "失败项目") throw new Error("创建权限被拒绝");
    await new Promise(resolve => {releaseCreate=resolve});
    return {project:{id:"new-project",name:input.name}};
  };
  const creating = call("create_project", {name:"新建审批项目"});
  await until(async () => await inspect("document.getElementById('project').textContent==='创建项目' && document.body.dataset.working==='true'"), "project creation shows in capsule");
  const failing = call("create_project", {name:"失败项目"}, true);
  await until(async () => await inspect("!document.getElementById('queue').hidden && document.getElementById('queue').textContent==='1'"), "queued work shows in capsule");
  assert.ok(await inspect("document.getElementById('capsule-handle').title.includes('新建审批项目')"), "capsule exposes the actual resource name");
  assert.equal(await inspect("document.getElementById('shell').dataset.expanded"), "true", "project creation expands a dashboard card too");
  fs.writeFileSync(path.join(reportDir, "capsule-running.png"), (await island.webContents.capturePage()).toPNG());
  await delay(2400);
  releaseCreate(); await creating; await failing;
  await until(async () => await inspect("document.body.dataset.error==='true' && document.getElementById('pill-context').textContent==='操作失败'"), "capsule error");
  await delay(2400);
  assert.ok(await inspect("document.getElementById('capsule-handle').title.includes('创建权限被拒绝')"), "failed operations stay inspectable until the next meaningful call");
  fs.writeFileSync(path.join(reportDir, "capsule-error.png"), (await island.webContents.capturePage()).toPNG());
  const recovering = call("create_project", {name:"恢复创建"});
  await until(async () => await inspect("document.body.dataset.error==='false' && document.body.dataset.working==='true'"), "recovery clears old failure");
  releaseCreate(); await recovering;
  await until(async () => await inspect("document.getElementById('pill-context').textContent==='操作完成'"), "capsule result");
  fs.writeFileSync(path.join(reportDir, "capsule-result.png"), (await island.webContents.capturePage()).toPNG());
  await until(async () => await inspect("document.getElementById('project').textContent==='Plasmic' && document.getElementById('pill-context').textContent===''"), "capsule result expires back to compact idle");
  controller.requestStudio = originalRequest;
  passed.push("dashboard calls expand with no stale canvas; actual subject, queue, persistent error and recovery remain visible");

  const openingEditor = main.loadURL(origin + "/projects/p?slow=1");
  await until(() => presentation.snapshot().context.allowed && presentation.snapshot().context.loading, "dashboard to editor loading card");
  assert.equal(await inspect("document.getElementById('shell').dataset.expanded"), "true");
  await openingEditor;
  await until(() => presentation.snapshot().context.allowed && !presentation.snapshot().context.loading, "back to editor");
  await until(async () => await inspect("document.getElementById('shell').dataset.expanded==='true'"), "navigation retains the remaining call lease");
  await inspect("shapeChanges=[]");
  await call("preview", { action: "open", componentUuid: "page" });
  await until(() => presentation.snapshot().context.mode === "preview", "native preview context");
  assert.equal(await inspect("document.getElementById('shell').dataset.expanded"), "true");
  const snapshot = await call("preview", { action: "snapshot" });
  await until(async () => await inspect("!document.getElementById('feedback').hidden && document.getElementById('feedback').dataset.kind==='read'"), "native Preview reads scan its actual viewport");
  const previewFit = await inspect(`(() => {
    const layer=document.getElementById('feedback').getBoundingClientRect(), box=document.getElementById('mirror').getBoundingClientRect();
    return {ratio:layer.width/layer.height,left:layer.left-box.left,right:box.right-layer.right};
  })()`);
  assert.ok(Math.abs(previewFit.ratio-360/560)<.01 && previewFit.left>10 && Math.abs(previewFit.left-previewFit.right)<1, "portrait feedback fits the image, excluding letterbox space");
  const submit = snapshot.elements.find((el) => el.name === "Submit");
  assert.ok(submit);
  await call("preview", { action: "click", ref: submit.ref });
  await until(async () => await inspect("!document.getElementById('feedback').hidden && document.getElementById('feedback').dataset.kind==='preview'"), "native interaction highlights the real runtime ref");
  const runtime = main.webContents.mainFrame.framesInSubtree.find((frame) => frame.url.includes("/preview#live=true"));
  assert.equal(await runtime.executeJavaScript("document.getElementById('result').textContent"), "Submitted");
  await until(() => presentation.snapshot().image?.identity === presentation.snapshot().context.identity, "preview current frame");
  assert.equal(presentation.snapshot().context.pageName, "/approvals", "preview uses runtime route, not retained editor component name");
  appearance.set("light"); i18n.setLocale("en");
  await until(async () => await inspect("document.documentElement.dataset.uiAppearance==='light' && document.getElementById('context').textContent==='Preview'"), "live theme and language");
  await delay(500);
  fs.writeFileSync(path.join(reportDir, "preview.png"), (await island.webContents.capturePage()).toPNG());
  await runtime.executeJavaScript("document.body.append(Object.assign(document.createElement('div'),{textContent:'Runtime failed'}));document.body.lastElementChild.setAttribute('data-plasmic-preview-error','true')");
  await until(() => presentation.snapshot().stale, "stale source detection");
  await until(async () => await inspect("!document.getElementById('stale').hidden"), "previous-frame label");
  assert.equal(await inspect("document.getElementById('feedback').hidden"), true, "stale pixels cannot carry live target feedback");
  await runtime.executeJavaScript("document.querySelector('[data-plasmic-preview-error]').remove()");
  await until(() => !presentation.snapshot().stale, "capture recovery");
  await delay(2400);
  assert.equal(await inspect("document.getElementById('shell').dataset.expanded"), "true", "idle Preview remains expanded");
  assert.equal(await inspect("document.getElementById('summary').hidden"), false);
  assert.equal(await inspect("document.getElementById('components-label').scrollWidth <= document.getElementById('components-label').clientWidth"), true, "English component label fits without truncation");
  assert.equal(await inspect("document.getElementById('mission').textContent"), "审批预览", "Preview page name comes from the runtime, not retained editor selection");
  assert.equal(await inspect("document.getElementById('view-metric').textContent"), "360 × 560");
  assert.equal(await inspect("document.getElementById('view-metric').getBoundingClientRect().right <= document.querySelector('.info').getBoundingClientRect().right"), true);
  fs.writeFileSync(path.join(reportDir, "idle-preview-info.png"), (await island.webContents.capturePage()).toPNG());
  assert.deepEqual(await inspect("shapeChanges"), [], "edit-to-Preview navigation and completed calls cannot flash a capsule");
  passed.push("native Preview real DOM snapshot/click, actual route, current view capture, shared theme/language, stale labeling and recovery");

  // Exercise expiry and hover in the real native hit loop, without waiting ten minutes.
  let remaining = controller.activity.idleUntil - performance.now();
  elapsed += remaining - 1000;
  await delay(150);
  assert.equal(await inspect("document.getElementById('shell').dataset.expanded"), "true", "card remains until the full ten minutes");
  elapsed += 1001;
  await until(async () => await inspect("document.getElementById('shell').dataset.expanded==='false'"), "ten idle minutes collapse Preview");
  await delay(650);
  await inspect("shapeChanges=[]");
  const [islandX,islandY] = island.getPosition();
  cursor = {x:islandX+228,y:islandY+30};
  await until(async () => await inspect("document.getElementById('shell').dataset.expanded==='true'"), "native hover expands capsule");
  await delay(650);
  assert.deepEqual(await inspect("shapeChanges"), ["true"], "expansion geometry does not retrigger hover");
  assert.equal(controller.activity.keepExpanded(), false, "hover does not reset the MCP lease");
  cursor = {x:-10000,y:-10000};
  await delay(100);
  assert.equal(await inspect("document.getElementById('shell').dataset.expanded"), "true", "brief pointer exits have a grace period");
  cursor = {x:islandX+228,y:islandY+30};
  await delay(200);
  assert.deepEqual(await inspect("shapeChanges"), ["true"], "brief leave/reentry never flashes a capsule");
  cursor = {x:-10000,y:-10000};
  await until(async () => await inspect("document.getElementById('shell').dataset.expanded==='false'"), "hover leave settles to capsule");
  await delay(650);
  assert.deepEqual(await inspect("shapeChanges"), ["true","false"], "one intentional expansion and one collapse");
  await call("preview", {action:"state"});
  await until(async () => await inspect("document.getElementById('shell').dataset.expanded==='true'"), "passive Preview call renews idle lease");
  await inspect("shapeChanges=[]");
  remaining = controller.activity.idleUntil - performance.now();
  elapsed += remaining - 1000;
  cursor = {x:islandX+228,y:islandY+30};
  await delay(100);
  elapsed += 1001;
  await delay(100);
  assert.equal(controller.activity.keepExpanded(), false);
  assert.deepEqual(await inspect("shapeChanges"), [], "expiry while hovered never collapses under the pointer");
  const renewed = call("preview", {action:"state"});
  await renewed;
  cursor = {x:-10000,y:-10000};
  await delay(450);
  assert.deepEqual(await inspect("shapeChanges"), [], "a new call during hover survives pointer exit");

  passed.push("monotonic ten-minute expiry, native pointer hover/leave grace, expiry under hover and new calls during hover avoid shape oscillation");

  assert.equal(await inspect("document.querySelector('.tools, #mode, #return') === null"), true, "no floating window or display-mode icons");
  const originalPopup = Menu.prototype.popup;
  let contextMenu;
  Menu.prototype.popup = function() { contextMenu = this; };
  try {
    await inspect("document.getElementById('shell').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));true");
    await until(() => contextMenu, "island native context menu");
    assert.deepEqual(contextMenu.items.filter(item=>item.type!=="separator").map(item=>item.label), ["Show main window","Exit Dynamic Island mode","Quit application"]);
    assert.ok(contextMenu.items.every(item=>item.type!=="radio"), "context actions are not display-mode radio choices");
    presentation.setCloseAction("island");
    contextMenu.getMenuItemById("island-show-main").click();
    await until(() => main.isVisible() && island.isVisible(), "temporarily show main alongside island");
    assert.equal(presentation.mode,"island"); assert.equal(presentation.closeAction,"island");
    assert.equal(JSON.parse(fs.readFileSync(path.join(profile,"presentation.json"))).mode,"island");
    assert.equal((await controller.state()).editorContext.mode,"preview");
    main.minimize();
    contextMenu.getMenuItemById("island-show-main").click();
    await until(() => main.isVisible() && !main.isMinimized(), "show main restores minimized window");
    contextMenu.getMenuItemById("island-exit").click();
    await until(() => presentation.mode === "window" && presentation.closeAction === "ask" && main.isVisible() && !island.isVisible(), "explicit exit clears island preference");
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile,"presentation.json"))).closeAction,"ask");
  } finally { Menu.prototype.popup = originalPopup; }
  await presentation.setMode("fullscreen");
  assert.equal(main.isFullScreen(), true);
  await presentation.setMode("island");
  assert.equal(main.isFullScreen(), false); assert.equal(main.isVisible(), false);
  const returnedAt = Date.now();
  await until(() => presentation.snapshot().context.allowed, "context after mode return");
  await until(() => presentation.snapshot().image?.capturedAt > returnedAt, "mirroring resumes after mode return");
  await Promise.all([presentation.setMode("fullscreen"), presentation.setMode("window"), presentation.setMode("island")]);
  assert.equal(presentation.mode, "island"); assert.equal(main.isFullScreen(), false); assert.equal(main.isVisible(), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(profile, "presentation.json"))).mode, "island");
  passed.push("right-click actions distinguish showing main from exiting island, remove floating icons, retain Preview; real fullscreen transitions and rapid mode changes serialize correctly; local preference persists");
  const entering = presentation.setMode("fullscreen");
  await until(() => main.listenerCount("enter-full-screen") > 1, "fullscreen transition starts");
  main.close();
  await Promise.race([entering, delay(3000).then(() => { throw new Error("Closing during fullscreen left a pending transition"); })]);
  await until(() => main.isDestroyed(), "native window close completes");
  passed.push("closing the main window during fullscreen transition releases the mode queue");
  const report = { passed: true, fixture: "Deterministic editor + real Electron + stdio MCP", checks: passed };
  fs.writeFileSync(path.join(reportDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await finish(0);
}).catch(async (error) => {
  console.error(error.stack, passed);
  fs.writeFileSync(path.join(reportDir, "failure.json"), JSON.stringify({ error: error.stack, passed }, null, 2));
  await finish(1);
});
