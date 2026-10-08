const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const config = require("../desktop.config.json");

function setup() {
  let handle;
  const browserUrls = [];
  const externalUrls = [];
  const loginUrls = [];
  const webContents = new EventEmitter();
  webContents.setWindowOpenHandler = (callback) => {
    handle = callback;
  };
  const windowForTest = { webContents };
  const filename = require.resolve("../src/main.cjs");
  vm.runInNewContext(
    fs.readFileSync(filename, "utf8") +
      "\nmainWindow = windowForTest; unifiedAuth = authForTest; protectWindow(windowForTest);",
    {
      module: { exports: {} },
      __dirname: path.dirname(filename),
      process,
      URL,
      windowForTest,
      authForTest: { show: (url) => loginUrls.push(url) },
      require: (name) => {
        if (name === "electron")
          return { shell: { openExternal: (url) => externalUrls.push(url) } };
        if (name === "../desktop.config.json") return config;
        if (name === "./open-browser.cjs")
          return { openBrowser: (url) => browserUrls.push(url) };
        if (name === "./unified-login.cjs")
          return { AUTH_ORIGIN: "https://shiguanglab.com" };
        if (name.startsWith("./")) return {};
        return require(name);
      },
    },
  );
  return {
    handle: (url) => handle({ url }),
    browserUrls,
    externalUrls,
    loginUrls,
    webContents,
  };
}

test("full preview opens in the default browser and denies creating an Electron window", () => {
  const s = setup();
  for (const route of [
    "/projects/project/preview-full",
    "/projects/project/preview-full/groups/123?market=MX#branch=design",
  ]) {
    const url = config.studioOrigin + route;
    assert.equal(s.handle(url).action, "deny");
    assert.equal(s.browserUrls.at(-1), url);
  }
  assert.equal(s.externalUrls.length, 0);
  assert.equal(s.loginUrls.length, 0);
});

test("embedded preview navigation stays in the editor and other internal windows retain their policy", () => {
  const s = setup();
  let prevented = false;
  s.webContents.emit(
    "will-navigate",
    {
      preventDefault: () => {
        prevented = true;
      },
    },
    config.studioOrigin + "/projects/project/preview/groups",
  );
  assert.equal(prevented, false);
  for (const route of [
    "/projects/project",
    "/projects/project/preview-fullscreen",
    "/static/popup.html",
  ]) {
    assert.equal(s.handle(config.studioOrigin + route).action, "allow");
  }
  assert.equal(s.browserUrls.length, 0);
  assert.equal(s.handle("https://example.org/").action, "deny");
  assert.deepEqual(s.externalUrls, ["https://example.org/"]);
  const loginUrl = "https://shiguanglab.com/login?return_to=project";
  assert.equal(s.handle(loginUrl).action, "deny");
  assert.deepEqual(s.loginUrls, [loginUrl]);
});
