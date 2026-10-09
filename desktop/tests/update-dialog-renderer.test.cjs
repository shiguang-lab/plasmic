const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const flush = () => new Promise((resolve) => setImmediate(resolve));
async function fixture(t, initial) {
  const dom = new JSDOM("<html><body><button id=workspace>Workspace</button></body></html>", { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  let status = { currentVersion: "0.0.23", ...initial };
  let listener, open;
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const commands = [];
  dom.window.desktopUpdates = {
    onOpen: (callback) => { open = callback; },
    onStatus: (callback) => { listener = callback; },
    command: async (command) => { commands.push(command); return status; },
  };
  dom.window.eval(fs.readFileSync(path.join(__dirname, "../src/update-dialog.js"), "utf8"));
  await flush();
  const root = dom.window.document.getElementById("plasmic-desktop-update-dialog").shadowRoot;
  return {
    window: dom.window, commands, dialog: root.querySelector("dialog"), open: () => open(status), element: (id) => root.getElementById(id),
    send: (next) => { status = { currentVersion: "0.0.23", ...next }; listener(status); },
  };
}

test("update UI follows download and install events without installing automatically", async (t) => {
  const ui = await fixture(t, { phase: "available", version: "0.0.24", releaseNotes: "## Improvements\n- Faster navigation\n- <img src=x onerror=alert(1)>" });
  assert.equal(ui.element("current-version").textContent, "0.0.23");
  assert.equal(ui.element("latest-version").textContent, "0.0.24");
  assert.equal(ui.element("notes").querySelectorAll("li").length, 2);
  assert.equal(ui.element("notes").querySelector("img"), null);
  assert.match(ui.element("notes").textContent, /<img/);
  assert.equal(ui.element("primary").disabled, true, "Downloads start in the manager without another click");
  assert.deepEqual(ui.commands, ["status"]);
  ui.send({ phase: "downloading", version: "0.0.24", percent: 45.8 });
  assert.equal(ui.element("download").hidden, false);
  assert.equal(ui.element("progress").value, 45);
  assert.equal(ui.element("primary").disabled, true);
  ui.send({ phase: "downloading", percent: 140 });
  assert.equal(ui.element("progress").value, 100);
  ui.send({ phase: "downloaded", version: "0.0.24" });
  assert.equal(ui.element("primary").textContent, "Restart and Install");
  assert.equal(ui.commands.includes("install"), false);
  ui.element("primary").click();
  await flush();
  assert.equal(ui.commands.at(-1), "install");
  ui.send({ phase: "installing" });
  const cancel = new ui.window.Event("cancel", { cancelable: true });
  ui.dialog.dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented, true);
  assert.equal(ui.commands.at(-1), "install");
});

test("retry uses the failed operation and Later closes only the dialog", async (t) => {
  const ui = await fixture(t, { phase: "error", error: "Network unavailable", retry: "download" });
  assert.equal(ui.element("description").textContent, "Network unavailable");
  ui.element("primary").click();
  await flush();
  assert.equal(ui.commands.at(-1), "download");
  ui.send({ phase: "available", version: "0.0.24", releaseNotes: [{ note: "- Improvement" }] });
  assert.equal(ui.element("notes-section").hidden, false);
  ui.open();
  assert.equal(ui.dialog.open, true);
  ui.element("secondary").click();
  await flush();
  assert.equal(ui.dialog.open, false);
  assert.equal(ui.commands.includes("close"), false);
  assert.equal(ui.commands.includes("install"), false);
});

test("a completed check removes stale release information and provides Done", async (t) => {
  const ui = await fixture(t, { phase: "checking" });
  assert.equal(ui.element("primary").disabled, true);
  ui.send({ phase: "available", version: "0.0.24", releaseNotes: "- Improvement" });
  ui.send({ phase: "current" });
  assert.equal(ui.element("latest").hidden, true);
  assert.equal(ui.element("notes-section").hidden, true);
  assert.equal(ui.element("primary").textContent, "Done");
  ui.element("primary").click();
  await flush();
  assert.equal(ui.dialog.open, false);
  assert.equal(ui.commands.includes("close"), false);
});


test("update dialog stays in the main document with isolated light styles", async (t) => {
  const ui = await fixture(t, { phase: "downloaded", version: "0.0.31" });
  assert.equal(ui.dialog.open, false);
  ui.open();
  assert.equal(ui.dialog.open, true);
  assert.equal(ui.dialog.getAttribute("aria-label"), "Software Update");
  assert.equal(ui.element("dismiss").disabled, false);
  ui.element("dismiss").click();
  assert.equal(ui.dialog.open, false);
  assert.equal(ui.commands.includes("install"), false);
  const style = ui.dialog.getRootNode().querySelector("style").textContent;
  assert.match(style, /color-scheme: light;/);
  assert.doesNotMatch(style, /prefers-color-scheme/);
  assert.equal(ui.window.document.querySelector("style"), null);
  ui.open();
  ui.send({ phase: "installing" });
  assert.equal(ui.element("dismiss").disabled, true);
});
