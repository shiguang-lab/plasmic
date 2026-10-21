const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { JSDOM } = require("jsdom");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { startRpc } = require("../src/local-rpc.cjs");
const { errorPayload } = require("../src/tool-context.cjs");
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  return name === "electron" ? { app: { getPath: () => os.tmpdir() }, ipcMain: { on() {}, removeListener() {} } }
    : originalLoad.call(this, name, ...args);
};
const { DesktopController } = require("../src/controller.cjs");
Module._load = originalLoad;

function fixture(t) {
  const dom = new JSDOM('<div class="live-root-container" data-plasmic-preview-component="page"><button id="target">查询</button><button disabled>保存</button><input aria-label="关键字"><span id="cover">遮挡层</span></div>',
    { url: "https://canvas.example/#live=true", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.document.fonts = { ready: Promise.resolve() };
  w.requestAnimationFrame = (callback) => callback();
  for (const el of w.document.querySelectorAll("*")) {
    el.getBoundingClientRect = () => ({ x: 10, y: 10, width: 80, height: 30, left: 10, top: 10, right: 90, bottom: 40 });
    el.scrollIntoView = () => {};
  }
  w.document.elementFromPoint = () => w.document.getElementById("cover");
  const frame = { url: w.location.href, processId: 12, routingId: 34, executeJavaScript: (script) => w.eval(script) };
  const inputs = [];
  const win = { isDestroyed: () => false, webContents: {
    getURL: () => "https://studio.example/projects/p/preview/records", mainFrame: { framesInSubtree: [frame] },
    debugger: { isAttached: () => true, sendCommand: async (method, params) => { inputs.push({ method, ...params }); } },
  } };
  const context = { projectId: "p", branchId: null, sessionId: "session", revision: 1, changeCounter: 0,
    mode: "preview", previewKind: "in-app", previewContext: { componentUuid: "page", path: "/records" } };
  const controller = new DesktopController(() => win, { studioOrigin: "https://studio.example" });
  t.after(() => controller.close());
  controller.state = async () => ({ ready: true, projectId: "p", editorContext: context });
  controller.editor = async (name) => { assert.equal(name, "getEditorContext"); return context; };
  const preview = (input) => controller.dispatch("preview", input);
  return { preview, controller, frame, w, inputs };
}

test("target failures keep their native cause, target/frame/context and allow the same round to continue", async (t) => {
  const f = fixture(t);
  const snapshot = await f.preview({ action: "snapshot" });
  const button = snapshot.elements.find((el) => el.name === "查询");
  for (const [ref, code, change] of [
    ["expired", "PREVIEW_TARGET_STALE", () => {}],
    [snapshot.elements.find((el) => el.name === "保存").ref, "PREVIEW_TARGET_DISABLED", () => {}],
    [button.ref, "PREVIEW_TARGET_HIDDEN", () => { f.w.document.getElementById("target").hidden = true; }],
    [button.ref, "PREVIEW_TARGET_BLOCKED", () => { f.w.document.getElementById("target").hidden = false; }],
  ]) {
    change();
    await assert.rejects(f.preview({ action: "click", ref }), (error) => {
      const payload = errorPayload(error);
      assert.equal(payload.code, code);
      assert.equal(payload.operationExecuted, false);
      assert.equal(payload.runtimeAvailable, true);
      assert.equal(payload.canContinueRound, true);
      assert.equal(payload.preview.ref, ref);
      assert.equal(payload.preview.frame.routingId, 34);
      assert.equal(payload.preview.editorContext.sessionId, "session");
      assert.equal(payload.preview.source, "renderer");
      assert.match(payload.cause.stack, /runtimeCommand|target/);
      assert.equal(payload.recovery[0].arguments.action, "snapshot");
      if (code === "PREVIEW_TARGET_BLOCKED") assert.equal(payload.preview.target.hit.name, "遮挡层");
      return true;
    });
  }
  assert.deepEqual(f.inputs, []);
  assert.equal((await f.preview({ action: "state" })).ready, true);
  assert.ok((await f.preview({ action: "snapshot" })).elements.length);
});

test("raw Electron string failures retain the source stack without declaring a runtime crash", async (t) => {
  const f = fixture(t), execute = f.frame.executeJavaScript;
  const raw = "Error: renderer bridge failure\n    at nativeFrame:7:3";
  f.frame.executeJavaScript = (script) => script.includes("runtimeCommand") ? Promise.reject(raw) : execute(script);
  await assert.rejects(f.preview({ action: "click", ref: "ref" }), (error) => {
    const payload = errorPayload(error);
    assert.equal(payload.message, raw);
    assert.equal(payload.cause.message, raw);
    assert.equal(payload.cause.stack, raw);
    assert.equal(payload.code, "PREVIEW_OPERATION_FAILED");
    assert.equal(payload.runtimeAvailable, null);
    assert.equal(payload.recovery[0].arguments.action, "state");
    assert.equal(payload.operationExecuted, false);
    return true;
  });
  assert.deepEqual(f.inputs, []);
});

test("partial native input is unknown; completed input remains executed if settling fails", async (t) => {
  for (const stage of ["mousePressed", "settle"]) {
    const f = fixture(t);
    f.w.document.elementFromPoint = () => f.w.document.getElementById("target");
    const button = (await f.preview({ action: "snapshot" })).elements.find((el) => el.name === "查询");
    const execute = f.frame.executeJavaScript;
    f.frame.executeJavaScript = (script) => {
      if (stage === "settle" && script.startsWith("Promise.race")) return Promise.reject("Error: settle failed\n    at settle:1:1");
      return execute(script);
    };
    f.inputs.push = function (value) {
      Array.prototype.push.call(this, value);
      if (value.type === stage) throw new Error("Native input connection lost");
    };
    await assert.rejects(f.preview({ action: "click", ref: button.ref }), (error) => {
      const payload = errorPayload(error);
      assert.equal(payload.operationExecuted, stage === "settle" ? true : null);
      assert.equal(payload.preview.phase, stage);
      const dispatched = payload.preview.inputsDispatched;
      assert.equal(dispatched.at(-1).status, stage === "settle" ? "acknowledged" : "attempted");
      assert.equal(payload.preview.target.name, "查询");
      return true;
    });
  }
});

test("diagnosing a disposed frame cannot replace the discovery exception", async (t) => {
  const f = fixture(t);
  f.frame.executeJavaScript = async () => {
    Object.defineProperty(f.frame, "url", { get() { throw new Error("Frame disposed"); } });
    throw "Original frame inspection failure";
  };
  await assert.rejects(f.preview({ action: "state" }), (error) => {
    assert.equal(error.message, "Original frame inspection failure");
    assert.equal(error.context.code, "PREVIEW_UNAVAILABLE");
    assert.equal(error.context.operationExecuted, false);
    assert.equal(error.context.canContinueRound, false);
    assert.deepEqual(error.context.preview.candidateFrames, [{ unavailable: true }]);
    assert.equal(error.context.recovery[0].arguments.action, "close");
    return true;
  });
});

test("renderer diagnostics survive actual RPC and MCP without losing the cause or ending Preview", async (t) => {
  const f = fixture(t);
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-preview-errors-"));
  const stop = await startRpc(profile, (method, input) => f.controller.dispatch(method, input));
  const client = new Client({ name: "preview-error-test", version: "1" });
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath,
      args: ["-e", `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp(${JSON.stringify(profile)})`], stderr: "pipe" }));
    const call = (arguments) => client.callTool({ name: "preview", arguments });
    const snapshot = JSON.parse((await call({ action: "snapshot" })).content[0].text);
    const ref = snapshot.elements.find((el) => el.name === "查询").ref;
    const failed = await call({ action: "click", ref });
    assert.equal(failed.isError, true);
    const payload = JSON.parse(failed.content[0].text);
    assert.equal(payload.code, "PREVIEW_TARGET_BLOCKED");
    assert.match(payload.error, /covered/);
    assert.match(payload.cause.stack, /runtimeCommand/);
    assert.equal(payload.preview.ref, ref);
    assert.equal(payload.preview.frame.processId, 12);
    assert.equal(payload.operationExecuted, false);
    assert.equal(payload.canContinueRound, true);
    assert.equal(JSON.parse((await call({ action: "state" })).content[0].text).ready, true);
    assert.equal((await call(payload.recovery[0].arguments)).isError, false);
    assert.deepEqual(f.inputs, []);
  } finally {
    await client.close(); await stop(); await fs.rm(profile, { recursive: true, force: true });
  }
});
