const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
test("Desktop Google entry requests native login without creating a popup or triggering the popup-blocked branch", () => {
  const calls = [],
    messages = [];
  const window = {
    addEventListener: () => {},
    postMessage: (value) => messages.push(value),
    open: (...args) => {
      calls.push(args);
      return { preview: true };
    },
  };
  window.top = window;
  const location = {
    origin: "https://plasmic.studio.publib.cn",
    href: "https://plasmic.studio.publib.cn/login",
  };
  vm.runInNewContext(
    fs.readFileSync(path.resolve(__dirname, "../src/editor-bridge.js"), "utf8"),
    { window, location, URL },
  );
  assert.equal(
    window.open("/api/v1/auth/google", "_blank", "width=600,height=600"),
    window,
  );
  assert.equal(calls.length, 0);
  assert.equal(messages[0].channel, "plasmic-desktop-google-start");
  assert.equal(window.open("/projects/example/preview").preview, true);
  assert.equal(calls.length, 1);
});
