const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  return name === "electron"
    ? { app: { getPath: () => require("node:os").tmpdir() }, ipcMain: { on() {}, removeListener() {} } }
    : originalLoad.call(this, name, ...args);
};
const { DesktopController } = require("../src/controller.cjs");
Module._load = originalLoad;

test("MCP Preview state and navigation report availability without operating Studio history or reload", async (t) => {
  const dom = new JSDOM('<div class="live-root-container" data-plasmic-preview-component="details"></div>', { url: "https://canvas.example/#live=true", runScripts: "outside-only" });
  t.after(() => dom.window.close());
  dom.window.document.fonts = { ready: Promise.resolve() };
  dom.window.requestAnimationFrame = (callback) => callback();
  const frame = { url: dom.window.location.href, executeJavaScript: (script) => dom.window.eval(script) };
  const context = { projectId: "p", branchId: null, sessionId: "s", changeCounter: 0, mode: "preview", previewKind: "in-app",
    componentUuid: "editor-page", previewContext: { componentUuid: "details", path: "/details", canGoBack: true, canGoForward: false } };
  const controller = new DesktopController(() => ({ isDestroyed: () => false, webContents: {
    getURL: () => `https://studio.example/projects/p/preview${context.previewContext.path}`,
    mainFrame: { framesInSubtree: [frame] },
    reload: () => assert.fail("Studio reloaded"),
    navigationHistory: { goBack: () => assert.fail("Studio went back"), goForward: () => assert.fail("Studio went forward") },
  } }), { studioOrigin: "https://studio.example" });
  t.after(() => controller.close());
  controller.state = async () => ({ ready: true, projectId: "p", editorContext: context });
  const commands = [];
  controller.editor = async (name, input) => {
    if (name === "getEditorContext") return structuredClone(context);
    assert.equal(name, "preview");
    commands.push(input);
    if (input.action === "back" || input.action === "forward") {
      const back = input.action === "back";
      const componentUuid = back ? "list" : "details";
      context.previewContext = { componentUuid, path: `/${componentUuid}`, canGoBack: !back, canGoForward: back };
      // The native tool changes route before the runtime commits its new Page.
      setTimeout(() => dom.window.document.querySelector(".live-root-container").setAttribute("data-plasmic-preview-component", componentUuid), 10);
    }
    return { mode: "preview", componentUuid: context.previewContext.componentUuid };
  };
  const state = await controller.dispatch("preview", { action: "state" });
  assert.equal(state.ready, true);
  assert.equal(state.canGoBack, true);
  assert.equal(state.canGoForward, false);
  for (const action of ["back", "forward", "refresh"]) {
    const result = await controller.dispatch("preview", { action });
    assert.equal(result.canGoBack, action !== "back");
    assert.equal(result.canGoForward, action === "back");
    assert.equal(dom.window.document.querySelector(".live-root-container").getAttribute("data-plasmic-preview-component"), result.componentUuid);
    assert.equal(result.context.componentUuid, "editor-page");
  }
  assert.deepEqual(commands, [{ action: "back" }, { action: "forward" }, { action: "refresh" }]);
  await assert.rejects(controller.dispatch("preview", { action: "back", width: 1440 }), /Invalid parameters/);
});

test("MCP Preview state outside Preview reports both navigation directions unavailable", async (t) => {
  const context = { projectId: "p", sessionId: "s", changeCounter: 0, mode: "edit", previewContext: null };
  const controller = new DesktopController(() => ({ isDestroyed: () => false, webContents: { getURL: () => "https://studio.example/projects/p" } }), { studioOrigin: "https://studio.example" });
  t.after(() => controller.close());
  controller.state = async () => ({ ready: true, projectId: "p", editorContext: context });
  controller.editor = async (name) => { assert.equal(name, "getEditorContext"); return context; };
  const result = await controller.dispatch("preview", { action: "state" });
  assert.equal(result.ready, false);
  assert.equal(result.canGoBack, false);
  assert.equal(result.canGoForward, false);
  for (const action of ["back", "forward", "refresh"]) {
    await assert.rejects(controller.dispatch("preview", { action }), (error) => error.context?.operationExecuted === false);
  }
});
