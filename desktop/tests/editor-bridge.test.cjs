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
  };
  const metadata = Object.defineProperties({}, Object.fromEntries(Object.keys(schemas).map((name) => [name, {
    enumerable: true,
    get: () => { reads.push(name); return schemas[name]; },
  }])));
  const window = {
    PLASMIC_AI_TOOLS: { _meta: metadata, getEditorContext: async () => contextFailure
      ? { success: false, error: { message: "Context read failed" } }
      : { success: true, output: JSON.stringify({ sessionId: "session", changeCounter: 2 }) } },
    addEventListener: (_name, handler) => { onMessage = handler; },
    postMessage: (message) => { response = JSON.parse(JSON.stringify(message)); },
  };
  window.top = window;
  const origin = "https://studio.example";
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/editor-bridge.js"), "utf8"), {
    window, location: { origin },
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
      channel: "plasmic-desktop-request", id: "request", method, input,
    } });
    if (response.result.success === false) {
      throw new Error(response.result.error.message);
    }
    return response.result;
  };
  const state = async (input) => JSON.parse(JSON.stringify(await controller.dispatch("get_app_state", input)));
  return { controller, state, schemas, reads, requests, failContext: () => { contextFailure = true; } };
}

test("schema scope reaches the editor bridge without reading unrequested contracts", async (t) => {
  const { state, schemas, reads } = fixture(t);
  const status = await state({ toolNames: [] });
  assert.deepEqual(reads, []);
  assert.deepEqual(status.editorTools, {});
  assert.deepEqual(status.availableEditorTools, ["read", "save"]);
  assert.deepEqual(status.editorContext, { sessionId: "session", changeCounter: 2 });
  const selected = await state({ toolNames: ["read"] });
  assert.deepEqual(reads, ["read"]);
  assert.deepEqual(selected.editorTools, { read: schemas.read });
  assert.deepEqual(selected.availableEditorTools, ["read", "save"]);
  assert.deepEqual(selected.editorContext, status.editorContext);
  assert.equal(selected.projectId, "project");
  const full = await state({});
  assert.deepEqual(full.editorTools, schemas);
  assert.equal(full.availableEditorTools, undefined);
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
