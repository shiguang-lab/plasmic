const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { EventEmitter } = require("node:events");

test("update window isolates commands and can close without stopping the updater", async () => {
  const handlers = {};
  const windows = [];
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.options = options; windows.push(this);
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = {};
      this.sent = [];
      this.webContents.send = (...args) => this.sent.push(args);
      this.webContents.setWindowOpenHandler = (handler) => { this.openHandler = handler; };
    }
    setMenu(menu) { this.menu = menu; }
    loadURL(url) { this.webContents.mainFrame.url = url; return Promise.resolve(); }
    show() { this.shown = true; }
    focus() { this.focused = true; }
    close() { this.destroyed = true; this.emit("closed"); }
    isDestroyed() { return !!this.destroyed; }
  }
  const load = Module._load;
  Module._load = function (id, ...args) {
    return id === "electron" ? {
      BrowserWindow: Window, nativeTheme: { shouldUseDarkColors: false },
      ipcMain: { handle: (name, handler) => { handlers[name] = handler; } },
    } : load.call(this, id, ...args);
  };
  let createUpdateWindow;
  try { ({ createUpdateWindow } = require("../src/update-window.cjs")); }
  finally { Module._load = load; }
  const manager = new EventEmitter();
  manager.state = { phase: "idle" };
  const send = (status) => { manager.state = status; manager.emit("status", status); };
  const commands = [];
  manager.command = async (command) => { commands.push(command); return { phase: "available" }; };
  const parent = {};
  const open = createUpdateWindow(manager, () => parent);
  open();
  const window = windows[0];
  const handler = handlers["desktop:update-window"];
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
  assert.deepEqual(commands, ["check"]);
  assert.equal(window.options.parent, parent);
  assert.equal(window.options.modal, false);
  assert.deepEqual(window.options.webPreferences, {
    preload: require("node:path").resolve(__dirname, "../src/update-window-preload.cjs"),
    nodeIntegration: false, contextIsolation: true, sandbox: true,
  });
  for (const invalid of [
    { sender: {}, senderFrame: event.senderFrame },
    { sender: event.sender, senderFrame: { url: event.senderFrame.url } },
  ]) assert.throws(() => handler(invalid, "install"), /Invalid update window sender/);
  const page = event.senderFrame.url;
  event.senderFrame.url = "https://untrusted.example";
  assert.throws(() => handler(event, "install"), /Invalid update window sender/);
  event.senderFrame.url = page;
  assert.throws(() => handler(event, "quit"), /Invalid update window command/);
  assert.deepEqual(window.openHandler(), { action: "deny" });
  for (const name of ["will-navigate", "will-attach-webview"]) {
    let prevented = false;
    window.webContents.emit(name, { preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
  }
  await handler(event, "download");
  send({ phase: "downloading", percent: 45 });
  assert.deepEqual(window.sent.at(-1), ["desktop:update-status", { phase: "downloading", percent: 45 }]);
  open();
  assert.equal(windows.length, 1);
  assert.equal(window.focused, true);
  handler(event, "close");
  send({ phase: "downloaded" });
  assert.equal(window.sent.length, 1);
  assert.deepEqual(commands, ["check", "download"], "Closing must not install or cancel the download");
  assert.throws(() => handler(event, "install"), /Invalid update window sender/);
  assert.equal(windows.length, 2, "A completed download automatically opens the install prompt");
  const prompt = windows[1];
  prompt.close();
  send({ phase: "downloaded" });
  assert.equal(windows.length, 2, "Later must not immediately reopen the same prompt");
  open();
  assert.equal(windows.length, 3);
  assert.deepEqual(commands, ["check", "download"], "Reopening a ready update must not recheck or download again");
  windows[2].close();
  send({ phase: "error", retry: "install", error: "Save failed" });
  open();
  assert.deepEqual(commands, ["check", "download"], "Opening an installation error must preserve the retry operation");
  windows[3].close();
  createUpdateWindow(manager, () => parent);
  assert.equal(windows.length, 4);
  manager.state = { phase: "downloaded" };
  createUpdateWindow(manager, () => parent);
  assert.equal(windows.length, 5, "A download that completed before the window controller initialized must still prompt");
});
