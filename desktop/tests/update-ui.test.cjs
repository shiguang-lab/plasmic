const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const flush = () => new Promise((resolve) => setImmediate(resolve));

async function fixture(t, html, initial) {
  const dom = new JSDOM(html, { runScripts: "outside-only" });
  const observers = [];
  const MutationObserver = dom.window.MutationObserver;
  dom.window.MutationObserver = class extends MutationObserver {
    constructor(callback) {
      super(callback);
      observers.push(this);
    }
  };
  t.after(() => {
    for (const observer of observers) observer.disconnect();
    dom.window.close();
  });
  dom.window.HTMLElement.prototype.showPopover = function () {};
  dom.window.HTMLElement.prototype.hidePopover = function () {};
  // JSDOM has no layout; real visibility is covered by the native Electron test.
  dom.window.Element.prototype.checkVisibility = function () {
    return true;
  };
  let status = { currentVersion: "0.1.0", ...initial };
  let listener;
  const commands = [];
  dom.window.desktopUpdates = {
    command: async (command) => {
      commands.push(command);
      return status;
    },
    onStatus: (callback) => {
      listener = callback;
    },
  };
  for (const file of ["renderer-i18n.js", "update-ui.js"]) {
    dom.window.eval(
      fs.readFileSync(path.join(__dirname, "../src", file), "utf8"),
    );
  }
  await flush();
  return {
    document: dom.window.document,
    commands,
    send(next) {
      status = { currentVersion: "0.1.0", ...next };
      listener(status);
    },
  };
}

test("dashboard only shows update states and opens ready details without installing", async (t) => {
  const ui = await fixture(
    t,
    '<header><div><a id="brand">Plasmic</a><span data-desktop-update-slot="header"></span></div><button id="avatar">User</button></header>',
    { phase: "current" },
  );
  const control = ui.document.getElementById("plasmic-desktop-update");
  const button = control.querySelector("button");
  assert.equal(control.parentElement.previousElementSibling.id, "brand");
  for (const phase of ["idle", "checking", "current", "disabled"]) {
    ui.send({ phase });
    assert.equal(control.hidden, true);
  }
  for (const phase of [
    "available",
    "downloading",
    "downloaded",
    "installing",
  ]) {
    ui.send({ phase, version: "0.2.0", percent: 42 });
    assert.equal(control.hidden, false);
    assert.equal(button.disabled, phase !== "downloaded");
  }
  ui.send({ phase: "downloading", version: "0.2.0", percent: 72 });
  assert.equal(control.querySelector(".update-tooltip").textContent, "Downloading 0.2.0 · 72%");
  assert.equal(control.querySelector("button").textContent, "");
  assert.equal(control.querySelectorAll("svg circle").length, 2);
  ui.send({ phase: "downloaded", version: "0.2.0" });
  assert.equal(control.querySelector("svg").dataset.icon, "download");
  button.click();
  await flush();
  assert.deepEqual(ui.commands, ["status", "open"]);
  assert.equal(ui.commands.includes("check"), false);
  assert.equal(ui.commands.includes("install"), false);
});

test("dashboard route remount preserves ready state and editor visibility rules", async (t) => {
  const ui = await fixture(
    t,
    '<span data-desktop-update-slot="header"></span>',
    { phase: "downloaded", version: "0.2.0" },
  );
  const control = ui.document.getElementById("plasmic-desktop-update");
  ui.document.body.innerHTML =
    '<span data-desktop-update-slot="header"></span>';
  await flush();
  assert.equal(
    ui.document.querySelectorAll("#plasmic-desktop-update").length,
    1,
  );
  assert.equal(control.dataset.phase, "downloaded");
  assert.equal(control.hidden, false);
  ui.document.body.innerHTML =
    '<header><div><a>Plasmic</a><span data-desktop-update-slot="header"></span></div><div>CMS</div></header>';
  await flush();
  assert.equal(
    ui.document.querySelectorAll("#plasmic-desktop-update").length,
    1,
  );
  assert.equal(control.dataset.phase, "downloaded");
  assert.equal(control.hidden, false);
  ui.document.body.innerHTML =
    '<div id="left-tab-strip"><div><button>More</button></div></div>';
  await flush();
  assert.equal(ui.document.querySelector("#plasmic-desktop-update"), null);
  ui.document.body.innerHTML =
    '<div id="left-tab-strip"><div></div></div><div class="editor-primary-actions"><span data-desktop-update-slot="header" data-desktop-update-position="above"></span><button>Avatar</button></div>';
  await flush();
  assert.equal(control.dataset.tooltipSide, "above");
  assert.equal(control.closest("#left-tab-strip"), null);
  ui.send({ phase: "current" });
  assert.equal(control.hidden, true);
  ui.document.body.innerHTML =
    '<span data-desktop-update-slot="header"></span>';
  await flush();
  assert.equal(control.hidden, true);
  assert.deepEqual(ui.commands, ["status"]);
  ui.send({ phase: "disabled" });
  assert.equal(control.hidden, true);
});

test("updates only mount in explicit slots, never a sidebar footer", async (t) => {
  const ui = await fixture(t, '<aside><footer>Settings</footer></aside>', {
    phase: "downloaded", version: "0.2.0",
  });
  assert.equal(ui.document.querySelector("#plasmic-desktop-update"), null);
  const slot = ui.document.createElement("span");
  slot.dataset.desktopUpdateSlot = "header";
  ui.document.body.append(slot);
  await flush();
  const control = ui.document.getElementById("plasmic-desktop-update");
  assert.equal(control.parentElement, slot);
  assert.equal(control.hidden, false);
  slot.remove();
  await flush();
  ui.send({ phase: "downloading", version: "0.2.0", percent: 72 });
  assert.equal(ui.document.querySelector("#plasmic-desktop-update"), null);
  assert.equal(ui.document.querySelector("aside > footer").textContent, "Settings");
});
