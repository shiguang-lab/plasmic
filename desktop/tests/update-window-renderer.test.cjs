const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const flush = () => new Promise((resolve) => setImmediate(resolve));
async function fixture(t, initial) {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, "../src/update-window.html"), "utf8"), { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  let status = { currentVersion: "0.0.23", ...initial };
  let listener;
  const commands = [];
  dom.window.updateWindow = {
    onStatus: (callback) => { listener = callback; },
    command: async (command) => { commands.push(command); return status; },
  };
  dom.window.eval(fs.readFileSync(path.join(__dirname, "../src/update-window-renderer.js"), "utf8"));
  await flush();
  return {
    window: dom.window, commands, element: (id) => dom.window.document.getElementById(id),
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
  ui.window.document.dispatchEvent(new ui.window.KeyboardEvent("keydown", { key: "Escape" }));
  assert.equal(ui.commands.at(-1), "install");
});

test("retry uses the failed operation and Later only closes the window", async (t) => {
  const ui = await fixture(t, { phase: "error", error: "Network unavailable", retry: "download" });
  assert.equal(ui.element("description").textContent, "Network unavailable");
  ui.element("primary").click();
  await flush();
  assert.equal(ui.commands.at(-1), "download");
  ui.send({ phase: "available", version: "0.0.24", releaseNotes: [{ note: "- Improvement" }] });
  assert.equal(ui.element("notes-section").hidden, false);
  ui.element("secondary").click();
  await flush();
  assert.equal(ui.commands.at(-1), "close");
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
  assert.equal(ui.commands.at(-1), "close");
});
