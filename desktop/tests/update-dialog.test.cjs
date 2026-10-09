const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createUpdateDialog } = require("../src/update-dialog.cjs");

function fixture(phase = "idle") {
  const manager = new EventEmitter();
  manager.state = { phase };
  const commands = [];
  manager.command = async (command) => { commands.push(command); return manager.state; };
  const window = new EventEmitter();
  const sent = [];
  let loading = true;
  window.isDestroyed = () => false;
  window.show = () => {};
  window.focus = () => {};
  window.webContents = new EventEmitter();
  window.webContents.send = (...args) => sent.push(args);
  window.webContents.isLoadingMainFrame = () => loading;
  return {
    manager, window, commands, sent, open: createUpdateDialog(manager, window),
    loaded: () => { loading = false; window.webContents.emit("did-finish-load"); },
    send: (status) => { manager.state = status; manager.emit("status", status); },
  };
}

test("menu and completion open the main-window dialog after its page loads", () => {
  const ui = fixture();
  ui.open();
  assert.deepEqual(ui.commands, ["check"]);
  assert.equal(ui.sent.length, 0);
  ui.loaded();
  assert.deepEqual(ui.sent[0], ["desktop:update-open", { phase: "idle" }]);
  ui.send({ phase: "downloading", percent: 50 });
  assert.equal(ui.sent.length, 1);
  ui.send({ phase: "downloaded", version: "0.0.31" });
  assert.equal(ui.sent.length, 2);
  assert.deepEqual(ui.sent[1], ["desktop:update-open", ui.manager.state]);
  ui.send({ phase: "downloaded", version: "0.0.31" });
  assert.equal(ui.sent.length, 2, "Later must not immediately reopen the prompt");
  ui.open();
  assert.equal(ui.sent.length, 3);
  assert.deepEqual(ui.commands, ["check"], "Opening a ready dialog must never install or redownload");
  const webContents = ui.window.webContents;
  Object.defineProperty(ui.window, "webContents", { get: () => { throw new Error("Object has been destroyed"); } });
  ui.window.emit("closed");
  assert.equal(ui.manager.listenerCount("status"), 0);
  assert.equal(webContents.listenerCount("did-finish-load"), 0);
});

test("a preexisting completed download waits for the main page without opening another window", () => {
  const ui = fixture("downloaded");
  assert.equal(ui.sent.length, 0);
  ui.loaded();
  assert.equal(ui.sent.length, 1);
  ui.loaded();
  assert.equal(ui.sent.length, 1);
  assert.equal(ui.commands.length, 0);
});
