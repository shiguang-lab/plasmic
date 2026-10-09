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
  const window = { addEventListener() {} };
  window.top = inTopFrame ? window : {};
  vm.runInNewContext(source, {
    process: { argv },
    window,
    navigator: { languages: ["en-US"] },
    location: { pathname: "/", origin: "http://localhost" },
    require(name) {
      assert.equal(name, "electron");
      return {
        ipcRenderer: { on() {} },
        contextBridge: {
          exposeInMainWorld: (name, value) => {
            exposed[name] = value;
          },
        },
      };
    },
  });
  return exposed;
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
