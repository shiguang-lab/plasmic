const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { startRpc } = require("../src/local-rpc.cjs");
const original = Module._load;
Module._load = function (name, ...args) {
  return name === "electron" ? { ipcMain: { on() {}, removeListener() {} }, app: { getPath: () => os.tmpdir() } } : original.call(this, name, ...args);
};
const { DesktopController } = require("../src/controller.cjs");
Module._load = original;

test("public MCP output preserves the next-step inputs without UI state, permissions or duplicate source", async (t) => {
  const build = { rendererHash: "a".repeat(64), desktopHash: "b".repeat(64), sourceHash: "c".repeat(64) };
  t.mock.method(Module, "_load", function (name, ...args) {
    return name === "../renderer/desktop-assets.json" ? { build } : original.call(this, name, ...args);
  });
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-output-scope-"));
  const view = { arenaId: "Pages", arenaType: "custom", frameUuid: "frame", scale: 0.75, scroll: { x: 10, y: 20 } };
  const context = { projectId: "project", branchId: null, sessionId: "session", revision: 3, changeCounter: 5,
    componentUuid: "page", selectedElementUuids: ["node"], editorView: view, browserImportCanvasName: "ImportCanvas", mode: "edit", canEdit: true };
  const contextSchema = { type: "object", properties: { projectId: { type: "string" }, editorView: { type: "object" }, browserImportCanvasName: { type: "string" } }, required: ["projectId", "editorView", "browserImportCanvasName"] };
  const controller = new DesktopController(() => ({ isDestroyed: () => false }), {});
  controller.state = async () => ({ running: true, ready: true, version: require("../package.json").version, build,
    projectId: "project", editorContext: context, browser: { recent: ["private history"] }, imageService: { configured: false },
    availableEditorTools: ["getEditorContext"], editorTools: { getEditorContext: { inputSchema: { type: "object" }, outputSchema: contextSchema } } });
  controller.ready = async () => {};
  let restored;
  controller.editor = async (name, input) => {
    if (name === "getEditorContext") return context;
    if (name === "restoreEditorView") { restored = input; return { restored: true }; }
    throw Error(name);
  };
  const imported = { projectId: "project", componentUuid: "imported", frameUuid: "import-frame", canvasName: "Imports", warnings: ["Unsupported effect"], changeCounter: 6 };
  controller.browser = { state: {url:"https://example.org"}, dispose() {}, command: async ({ action }) => action === "import_to_canvas" ? imported : {
    url: "https://example.org", title: "Reference", loading: false, visible: action !== "close", width: 1440, height: 900,
    recent: ["unrelated history"], appearance: "dark", platform: "darwin", result: imported,
    selection: { selector: "main", ancestors: [{ selector: "main", tag: "main", width: 800, height: 600 }], details: { typography: "x".repeat(20000) } }, picking: false,
  } };
  const calls = [];
  const stop = await startRpc(profile, async (method, input) => {
    calls.push(method);
    if (method === "export_code") return { path: input.outputPath, files: Array.from({ length: 120 }, (_, i) => `Component${i}.tsx`) };
    return controller.dispatch(method, input);
  });
  const client = new Client({ name: "scope-test", version: "1" });
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath,
      args: ["-e", `require(${JSON.stringify(require.resolve("../src/mcp.cjs"))}).serveMcp(${JSON.stringify(profile)})`], stderr: "pipe" }));
    const call = async (name, input = {}) => {
      const result = await client.callTool({ name, arguments: input });
      assert.equal(result.isError, false, result.content[0].text);
      assert.equal(result.structuredContent, undefined);
      return JSON.parse(result.content[0].text);
    };
    const status = await call("get_app_state");
    assert.equal(status.build, undefined);
    assert.equal(status.browser, undefined);
    assert.equal(status.imageService, undefined);
    assert.equal((await call("get_build_info")).buildId, status.buildId);
    assert.deepEqual((await call("get_build_info")).build, build);
    const publicContext = await call("execute", { name: "getEditorContext", input: {} });
    assert.equal(publicContext.editorView, undefined);
    assert.equal(publicContext.browserImportCanvasName, undefined);
    assert.deepEqual(publicContext.selectedElementUuids, ["node"]);
    const schema = (await call("get_app_state", { toolNames: ["getEditorContext"], schemaView: "full" })).editorTools.getEditorContext.outputSchema;
    assert.deepEqual(Object.keys(schema.properties), ["projectId"]);
    assert.deepEqual(schema.required, ["projectId"]);
    const snapshot = await call("get_editor_view");
    await call("execute", { name: "restoreEditorView", input: snapshot.view });
    assert.deepEqual(restored, view);
    assert.deepEqual(context.editorView, view);
    for (const action of ["open", "load_page", "get_state", "select_element", "close"]) {
      const result = await call("reference_browser", { action, ...(action === "load_page" ? { url: "https://example.org" } : {}) });
      for (const key of ["recent", "result", "appearance", "platform"]) assert.equal(result[key], undefined);
      if (["get_state", "select_element"].includes(action)) assert.equal(result.selection.selector, "main");
      assert.ok(JSON.stringify(result).length < 1000);
    }
    assert.deepEqual(await call("import_reference", { action: "editable" }), imported);
    const vector = await call("make_vector", { width: 1000, height: 1000,
      paths: [Array.from({ length: 1000 }, (_, i) => `M${i % 50 * 18} ${Math.floor(i / 50) * 18}h10v10h-10Z`).join(" ")] });
    assert.equal(vector.pathCount, 1);
    assert.equal(vector.paths, undefined);
    assert.equal(Array.isArray(vector.bounds), false);
    assert.ok(JSON.stringify(vector).length < 1000);
    let svg = "", offset;
    do {
      const page = await call("read_result", { resultId: vector.svg.resultId, offset: offset || 0 });
      svg += page.text; offset = page.nextOffset;
    } while (offset !== undefined);
    assert.equal((svg.match(/M[\d-]/g) || []).length, 1000);
    const united = await call("make_vector", { width: 100, height: 100, operation: "unite", paths: ["M0 0h40v40h-40Z", "M20 0h40v40h-40Z"] });
    const source = (await call("read_result", { resultId: united.svg.resultId })).text;
    const paths = [...source.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);
    const clipped = await call("make_vector", { width: 100, height: 100, operation: "intersect", paths: [...paths, "M20 0h20v40h-20Z"] });
    assert.ok(Math.abs(clipped.area - 800) < 1e-8);
    for (const [key, value] of Object.entries({ x: 20, y: 0, width: 20, height: 40 })) assert.ok(Math.abs(clipped.bounds[key] - value) < 1e-8);
    const exported = await call("export_code", { outputPath: "/tmp/test-export" });
    assert.equal(exported.fileCount, 120);
    const files = [];
    offset = 0;
    do {
      const page = await call("read_result", { resultId: exported.files.resultId, offset });
      files.push(...page.entries.map((entry) => entry.value)); offset = page.nextOffset;
    } while (offset !== undefined);
    assert.equal(files.at(-1), "Component119.tsx");
    assert.equal(calls.filter((method) => method === "export_code").length, 1);
    controller.editor = async () => ({ output: "<EditorContext>unparsed</EditorContext>" });
    const invalid = await client.callTool({ name: "execute", arguments: { name: "getEditorContext", input: {} } });
    assert.equal(invalid.isError, true);
    assert.match(invalid.content[0].text, /outputFormat:json/);
  } finally {
    await client.close(); await stop(); controller.close(); await fs.rm(profile, { recursive: true, force: true });
  }
});
