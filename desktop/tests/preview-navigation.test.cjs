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
  const windowForTest = Object.assign(new EventEmitter(), {
    webContents,
    isDestroyed: () => false,
    setBackgroundColor: (value) => { windowForTest.background = value; },
  });
  const appearance = require("../src/ui-appearance.cjs").createDesktopAppearance();
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
        if (name === "electron") {
          return { shell: { openExternal: (url) => externalUrls.push(url) } };
        }
        if (name === "../desktop.config.json") {
          return config;
        }
        if (name === "./ui-appearance.cjs") {
          return { createDesktopAppearance: () => appearance };
        }
        if (name === "./open-browser.cjs") {
          return { openBrowser: (url) => browserUrls.push(url) };
        }
        if (name === "./unified-login.cjs") {
          return { AUTH_ORIGIN: "https://shiguanglab.com" };
        }
        if (name.startsWith("./")) {
          return {};
        }
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
    windowForTest,
    appearance,
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

test("navigation and internal popup windows share the selected native background", () => {
  const s = setup();
  const popupUrl = config.studioOrigin + "/static/popup.html";
  assert.equal(s.windowForTest.background, "#15161b");
  assert.equal(s.handle(popupUrl).overrideBrowserWindowOptions.backgroundColor, "#15161b");
  s.appearance.set("light");
  assert.equal(s.windowForTest.background, "#eceef4");
  assert.equal(s.handle(popupUrl).overrideBrowserWindowOptions.backgroundColor, "#eceef4");
  const child = Object.assign(new EventEmitter(), {
    webContents: Object.assign(new EventEmitter(), { setWindowOpenHandler() {} }),
    isDestroyed: () => false,
    setBackgroundColor: (value) => { child.background = value; },
  });
  s.webContents.emit("did-create-window", child);
  assert.equal(child.background, "#eceef4");
  s.appearance.set("dark");
  assert.equal(child.background, "#15161b");
  child.emit("closed");
  s.appearance.set("light");
  assert.equal(child.background, "#15161b");
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
