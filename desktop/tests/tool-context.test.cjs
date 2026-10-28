const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { startRpc } = require("../src/local-rpc.cjs");
const { currentContext } = require("../src/tool-context.cjs");
let userDataDirectory = os.tmpdir();
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  return name === "electron"
    ? { app: { getPath: () => userDataDirectory }, ipcMain: { on() {}, removeListener() {} } }
    : originalLoad.call(this, name, ...args);
};
const { DesktopController } = require("../src/controller.cjs");
Module._load = originalLoad;

function fixture(t, initialMode = "edit") {
  const context = { projectId: "project", branchId: null, sessionId: "session", revision: 3, changeCounter: 5,
    mode: initialMode, canEdit: initialMode === "edit", previewKind: initialMode === "preview" ? "in-app" : null,
    componentUuid: "original", frameUuid: "original-frame", previewContext: initialMode === "preview" ? { componentUuid: "page", path: "/page" } : null,
    editorView: { arenaId: "original", arenaType: "page", frameUuid: "original-frame", scale: 0.75, scroll: { x: 12, y: 34 } } };
  let url;
  const calls = [];
  const controller = new DesktopController(() => ({ isDestroyed: () => false,
    webContents: { getURL: () => url || `https://studio.example/projects/project${context.mode === "preview" ? "/preview/page" : ""}` } }),
  { studioOrigin: "https://studio.example" });
  t.after(() => controller.close());
  controller.state = async () => ({ ready: true, projectId: "project", editorContext: { ...context } });
  controller.ready = async () => ({ ready: true });
  controller.editor = async (name, input) => {
    calls.push({ name, input });
    if (name === "getEditorContext") return { ...context };
    if (name === "preview" && input.action === "close") {
      context.mode = "edit"; context.canEdit = true; context.previewContext = null; context.previewKind = null;
      return { mode: "edit" };
    }
    return { name, results: [] };
  };
  return { controller, context, calls, setUrl: (value) => { url = value; } };
}

test("a Preview write is rejected before execution while model reads retain Preview", async (t) => {
  const { controller, context, calls } = fixture(t, "preview");
  await assert.rejects(controller.dispatch("execute", { name: "changeElement", input: { componentUuid: "page" } }), (error) => {
    assert.equal(error.context.code, "CONTEXT_MISMATCH");
    assert.equal(error.context.operationExecuted, false);
    assert.equal(error.context.actual.mode, "preview");
    assert.equal(error.context.actual.sessionId, "session");
    assert.equal(error.context.required.mode, "edit");
    assert.deepEqual(error.context.recovery[0], { tool: "preview", arguments: { action: "close" } });
    return true;
  });
  assert.deepEqual(calls, []);
  await controller.dispatch("execute", { name: "read", input: { componentUuids: ["page"] } });
  assert.equal(context.mode, "preview");
  assert.deepEqual(calls.map((x) => x.name), ["read"]);
});

test("dashboard context fails immediately without opening or saving a project; management still works", async (t) => {
  const { controller, calls, setUrl } = fixture(t);
  setUrl("https://studio.example/workspaces/workspace");
  await assert.rejects(controller.dispatch("execute", { name: "read", input: {} }), (error) =>
    error.context.actual.surface === "dashboard" && error.context.operationExecuted === false);
  assert.deepEqual(calls, []);
  controller.requestStudio = async () => ({ projects: [] });
  assert.deepEqual(await controller.dispatch("list_projects", {}), { projects: [] });
  assert.deepEqual(calls, []);
});

test("legacy local workflow state cannot affect status or block an ordinary edit", async (t) => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-legacy-state-"));
  t.after(() => fs.rm(profile, { recursive: true, force: true }));
  const pointer = path.join(profile, "prototype-task.json");
  await fs.writeFile(pointer, "invalid obsolete task state");
  const previousProfile = userDataDirectory;
  userDataDirectory = profile;
  t.after(() => { userDataDirectory = previousProfile; });
  const { controller, calls } = fixture(t);
  const status = await controller.dispatch("get_app_state", {});
  assert.equal(Object.hasOwn(status, "prototypeTask"), false);
  await controller.dispatch("execute", { name: "changeElement", input: { componentUuid: "page", elementUuid: "node", name: "Content" } });
  assert.equal(calls.at(-1).name, "changeElement");
  assert.equal(await fs.readFile(pointer, "utf8"), "invalid obsolete task state");
});

test("retained model identity cannot authorize a different route or session project", async (t) => {
  const { controller, context, calls, setUrl } = fixture(t);
  setUrl("https://studio.example/projects/other");
  await assert.rejects(controller.dispatch("execute", { name: "save", input: {} }), (error) => error.context.actual.routeProjectId === "other");
  setUrl("https://studio.example/projects/project");
  context.projectId = "stale-session-project";
  await assert.rejects(controller.dispatch("execute", { name: "read", input: {} }), (error) => error.context.actual.sessionProjectId === "stale-session-project");
  assert.deepEqual(calls, []);
});

test("unavailable context and external Preview give explicit failures without running the operation", async (t) => {
  const { controller, context, calls } = fixture(t);
  context.previewKind = "external";
  await assert.rejects(controller.dispatch("preview", { action: "open" }), (error) => {
    assert.equal(error.context.operationExecuted, false);
    assert.deepEqual(error.context.recovery, []);
    assert.match(error.message, /external Preview window/);
    return true;
  });
  controller.state = async () => { throw new Error("Editor metadata timed out"); };
  await assert.rejects(controller.dispatch("execute", { name: "save", input: {} }), (error) => {
    assert.match(error.message, /metadata timed out/);
    assert.equal(error.context.code, "CONTEXT_MISMATCH");
    assert.equal(error.context.operationExecuted, false);
    assert.equal(error.context.actual.ready, false);
    assert.equal(error.context.actual.projectId, "project");
    return true;
  });
  assert.deepEqual(calls, []);
});

test("background canvas targets need no active frame; visible canvas operations require edit mode", async (t) => {
  const { controller, context, calls } = fixture(t, "preview");
  context.frameUuid = null; context.editorView = null;
  await controller.checkContext("get_screenshot", { componentUuid: "page" });
  await controller.checkContext("snapshot_layout", { componentUuid: "page" });
  await assert.rejects(controller.dispatch("get_screenshot", { mode: "workspace" }), (error) => error.context.required.mode === "edit");
  assert.deepEqual(calls, []);
  assert.equal(context.mode, "preview");
});

test("runtime recovery requests an explicit Page and fresh refs instead of replaying an old ref", async (t) => {
  const { controller, calls } = fixture(t);
  await assert.rejects(controller.dispatch("preview", { action: "click", ref: "expired-ref" }), (error) => {
    const [open, snapshot] = error.context.recovery;
    assert.equal(open.tool, "preview");
    assert.deepEqual(open.requiresInput, ["componentUuid"]);
    assert.equal(snapshot.arguments.action, "snapshot");
    assert.equal(error.context.operationExecuted, false);
    return true;
  });
  assert.deepEqual(calls, []);
});

test("close works after failed Preview rendering, without polling canvas readiness, and is idempotent", async (t) => {
  const { controller, context, calls } = fixture(t);
  const editor = controller.editor.bind(controller);
  controller.editor = async (name, input) => {
    if (name === "preview" && input.action === "open") {
      context.mode = "preview"; context.canEdit = false; context.previewKind = "in-app";
      context.previewContext = { componentUuid: "page", path: "/page" };
      throw new Error("Native Preview render failed");
    }
    return editor(name, input);
  };
  controller.ready = async () => { throw new Error("Canvas readiness must not block closing Preview"); };
  await assert.rejects(controller.dispatch("preview", { action: "open", componentUuid: "page" }), /render failed/);
  const closed = await controller.dispatch("preview", { action: "close" });
  assert.equal(closed.context.mode, "edit");
  assert.equal(closed.context.sessionId, "session");
  await controller.dispatch("preview", { action: "close" });
  const state = await controller.dispatch("preview", { action: "state" });
  assert.equal(state.ready, false);
  assert.equal(calls.some((x) => ["save", "navigate", "restoreEditorView"].includes(x.name)), false);
});

test("close does not report success when the actual editor context is still in Preview", async (t) => {
  const { controller, context, setUrl } = fixture(t, "preview");
  const editor = controller.editor.bind(controller);
  controller.editor = async (name, input) => name === "preview" ? { mode: "edit" } : editor(name, input);
  await assert.rejects(controller.dispatch("preview", { action: "close" }), (error) => {
    assert.equal(error.context.actual.mode, "preview");
    assert.equal(error.context.required.mode, "edit");
    assert.equal(error.context.operationExecuted, null);
    return true;
  });
  context.mode = "edit"; context.previewContext = null; context.previewKind = null;
  setUrl("https://studio.example/projects/project/preview");
  await assert.rejects(controller.dispatch("preview", { action: "close" }), (error) => error.context.actual.mode === "preview");
});

test("context error and recovery survive RPC and MCP, allowing one explicit close then one write", async (t) => {
  const { controller, context, calls } = fixture(t, "preview");
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-context-"));
  const stop = await startRpc(profile, (method, input) => controller.dispatch(method, input));
  const client = new Client({ name: "context-recovery-test", version: "1" });
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath,
      args: ["-e", `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp(${JSON.stringify(profile)})`], stderr: "pipe" }));
    assert.match(client.getInstructions(), /JSON \{msg,detail\}/);
    assert.match(client.getInstructions(), /detail\.operationExecuted/);
    const args = { name: "changeElement", input: { componentUuid: "page", elementUuid: "node", name: "Content" } };
    const failed = await client.callTool({ name: "execute", arguments: args });
    assert.equal(failed.isError, true);
    const { msg, detail: error } = JSON.parse(failed.content[0].text);
    assert.equal(msg, "Switch to the required editor context.");
    assert.equal(error.code, "CONTEXT_MISMATCH");
    assert.equal(error.operationExecuted, false);
    assert.equal(error.actual.mode, "preview");
    assert.equal(calls.length, 0);
    const step = error.recovery[0];
    const closed = await client.callTool({ name: step.tool, arguments: step.arguments });
    assert.equal(closed.isError, false);
    assert.equal(JSON.parse(closed.content[0].text).context.mode, "edit");
    const result = await client.callTool({ name: "execute", arguments: args });
    assert.equal(result.isError, false, result.content[0].text);
    assert.equal(calls.filter((x) => x.name === "changeElement").length, 1);
    assert.equal(context.revision, 3);
  } finally {
    await client.close(); await stop(); await fs.rm(profile, { recursive: true, force: true });
  }
});

test("status distinguishes retained editor selection from native, external and interactive Preview", () => {
  for (const previewKind of ["in-app", "external", "interactive"]) {
    const context = currentContext({ ready: true, projectId: "project", editorContext: {
      mode: "preview", previewKind, componentUuid: "original", previewContext: { componentUuid: "runtime-page" },
    } });
    assert.equal(context.mode, "preview");
    assert.equal(context.previewKind, previewKind);
    assert.equal(context.componentUuid, "original");
  }
});

test("root Preview routes are native Preview contexts, including the route without a trailing slash", () => {
  for (const route of ["/preview", "/preview/", "/preview-full", "/preview-full/"]) {
    const context = currentContext({ ready: true, projectId: "project", url: "https://studio.example/projects/project" + route,
      editorContext: { mode: "preview" } }, "https://studio.example");
    assert.equal(context.surface, "editor");
    assert.equal(context.mode, "preview");
    assert.equal(context.previewKind, "in-app");
  }
});

test("the page height view runs on read-only canvases as a view operation", async (t) => {
  const { controller, context, calls } = fixture(t);
  context.canEdit = false;
  await controller.dispatch("execute", { name: "setCanvasPageHeight", input: { mode: "full" } });
  assert.deepEqual(calls.at(-1), { name: "setCanvasPageHeight", input: { mode: "full" } });
  const { EDITOR_METHODS } = require("../src/mcp.cjs");
  assert.ok(EDITOR_METHODS.includes("setCanvasPageHeight"));
  await assert.rejects(
    controller.dispatch("execute", { name: "changeElement", input: { componentUuid: "page" } }),
    (error) => error.context.required.canEdit === true,
  );
});
