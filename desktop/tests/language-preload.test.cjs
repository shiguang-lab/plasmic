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
  const window = {
    addEventListener(name, callback) {
      events.set(name, callback);
    },
  };
  window.top = inTopFrame ? window : {};
  vm.runInNewContext(source, {
    process: { argv },
    window,
    document: { documentElement: { dataset: { uiAppearance: "light" } } },
    navigator: { languages: ["en-US"] },
    location: { pathname: "/", origin: "http://localhost" },
    require(name) {
      assert.equal(name, "electron");
      return {
        ipcRenderer: {
          on() {},
          invoke: async (...args) => {
            calls.push(args);
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
  return { ...exposed, calls, ready: () => events.get("DOMContentLoaded")?.() };
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
  assert.deepEqual(top.calls, [["desktop:ui-appearance", "light"]]);
  const frame = loadPreload(["electron"], false);
  frame.ready();
  assert.deepEqual(frame.calls, []);
});
