const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const { EventEmitter } = require("node:events");
const ipcMain = new EventEmitter();
const load = Module._load;
Module._load = function(name,...args) { return name === "electron" ? { ipcMain } : load.call(this,name,...args); };

const { createUpdateDialog } = require("../src/update-dialog.cjs");
Module._load = load;

function fixture(phase = "idle") {
  const manager = new EventEmitter();
  manager.state = { phase };
  const commands = [];
  manager.command = async (command) => {
    commands.push(command);
    return manager.state;
  };
  const window = new EventEmitter();
  const sent = [];
  let loading = true;
  window.isDestroyed = () => false;
  window.show = () => {};
  window.focus = () => {};
  window.isFocused = () => true;
  window.webContents = new EventEmitter();
  window.webContents.mainFrame = { framesInSubtree: [] };
  window.webContents.send = (...args) => sent.push(args);
  window.webContents.isLoadingMainFrame = () => loading;
  window.webContents.isFocused = () => true;
  return {
    manager,
    window,
    commands,
    sent,
    open: createUpdateDialog(manager, window, window.webContents),
    loaded: () => {
      loading = false;
      window.webContents.emit("did-finish-load");
    },
    send: (status) => {
      manager.state = status;
      manager.emit("status", status);
    },
  };
}

test("explicit requests open the dialog after its page loads without reopening on completion", () => {
  const ui = fixture();
  ui.open();
  assert.deepEqual(ui.commands, ["check"]);
  assert.equal(ui.sent.length, 0);
  ui.loaded();
  assert.deepEqual(ui.sent[0], ["desktop:update-open", { phase: "idle" }]);
  ui.send({ phase: "downloading", percent: 50 });
  assert.equal(ui.sent.length, 1);
  ui.send({ phase: "downloaded", version: "0.0.31" });
  assert.equal(
    ui.sent.length,
    1,
    "Background completion must not open the dialog",
  );
  ui.send({ phase: "downloaded", version: "0.0.31" });
  assert.equal(ui.sent.length, 1);
  ui.open();
  assert.equal(ui.sent.length, 2);
  assert.deepEqual(ui.sent[1], ["desktop:update-open", ui.manager.state]);
  assert.deepEqual(
    ui.commands,
    ["check"],
    "Opening a ready dialog must never install or redownload",
  );
  const webContents = ui.window.webContents;
  Object.defineProperty(ui.window, "webContents", {
    get: () => {
      throw new Error("Object has been destroyed");
    },
  });
  webContents.emit("destroyed");
  assert.equal(ui.manager.listenerCount("status"), 0);
  assert.equal(webContents.listenerCount("did-finish-load"), 0);
});

test("a preexisting completed download stays silent until explicitly opened", () => {
  const ui = fixture("downloaded");
  assert.equal(ui.sent.length, 0);
  ui.loaded();
  assert.equal(ui.sent.length, 0);
  ui.loaded();
  assert.equal(ui.sent.length, 0);
  ui.open();
  assert.deepEqual(ui.sent, [["desktop:update-open", { phase: "downloaded" }]]);
  assert.equal(ui.commands.length, 0);
});

test("background downloads stay silent across page loads and deliver the latest status on click", () => {
  const ui = fixture("downloading");
  ui.send({ phase: "downloaded", version: "0.0.31" });
  ui.loaded();
  assert.equal(ui.sent.length, 0);
  ui.open();
  assert.deepEqual(ui.sent, [["desktop:update-open", ui.manager.state]]);
  assert.equal(ui.commands.length, 0);
});

test("closing updates restores the exact nested frame and retains it across repeated opens", async () => {
  const ui = fixture();
  let restored = 0;
  const editor = { detached: false, executeJavaScript: async script => { assert.equal(script,"window.focus()"); restored++; } };
  const contents = ui.window.webContents;
  contents.mainFrame.framesInSubtree = [contents.mainFrame, editor];
  contents.focusedFrame = editor;
  ui.loaded();ui.open();
  contents.focusedFrame = contents.mainFrame;
  ui.open();
  ipcMain.emit("desktop:update-dialog-closed",{sender:contents,senderFrame:{}});
  ipcMain.emit("desktop:update-dialog-closed",{sender:{},senderFrame:contents.mainFrame});
  assert.equal(restored,0);
  ipcMain.emit("desktop:update-dialog-closed",{sender:contents,senderFrame:contents.mainFrame});
  await Promise.resolve();assert.equal(restored,1);
  ipcMain.emit("desktop:update-dialog-closed",{sender:contents,senderFrame:contents.mainFrame});
  assert.equal(restored,1);
  contents.emit("destroyed");
});

test("closing updates does not focus a detached editor or steal focus from another window", () => {
  for (const detached of [true,false]) {
    const ui=fixture(),contents=ui.window.webContents;
    const editor={detached,executeJavaScript:()=>assert.fail("Unexpected focus")};
    contents.mainFrame.framesInSubtree=[contents.mainFrame,editor];contents.focusedFrame=editor;
    ui.window.isFocused=()=>detached;
    ui.loaded();ui.open();
    ipcMain.emit("desktop:update-dialog-closed",{sender:contents,senderFrame:contents.mainFrame});
    contents.emit("destroyed");
  }
});

test("destroyed renderer removes its focus callback and ignores late close notifications", () => {
  const before=ipcMain.listenerCount("desktop:update-dialog-closed"),ui=fixture();
  const contents=ui.window.webContents;
  assert.equal(ipcMain.listenerCount("desktop:update-dialog-closed"),before+1);
  ui.loaded();ui.open();contents.emit("destroyed");
  assert.equal(ipcMain.listenerCount("desktop:update-dialog-closed"),before);
  ipcMain.emit("desktop:update-dialog-closed",{sender:contents,senderFrame:contents.mainFrame});
});

test("closing an inactive retained view does not steal the active editor focus", () => {
  const ui=fixture(),contents=ui.window.webContents;
  const editor={executeJavaScript:()=>assert.fail("Inactive view stole focus")};
  contents.mainFrame.framesInSubtree=[editor];contents.focusedFrame=editor;
  ui.loaded();ui.open();contents.isFocused=()=>false;
  ipcMain.emit("desktop:update-dialog-closed",{sender:contents,senderFrame:contents.mainFrame});
  contents.emit("destroyed");
});
