const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  return name === "electron"
    ? { ipcMain: { on() {}, removeListener() {} } }
    : originalLoad.call(this, name, ...args);
};
const { DesktopController } = require("../src/controller.cjs");
Module._load = originalLoad;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
test("state and independent media remain responsive while editor operations serialize", async () => {
  const controller = new DesktopController(() => null, {});
  const gate = deferred();
  const entered = deferred();
  const calls = [];
  controller.execute = async (method) => {
    calls.push(method);
    if (method === "execute") {
      entered.resolve();
      await gate.promise;
    }
    return method;
  };
  const first = controller.dispatch("execute", {});
  await entered.promise;
  const second = controller.dispatch("execute_batch", {});
  assert.equal(await controller.dispatch("get_app_state", {}), "get_app_state");
  assert.equal(
    await controller.dispatch("generate_image", {}),
    "generate_image",
  );
  assert.deepEqual(calls, ["execute", "get_app_state", "generate_image"]);
  assert.deepEqual(
    [...controller.operations.values()].map((operation) => operation.phase),
    ["running", "queued"],
  );
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(controller.operations.size, 0);
  controller.close();
});
test("opening a project waits for initial loadURL to finish", async () => {
  const startup = deferred();
  const urls = [];
  const win = {
    isDestroyed: () => false,
    loadURL: async (url) => urls.push(url),
  };
  const controller = new DesktopController(
    () => win,
    { studioOrigin: "https://studio.example" },
    () => startup.promise,
  );
  controller.state = async () => ({ ready: false, projectId: null });
  controller.ready = async () => {};
  controller.editor = async () => ({ projectId: "project" });
  const opening = controller.dispatch("open_design", { projectId: "project" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(urls, []);
  startup.resolve();
  assert.equal((await opening).opened, true);
  assert.deepEqual(urls, ["https://studio.example/projects/project"]);
  controller.close();
});
test("background inspection releases its frame after a failed read without navigating", async () => {
  const controller = new DesktopController(() => null, {});
  const calls = [];
  controller.editor = async (method, input) => {
    calls.push({ method, input });
    return { inspectionId: "lease" };
  };
  await assert.rejects(
    controller.inspectCanvas({ componentUuid: "page" }, async (name) => {
      assert.equal(name, "lease");
      throw new Error("Capture failed");
    }),
    /Capture failed/,
  );
  assert.deepEqual(calls, [
    { method: "beginCanvasInspection", input: { componentUuid: "page" } },
    { method: "endCanvasInspection", input: { inspectionId: "lease" } },
  ]);
  await assert.rejects(
    controller.inspectCanvas(
      { mode: "workspace", componentUuid: "page" },
      () => {},
    ),
    /current canvas/,
  );
  controller.close();
});

test("workspace screenshots capture the editor when a project uses a custom host", async () => {
  const calls = [];
  const win = {
    isDestroyed: () => false,
    webContents: {
      capturePage: async () => {
        calls.push("capture");
        return {
          toPNG: () => Buffer.from("image"),
          getSize: () => ({ width: 1600, height: 1000 }),
        };
      },
    },
  };
  const controller = new DesktopController(() => win, {});
  controller.ready = async () => calls.push("ready");
  controller.invoke = async (method) => calls.push(method);
  const result = await controller.dispatch("get_screenshot", {
    mode: "workspace",
  });
  assert.equal(result.width, 1600);
  assert.equal(result.height, 1000);
  assert.deepEqual(calls, ["ready", "ready", "renderReady", "capture"]);
  controller.close();
});
