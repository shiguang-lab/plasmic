const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const { EventEmitter } = require("node:events");
function setup() {
  let handle, copied;
  const windows = [];
  const parent = { webContents: {} };
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.focused = 0;
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = { url: "" };
      this.webContents.setWindowOpenHandler = (handler) => { this.openHandler = handler; };
      windows.push(this);
    }
    setMenu(menu) { this.menu = menu; }
    loadURL(url) { this.webContents.mainFrame.url = url; }
    focus() { this.focused++; }
    show() { this.shown = true; }
    close() { this.emit("closed"); }
  }
  const source = fs.readFileSync(require.resolve("../src/mcp-settings.cjs"), "utf8");
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module, __dirname: require("node:path").dirname(require.resolve("../src/mcp-settings.cjs")),
    require: (name) => name === "electron" ? {
      BrowserWindow,
      ipcMain: { handle: (_, callback) => { handle = callback; } },
      clipboard: { writeText: (text) => { copied = text; } },
    } : require(name),
  });
  const clients = [{ id: "codex", enabled: false }];
  const integrations = { status: () => clients, customConfig: () => "fixture", set: () => clients };
  const open = module.exports.createMcpSettings(integrations, () => parent);
  open();
  const window = windows[0];
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
  return { handle, event, open, clients, windows, parent, copied: () => copied };
}
test("opens one isolated Electron modal, reuses it, and accepts IPC only from its settings page", () => {
  const s = setup();
  const window = s.windows[0];
  assert.equal(window.options.parent, s.parent);
  assert.equal(window.options.modal, true);
  assert.equal(window.options.webPreferences.sandbox, true);
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  s.open();
  assert.equal(s.windows.length, 1);
  assert.equal(window.focused, 1);
  assert.throws(() => s.handle({ ...s.event, sender: s.parent.webContents }, "get"), /Invalid/);
  assert.throws(() => s.handle({ ...s.event, senderFrame: { url: s.event.senderFrame.url } }, "get"), /Invalid/);
  const page = s.event.senderFrame.url;
  s.event.senderFrame.url = "https://studio.example.org/";
  assert.throws(() => s.handle(s.event, "get"), /Invalid/);
  s.event.senderFrame.url = page;
  assert.equal(s.handle(s.event, "close"), true);
  assert.throws(() => s.handle(s.event, "get"), /Invalid/);
  s.open();
  assert.equal(s.windows.length, 2);
});
test("settings read and update clients and copy config without exposing removed commands", () => {
  const s = setup();
  assert.equal(s.handle(s.event, "get").clients, s.clients);
  assert.equal(s.handle(s.event, "set", { id: "codex", enabled: true }).clients, s.clients);
  assert.equal(s.handle(s.event, "copy"), true);
  assert.equal(s.copied(), "fixture");
  assert.throws(() => s.handle(s.event, "image-set", {}), /Invalid MCP settings command/);
});
