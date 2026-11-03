const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const source = fs.readFileSync(
  path.join(__dirname, "../src/preload.cjs"),
  "utf8",
);

function loadPreload(argv, inTopFrame = true) {
  const exposed = {};
  const events = new Map();
  const calls = [];
  const ipcEvents = new Map();
  const document = { documentElement: { dataset: { uiAppearance: "light" } } };
  const window = {
    addEventListener(name, callback) {
      events.set(name, callback);
    },
  };
  window.top = inTopFrame ? window : {};
  vm.runInNewContext(source, {
    process: { argv },
    window,
    document,
    navigator: { languages: ["en-US"] },
    location: { pathname: "/", origin: "http://localhost" },
    require(name) {
      assert.equal(name, "electron");
      return {
        ipcRenderer: {
          on: (name, callback) => ipcEvents.set(name, callback),
          invoke: async (...args) => {
            calls.push(args);
            if (args[0] === "desktop:view-state") return { active: true };
          },
        },
        contextBridge: {
          exposeInMainWorld: (bridgeName, value) => {
            exposed[bridgeName] = value;
          },
        },
      };
    },
  });
  return { ...exposed, calls, document, emit: (name, state) => ipcEvents.get(name)?.({}, state), ready: () => events.get("DOMContentLoaded")?.() };
}
test("exposes OS language priority even when Chromium uses English", () => {
  const exposed = loadPreload([
    "electron",
    '--shiguang-system-languages=["zh-Hant-TW","ja-JP"]',
  ]);
  assert.deepEqual(Array.from(exposed.desktopEnvironment.systemLanguages), [
    "zh-Hant-TW",
    "ja-JP",
  ]);
  assert.ok(exposed.desktopUpdates);
});
test("keeps OS language metadata out of embedded app frames", () => {
  const exposed = loadPreload(
    ["electron", '--shiguang-system-languages=["zh-CN"]'],
    false,
  );
  assert.equal(exposed.desktopEnvironment, undefined);
});
test("uses browser language preferences when launched without desktop arguments", () => {
  const exposed = loadPreload(["electron"]);
  assert.deepEqual(Array.from(exposed.desktopEnvironment.systemLanguages), [
    "en-US",
  ]);
});

test("passes Studio first-paint appearance to native dialogs before React loads", () => {
  const top = loadPreload(["electron"]);
  top.ready();
  assert.deepEqual(top.calls, [["desktop:view-state"], ["desktop:ui-appearance", "light"]]);
  const frame = loadPreload(["electron"], false);
  frame.ready();
  assert.deepEqual(frame.calls, []);
});


test("browser preview forwards its URL through awaitable main-frame IPC", async () => {
  const top = loadPreload(["electron"]);
  const url = "https://studio.example/d/0123456789";
  await top.desktopBrowser.openPreview(url);
  assert.deepEqual(top.calls, [["desktop:view-state"], ["desktop:open-preview", url]]);
  assert.equal(loadPreload(["electron"], false).desktopBrowser, undefined);
});


test("a newer activation beats the initial state reply and inerts inactive views", async () => {
  const ui = loadPreload(["electron"]);
  const received = [];
  const stop = ui.desktopNavigation.onActiveChange(state => received.push(state));
  ui.emit("desktop:view-state", {active:false});
  await Promise.resolve();await Promise.resolve();
  assert.equal(ui.desktopNavigation.isActive(),false);
  assert.equal(ui.document.documentElement.inert,true);
  ui.emit("desktop:view-state", {active:true,url:"https://studio.example/projects"});
  assert.equal(ui.desktopNavigation.isActive(),true);
  assert.equal(ui.document.documentElement.inert,false);
  assert.equal(received.length,2);stop();
  ui.emit("desktop:view-state",{active:false});assert.equal(received.length,2);
});
