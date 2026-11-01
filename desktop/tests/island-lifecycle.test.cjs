const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { IslandActivity } = require("../src/island-activity.cjs");

const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(setImmediate); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function fixture(t) {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "island-lifecycle-"));
  const windows = [], messages = [], requests = [];
  class Window extends EventEmitter {
    constructor() {
      super(); windows.push(this);
      this.webContents = Object.assign(new EventEmitter(), {
        getURL: () => this.url || "https://studio.test/projects/p",
        send: (channel, value) => messages.push(structuredClone({ channel, value })),
        setWindowOpenHandler() {}, setBackgroundThrottling() {},
      });
    }
    isDestroyed() { return !!this.destroyed; }
    isMinimized() { return false; }
    isFullScreen() { return false; }
    hide() { this.hidden = true; }
    show() { this.hidden = false; }
    showInactive() { this.hidden = false; }
    focus() {}
    setMenu() {} setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} setIgnoreMouseEvents() {} setPosition() {}
    getPosition() { return [0, 0]; }
    getBounds() { return { x: 0, y: 0, width: 456, height: 180 }; }
    async loadURL() {}
    destroy() { this.destroyed = true; this.emit("closed"); }
  }
  const main = new Window(), activity = new IslandActivity(), identity = new EventEmitter();
  identity.read = async () => ({ user: { id: "account" } });
  const controller = {
    activity, reads: 0,
    state: async () => {
      controller.reads++;
      return { url: main.webContents.getURL(), ready: true, projectId: "p", editorContext: { mode: "edit", canEdit: true, saveStatus: "saved" } };
    },
    requestStudio: async (url, _input, signal) => {
      requests.push({ url, signal });
      return url.includes("projects?") ? { projects: [] } : { teams: [], workspaces: [] };
    },
  };
  const mirror = { closes: 0, resets: 0, async capture() { return mirror.image || null; }, close() { this.closes++; }, reset() { this.resets++; } };
  let localeListener, appearanceListener;
  const i18n = { t: value => value, snapshot: () => ({ locale: "en" }), subscribe(fn) { localeListener = fn; return () => {}; } };
  const appearance = { snapshot: () => "dark", subscribe(fn) { appearanceListener = fn; return () => {}; } };
  const originalLoad = Module._load, filename = require.resolve("../src/island.cjs");
  delete require.cache[filename];
  Module._load = function(name, ...args) {
    if (name === "electron") return {
      app: { getPath: () => profile, isPackaged: true, setActivationPolicy() {}, dock: { hide() {}, async show() {} } },
      BrowserWindow: Window, ipcMain: { handle() {}, removeHandler() {} },
      screen: { getCursorScreenPoint: () => ({ x: -1000, y: -1000 }), getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1200, height: 800 } }) },
    };
    if (name === "./island-capture.cjs") return { createIslandCapture: () => mirror };
    return originalLoad.call(this, name, ...args);
  };
  let createIsland;
  try { ({ createIsland } = require(filename)); } finally { Module._load = originalLoad; delete require.cache[filename]; }
  const presentation = createIsland({ getWindow: () => main, controller, identity, i18n, appearance, config: { studioOrigin: "https://studio.test" }, isQuitting: () => false });
  presentation.attach(main);
  t.after(() => { presentation.dispose(); fs.rmSync(profile, { recursive: true, force: true }); });
  return { main, windows, messages, requests, controller, activity, mirror, presentation,
    notify: () => { activity.notify(); localeListener(); appearanceListener(); },
    tick: async () => { t.mock.timers.tick(500); await flush(); } };
}

test("unchanged state is silent; pixel bytes travel once while feedback and save status still update", async t => {
  const f = fixture(t);
  await f.presentation.setMode("island"); await flush();
  const idle = f.messages.length;
  f.notify(); await f.tick();
  assert.equal(f.messages.length, idle);
  f.activity.enqueue("read", "execute", { name: "read" }); f.activity.start("read");
  f.mirror.image = { src: "data:image/jpeg;base64," + "pixels".repeat(10000), width: 400, height: 300, capturedAt: 1, feedback: null };
  await f.tick();
  assert.equal(f.messages.at(-1).value.image.src, f.mirror.image.src);
  const unchanged = f.messages.length; await f.tick();
  assert.equal(f.messages.length, unchanged);
  f.mirror.image = { ...f.mirror.image, feedback: { id: "read", regions: [{ x: 0, y: 0, width: 1, height: 1 }] } };
  await f.tick();
  assert.equal(Object.hasOwn(f.messages.at(-1).value.image, "src"), false);
  assert.equal(f.messages.at(-1).value.image.feedback.id, "read");
  const state = f.controller.state;
  f.controller.state = async () => { const value = await state(); value.editorContext.saveStatus = "pending"; return value; };
  await f.tick();
  assert.equal(f.messages.at(-1).value.context.saveStatus, "pending");
  assert.equal(Object.hasOwn(f.messages.at(-1).value.image, "src"), false);
});

test("exit releases the window and stops island requests/IPC; reopening restores current state and one subscription", async t => {
  const f = fixture(t);
  f.main.webContents.emit("did-navigate-in-page", {}, f.main.webContents.getURL(), true); await flush();
  assert.equal(f.requests.length, 0);
  for (let i = 0; i < 3; i++) {
    await f.presentation.setMode("island"); await flush();
    const activeWindow = f.windows.at(-1);
    assert.equal(f.activity.listeners.size, 1);
    await f.presentation.setMode("window");
    assert.equal(activeWindow.isDestroyed(), true);
    const reads = f.controller.reads, requests = f.requests.length, sends = f.messages.length;
    f.notify(); f.main.webContents.emit("did-navigate-in-page", {}, f.main.webContents.getURL(), true);
    await f.tick();
    assert.equal(f.controller.reads, reads); assert.equal(f.requests.length, requests); assert.equal(f.messages.length, sends);
  }
  f.controller.state = async () => ({ url: "https://studio.test/projects/new", projectId: "new", ready: true, editorContext: { mode: "edit", projectName: "New project" } });
  await f.presentation.setMode("island"); await flush();
  assert.equal(f.presentation.snapshot().context.projectId, "new");
  assert.equal(f.presentation.snapshot().image, null);
  assert.equal(f.windows.filter(win => !win.isDestroyed()).length, 2);
});

test("old state reads cannot overwrite reopened state or clear its pending read; business operations continue", async t => {
  const f = fixture(t), old = deferred(), current = deferred();
  f.controller.state = () => old.promise;
  f.activity.enqueue("work", "execute", { name: "changeElement" }); f.activity.start("work");
  await f.presentation.setMode("island");
  await f.presentation.setMode("window");
  assert.equal(f.activity.operations.get("work").phase, "running");
  let reads = 0;
  f.controller.state = () => { reads++; return current.promise; };
  await f.presentation.setMode("island");
  old.resolve({ url: "https://studio.test/projects/old", projectId: "old", ready: true }); await flush();
  await f.tick(); assert.equal(reads, 1, "old finally must not unlock the new read");
  current.resolve({ url: "https://studio.test/projects/new", projectId: "new", ready: true, editorContext: { mode: "edit" } }); await flush();
  assert.equal(f.presentation.snapshot().context.projectId, "new");
  f.activity.finish("work"); assert.equal(f.presentation.snapshot().activity.operation.phase, "completed");
});
