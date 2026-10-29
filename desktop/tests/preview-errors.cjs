// Native regression for renderer exceptions crossing Electron, RPC and MCP.
// Uses an isolated fixture without a Dock identity; no NAS or user project edits.
const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { DesktopController } = require("../src/controller.cjs");
const { startRpc } = require("../src/local-rpc.cjs");
const { errorPayload } = require("../src/tool-context.cjs");

const profile = require("node:fs").mkdtempSync(path.join(os.tmpdir(), "plasmic-preview-errors-native-"));
app.setPath("userData", profile);
if (process.platform === "darwin") app.setActivationPolicy("accessory");
let win, server, controller, stop, client;
app.on("window-all-closed", () => {}); // finish() controls the regression process exit code.
const watchdog = setTimeout(() => app.exit(1), 20000);
app.whenReady().then(async () => {
  app.dock?.hide();
  server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (req.url.startsWith("/projects/")) return res.end('<iframe style="border:0;width:800px;height:600px" src="/runtime#live=true"></iframe>');
    res.end(`<div class="live-root-container" data-plasmic-preview-component="page">
      <button onclick="window.nativeClicks=(window.nativeClicks||0)+1">查询</button>
      <button disabled>保存</button>
      <div style="position:relative;width:200px;height:32px;margin-top:20px">
        <input role="combobox" aria-label="市场" readonly style="position:absolute;inset:0;width:100%;height:100%;opacity:0">
        <span style="position:absolute;inset:0;background:white">遮挡层</span>
      </div></div><script>window.inputs=[];for(const type of ['mousemove','mousedown','mouseup','click'])document.addEventListener(type,e=>window.inputs.push({type,x:e.clientX,y:e.clientY,target:e.target.tagName,text:e.target.textContent}));</script>`);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  win = new BrowserWindow({ show: false, width: 1000, height: 800, webPreferences: { backgroundThrottling: false } });
  await win.loadURL(origin + "/projects/p/preview#/records");
  // An inactive macOS window receives movement but consumes the first button
  // input for activation. Focus the fixture before checking actual DOM clicks.
  win.show(); app.focus({ steal: true }); win.focus();
  for (let i = 0; !win.isFocused() && i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(win.isFocused(), true);
  const context = { projectId: "p", sessionId: "s", changeCounter: 0, mode: "preview", previewKind: "in-app",
    previewContext: { componentUuid: "page", path: "/records" } };
  controller = new DesktopController(() => win, { studioOrigin: origin });
  controller.state = async () => ({ ready: true, projectId: "p", editorContext: context });
  controller.editor = async (name) => { assert.equal(name, "getEditorContext"); return context; };
  stop = await startRpc(profile, (method, input) => controller.dispatch(method, input));
  client = new Client({ name: "native-preview-errors", version: "1" });
  await client.connect(new StdioClientTransport({ command: process.execPath,
    args: ["-e", `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp(${JSON.stringify(profile)})`],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, stderr: "pipe" }));
  const preview = (arguments) => client.callTool({ name: "preview", arguments });
  const snapshot = JSON.parse((await preview({ action: "snapshot" })).content[0].text);
  const frame = win.webContents.mainFrame.framesInSubtree.find((frame) => frame.url.endsWith("#live=true"));
  let nativeRejection;
  try { await frame.executeJavaScript('Promise.reject(new Error("Original renderer detail"))'); }
  catch (error) { nativeRejection = errorPayload(error); }
  assert.match(nativeRejection.message, /Original renderer detail/);
  assert.ok(nativeRejection.stack);
  const failures = [];
  for (const [name, code, ref] of [
    ["市场", "PREVIEW_TARGET_BLOCKED"], ["保存", "PREVIEW_TARGET_DISABLED"],
    ["过期目标", "PREVIEW_TARGET_STALE", "expired"],
  ]) {
    const target = ref || snapshot.elements.find((element) => element.name === name).ref;
    const failed = await preview({ action: "click", ref: target });
    assert.equal(failed.isError, true);
    const payload = JSON.parse(failed.content[0].text);
    assert.equal(payload.code, code);
    assert.equal(payload.operationExecuted, false);
    assert.equal(payload.runtimeAvailable, true);
    assert.equal(payload.canContinueRound, true);
    assert.equal(payload.preview.ref, target);
    assert.equal(payload.preview.editorContext.sessionId, "s");
    assert.equal(payload.preview.frame.routingId, frame.routingId);
    assert.match(payload.cause.stack, /runtimeCommand|target/);
    assert.equal(payload.recovery[0].arguments.action, "snapshot");
    if (code === "PREVIEW_TARGET_BLOCKED") assert.equal(payload.preview.target.hit.name, "遮挡层");
    assert.equal(JSON.parse((await preview({ action: "state" })).content[0].text).ready, true);
    assert.equal((await preview(payload.recovery[0].arguments)).isError, false);
    failures.push(payload);
  }
  const ref = snapshot.elements.find((element) => element.name === "查询").ref;
  const clicked = await preview({ action: "click", ref });
  assert.equal(clicked.isError, false);
  const nativeInput = await frame.executeJavaScript("({clicks:window.nativeClicks||0,inputs:window.inputs})");
  assert.equal(nativeInput.clicks, 1);
  const report = { passed: true, electronVersion: process.versions.electron, nativeRejection, failures,
    subsequentClickExecuted: true, nativeInput, sameRoundContinued: true };
  if (process.env.PLASMIC_REPORT_DIR) {
    await fs.mkdir(process.env.PLASMIC_REPORT_DIR, { recursive: true });
    await fs.writeFile(path.join(process.env.PLASMIC_REPORT_DIR, "preview-errors-native.json"), JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify({ passed: true, failures: failures.map((error) => error.code), sameRoundContinued: true }));
}).then(() => finish(0), async (error) => { console.error(error); await finish(1); });
async function finish(code) {
  clearTimeout(watchdog);
  await client?.close();
  await stop?.();
  controller?.close(); win?.destroy();
  if (server) await new Promise((resolve) => server.close(resolve));
  await fs.rm(profile, { recursive: true, force: true });
  app.exit(code);
}
