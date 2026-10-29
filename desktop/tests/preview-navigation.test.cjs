const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { EventEmitter } = require("node:events");
const config = require("../desktop.config.json");

function setup({ save = async () => {}, load = async () => {}, open = async () => {} } = {}) {
  let previewHandler;
  let handle;
  const browserUrls = [];
  const externalUrls = [];
  const loginUrls = [];
  const navigatedUrls = [];
  const navigationSteps = [];
  const errors = [];
  const state = { ready: true };
  const webContents = new EventEmitter();
  webContents.mainFrame = { url: config.studioOrigin + "/projects/project" };
  webContents.setWindowOpenHandler = (callback) => {
    handle = callback;
  };
  const windowForTest = Object.assign(new EventEmitter(), {
    webContents,
    isDestroyed: () => false,
    setBackgroundColor: (value) => { windowForTest.background = value; },
    loadURL: async (url) => {
      navigationSteps.push("navigate");
      await load(url);
      navigatedUrls.push(url);
    },
  });
  const appearance = require("../src/ui-appearance.cjs").createDesktopAppearance();
  const filename = require.resolve("../src/main.cjs");
  vm.runInNewContext(
    fs.readFileSync(filename, "utf8") +
      "\nmainWindow = windowForTest; unifiedAuth = authForTest; controller = controllerForTest; desktopI18n = { t: (key) => key }; protectWindow(windowForTest); registerPreviewForTest(openDesktopPreview);",
    {
      module: { exports: {} },
      __dirname: path.dirname(filename),
      process,
      URL,
      windowForTest,
      registerPreviewForTest: (handler) => { previewHandler = handler; },
      authForTest: { show: (url) => loginUrls.push(url) },
      controllerForTest: {
        state: async () => {
          navigationSteps.push("state");
          return state;
        },
        saveBeforeNavigation: async (current) => {
          assert.equal(current, state);
          navigationSteps.push("save");
          await save();
        },
      },
      require: (name) => {
        if (name === "electron") {
          return {
            nativeTheme: { shouldUseDarkColors: true },
            shell: { openExternal: (url) => externalUrls.push(url) },
            dialog: { showErrorBox: (title, message) => errors.push({ title, message }) },
          };
        }
        if (name === "../desktop.config.json") {
          return config;
        }
        if (name === "./ui-appearance.cjs") {
          return { createDesktopAppearance: () => appearance };
        }
        if (name === "./open-browser.cjs") {
          return { openBrowser: async (url) => { browserUrls.push(url); await open(); } };
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
    preview: (url, event = { sender: webContents, senderFrame: webContents.mainFrame }) => previewHandler(event, url),
    browserUrls,
    externalUrls,
    loginUrls,
    webContents,
    windowForTest,
    appearance,
    navigatedUrls,
    navigationSteps,
    errors,
  };
}

test("full preview opens in the default browser and denies creating an Electron window", () => {
  const s = setup();
  for (const route of [
    "/d/0123456789",
    "/d/0123456789?branch=design#/groups/123?market=MX",
  ]) {
    const url = config.studioOrigin + route;
    assert.equal(s.handle(url).action, "deny");
    assert.equal(s.browserUrls.at(-1), url);
  }
  assert.equal(s.externalUrls.length, 0);
  assert.equal(s.loginUrls.length, 0);
});

test("the current window follows native appearance and unsubscribes when closed", () => {
  const s = setup();
  assert.equal(s.windowForTest.background, "#15161b");
  s.appearance.set("light");
  assert.equal(s.windowForTest.background, "#eceef3");
  s.windowForTest.emit("closed");
  s.appearance.set("dark");
  assert.equal(s.windowForTest.background, "#eceef3");
});

test("embedded preview navigation stays in the current window", () => {
  const s = setup();
  let prevented = false;
  s.webContents.emit(
    "will-navigate",
    {
      preventDefault: () => {
        prevented = true;
      },
    },
    config.studioOrigin + "/projects/project/preview#/groups",
  );
  assert.equal(prevented, false);
});

test("internal new-window links save and navigate in the current window", async () => {
  const s = setup();
  for (const route of [
    "/projects/project?branch=design#page",
    "/projects/project/preview-fullscreen",
    "/static/popup.html",
    "/",
  ]) {
    const url = config.studioOrigin + route;
    assert.equal(s.handle(url).action, "deny");
    await new Promise(setImmediate);
    assert.equal(s.navigatedUrls.at(-1), url);
  }
  assert.deepEqual(s.navigationSteps, Array(4).fill(["state", "save", "navigate"]).flat());
  assert.deepEqual(s.errors, []);
});

test("internal navigation waits for saving and stays put if saving fails", async () => {
  let rejectSave;
  const s = setup({ save: () => new Promise((_resolve, reject) => { rejectSave = reject; }) });
  assert.equal(s.handle(config.studioOrigin + "/projects/project").action, "deny");
  await new Promise(setImmediate);
  assert.deepEqual(s.navigationSteps, ["state", "save"]);
  assert.deepEqual(s.navigatedUrls, []);
  rejectSave(new Error("Save failed"));
  await new Promise(setImmediate);
  assert.deepEqual(s.navigatedUrls, []);
  assert.deepEqual(s.errors, [{ title: "Operation Failed", message: "Please try again" }]);
});

test("failed internal navigation reports the error without opening another window", async () => {
  const s = setup({ load: async () => { throw new Error("Load failed"); } });
  assert.equal(s.handle(config.studioOrigin + "/projects/project").action, "deny");
  await new Promise(setImmediate);
  assert.deepEqual(s.errors, [{ title: "Operation Failed", message: "Please try again" }]);
});

test("external links, sign-in and blank popups cannot create application windows", () => {
  const s = setup();
  assert.equal(s.browserUrls.length, 0);
  assert.equal(s.handle("https://example.org/").action, "deny");
  assert.deepEqual(s.externalUrls, ["https://example.org/"]);
  const loginUrl = "https://shiguanglab.com/login?return_to=project";
  assert.equal(s.handle(loginUrl).action, "deny");
  assert.deepEqual(s.loginUrls, [loginUrl]);
  assert.equal(s.handle("about:blank").action, "deny");
  assert.deepEqual(s.navigationSteps, []);
});


test("preview IPC waits for native handoff and propagates launch failures", async () => {
  let finish;
  const s = setup({ open: () => new Promise((resolve) => { finish = resolve; }) });
  const url = config.studioOrigin + "/d/0123456789#/groups";
  let done = false;
  const pending = s.preview(url).then(() => { done = true; });
  await new Promise(setImmediate);
  assert.deepEqual(s.browserUrls, [url]);
  assert.equal(done, false);
  finish();
  await pending;
  assert.equal(done, true);
  const failed = setup({ open: async () => { throw new Error("Launch failed"); } });
  await assert.rejects(failed.preview(url), /Launch failed/);
});

test("preview IPC only accepts the main Studio frame and full preview URLs", () => {
  const s = setup();
  const url = config.studioOrigin + "/d/0123456789#/groups";
  for (const event of [
    { sender: {}, senderFrame: s.webContents.mainFrame },
    { sender: s.webContents, senderFrame: { url: s.webContents.mainFrame.url } },
  ]) assert.throws(() => s.preview(url, event), /Invalid Studio page/);
  for (const invalid of [
    "https://example.org/d/0123456789",
    config.studioOrigin + "/projects/project/preview",
    config.studioOrigin + "/projects/project/preview-fullscreen",
  ]) assert.throws(() => s.preview(invalid), /Invalid preview URL/);
  s.webContents.mainFrame.url = config.canvasOrigin;
  assert.throws(() => s.preview(url), /Invalid Studio page/);
  assert.deepEqual(s.browserUrls, []);
});
