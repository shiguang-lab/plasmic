const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { attachWindowRecovery } = require("../src/window-recovery.cjs");

function fixture(response = 2) {
  const win = new EventEmitter();
  const contents = new EventEmitter();
  const prompts = [], loads = [], cancelled = [];
  win.webContents = contents;
  win.isDestroyed = () => false;
  contents.getURL = () => "https://studio.example/projects/broken";
  win.loadURL = async (url) => { loads.push(url); };
  attachWindowRecovery(win, {
    homeUrl: "https://studio.example/", t: (text) => text,
    controller: { cancelPending: (_win, reason) => cancelled.push(reason) },
    dialog: { showMessageBox: async (_win, options) => { prompts.push(options); return { response }; }, showErrorBox: () => assert.fail("Recovery failed") },
  });
  return { win, contents, prompts, loads, cancelled };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("deduplicates repeated load failures until a navigation succeeds", async () => {
  const { contents, prompts } = fixture();
  const fail = () => contents.emit("did-fail-load", {}, -2, "ERR_FAILED", "https://studio.example/login", true);
  fail();
  await flush();
  for (let i = 0; i < 50; i++) { fail(); await flush(); }
  assert.equal(prompts.length, 1);
  contents.emit("did-navigate", {}, "https://studio.example/");
  fail();
  await flush();
  assert.equal(prompts.length, 2);
});

test("OOM exits cancel commands and default to dashboard without looping reload", async () => {
  const { contents, prompts, cancelled, loads } = fixture(1);
  contents.emit("render-process-gone", {}, { reason: "oom" });
  await flush();
  assert.equal(cancelled.length, 1);
  assert.equal(prompts[0].defaultId, 1);
  assert.deepEqual(loads, ["https://studio.example/"]);
  contents.emit("render-process-gone", {}, { reason: "clean-exit" });
  await flush();
  assert.equal(prompts.length, 1);
});
