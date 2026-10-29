const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

function fixture(t) {
  let onMessage;
  let response;
  let contextFailure = false;
  const reads = [];
  const requests = [];
  const schemas = {
    read: { inputSchema: { type: "object" }, outputSchema: {
      definitions: { node: { type: "object", properties: { child: { $ref: "#/definitions/node" } } } },
      $ref: "#/definitions/node",
    } },
    save: { inputSchema: { type: "object" }, outputSchema: { type: "object" } },
    executeBatch: { inputSchema: { type: "object", properties: { operations: { type: "array", items: { oneOf: [{ type: "object", properties: { name: { const: "createComponent" } } }] } } } }, outputSchema: { type: "object" } },
  };
  const metadata = Object.defineProperties({}, Object.fromEntries(Object.keys(schemas).map((name) => [name, {
    enumerable: true,
    get: () => { reads.push(name); return schemas[name]; },
  }])));
  const window = {
    PLASMIC_AI_TOOLS: { _meta: metadata, read: async (input, caller) => ({ success: true, output: JSON.stringify({ input, caller }) }), getEditorContext: async () => contextFailure
      ? { success: false, error: { message: "Context read failed" } }
      : { success: true, output: JSON.stringify({ sessionId: "session", changeCounter: 2 }) } },
    addEventListener: (_name, handler) => { onMessage = handler; },
    postMessage: (message) => { response = JSON.parse(JSON.stringify(message)); },
  };
  window.top = window;
  const origin = "https://studio.example";
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/editor-bridge.js"), "utf8"), {
    window, location: { origin }, AbortController,
  });
  const controllerPath = path.join(__dirname, "../src/controller.cjs");
  const requireSource = createRequire(controllerPath);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(controllerPath, "utf8"), {
    module, setTimeout, clearTimeout, URL,
    require(name) {
      if (name === "electron") {
        return { ipcMain: { on() {}, removeListener() {} }, app: { getPath: () => "/fixture" } };
      }
      if (name === "./canvas.cjs") {
        return {};
      }
      if (name === "./image-service.cjs") {
        return { imageServiceStatus: async () => ({ configured: false }) };
      }
      if (name === "../renderer/desktop-assets.json") {
        return { build: { sourceHash: "build" } };
      }
      return requireSource(name);
    },
  });
  const controller = new module.exports.DesktopController(() => ({
    isDestroyed: () => false, webContents: {
      getURL: () => origin + "/projects/project", isLoadingMainFrame: () => false,
    },
  }), { studioOrigin: origin });
  t.after(() => controller.close());
  controller.invoke = async (method, input) => {
    requests.push({ method, input });
    await onMessage({ source: window, origin, data: {
      channel: "plasmic-desktop-request", id: "request", method, input, caller: controller.callerContext.getStore(),
    } });
    if (response.result.success === false) {
      throw new Error(response.result.error.message);
    }
    return response.result;
  };
  const state = async (input) => JSON.parse(JSON.stringify(await controller.dispatch("get_app_state", input)));
  return { controller, state, schemas, reads, requests, failContext: () => { contextFailure = true; } };
}

test("editor bridge forwards invocation ownership outside the tool input", async (t) => {
  const { controller } = fixture(t);
  controller.checkContext = async () => {};
  const input = { componentUuids: ["page"] }, caller = { id: "codex", name: "Codex" };
  const result = await controller.dispatch("execute", { name: "read", input }, caller);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { input, caller });
});

test("schema scope reaches the editor bridge without reading unrequested contracts", async (t) => {
  const { controller, state, schemas, reads } = fixture(t);
  const status = await state({ toolNames: [] });
  assert.deepEqual(reads, []);
  assert.equal(status.editorTools, undefined);
  assert.equal(status.availableEditorTools, undefined);
  assert.deepEqual(status.editorContext, { sessionId: "session", changeCounter: 2 });
  const selected = await state({ toolNames: ["read"] });
  assert.deepEqual(reads, ["read"]);
  assert.deepEqual(selected.editorTools, { read: { inputSchema: schemas.read.inputSchema } });
  assert.equal(selected.availableEditorTools, undefined);
  assert.deepEqual(selected.editorContext, { sessionId: "session" });
  assert.equal(selected.projectId, "project");
  const batch = await state({ toolNames: ["executeBatch"] });
  assert.deepEqual(batch.editorTools, { executeBatch: { mcpTool: "execute_batch" } });
  assert.deepEqual(reads, ["read"]);
  const full = await state({ toolNames: ["read", "save", "executeBatch"], schemaView: "full" });
  assert.deepEqual(full.editorTools, schemas);
  const defaultState = await state({});
  assert.equal(defaultState.editorTools, undefined);
  assert.equal(defaultState.availableEditorTools, undefined);
  assert.deepEqual((await state({ view: "tools" })).availableEditorTools, ["read", "save", "executeBatch"]);
  assert.deepEqual(await controller.dispatch("get_image_service_status", {}), { configured: false });
});

test("readiness polling retains context and propagates editor failures without fetching schemas", async (t) => {
  const { controller, state, reads, requests, failContext } = fixture(t);
  assert.equal((await controller.ready()).ready, true);
  assert.deepEqual(reads, []);
  assert.deepEqual(JSON.parse(JSON.stringify(requests)), [{ method: "metadata", input: { toolNames: [] } }]);
  await assert.rejects(state({ toolNames: ["missing"] }), /schema unavailable/);
  failContext();
  await assert.rejects(state({ toolNames: [] }), /Context read failed/);
  assert.deepEqual(reads, []);
});

test("editor cancellation targets one invocation and still returns its eventual result", async () => {
  let message;
  const disconnected = [];
  const signals = new Map(), releases = new Map(), responses = [];
  const window = {
    PLASMIC_AI_TOOLS: { _clearCallerActivity: async (id) => disconnected.push(id), _meta: { read: {} }, read: (input, _caller, signal) => {
      signals.set(input.key, signal);
      return new Promise(resolve => releases.set(input.key, resolve));
    } },
    addEventListener: (_name, handler) => { message = handler; },
    postMessage: response => responses.push(response),
  };
  window.top = window;
  const origin = "https://studio.example";
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/editor-bridge.js"), "utf8"), {
    window, location: { origin }, AbortController,
  });
  const send = (channel, id) => message({ source: window, origin, data: { channel, id, method: "read", input: { key: id } } });
  const first = send("plasmic-desktop-request", "first");
  const second = send("plasmic-desktop-request", "second");
  await send("plasmic-desktop-cancel", "first");
  assert.equal(signals.get("first").aborted, true);
  assert.equal(signals.get("second").aborted, false);
  assert.equal(responses.length, 0, "cancellation does not fabricate a mutation result");
  releases.get("first")({ success: true, output: "{}" });
  releases.get("second")({ success: true, output: "{}" });
  await Promise.all([first, second]);
  assert.deepEqual(responses.map(r => r.id), ["first", "second"]);
  await send("plasmic-desktop-cancel", "second");
  assert.equal(signals.get("second").aborted, false, "completed invocations release cancellation handlers");
  await message({ source: window, origin, data: { channel: "plasmic-desktop-caller-disconnected", callerId: "session" } });
  assert.deepEqual(disconnected, ["session"], "disconnect cleanup does not require a pending invocation");
});
