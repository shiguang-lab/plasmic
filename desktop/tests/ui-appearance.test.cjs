const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { createDesktopAppearance } = require("../src/ui-appearance.cjs");
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("shares a resolved appearance without persisting a second preference", () => {
  const appearance = createDesktopAppearance();
  const seen = [];
  const stop = appearance.subscribe((value) => seen.push(value));
  assert.equal(appearance.snapshot(), "dark");
  appearance.set("light");
  appearance.set("light");
  assert.deepEqual(seen, ["light"]);
  assert.throws(() => appearance.set("system"), /Invalid UI appearance/);
  assert.equal(appearance.snapshot(), "light");
  stop();
  appearance.set("dark");
  assert.deepEqual(seen, ["light"]);
});

test("native settings paint the initial appearance and ignore an older response after a live change", async (t) => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  let send, resolve;
  dom.window.mcpSettings = {
    initialUiAppearance: "light",
    onUiAppearance(callback) {
      send = callback;
    },
    getUiAppearance() {
      return new Promise((callback) => {
        resolve = callback;
      });
    },
  };
  dom.window.eval(
    fs.readFileSync(
      path.join(__dirname, "../src/renderer-appearance.js"),
      "utf8",
    ),
  );
  assert.equal(
    dom.window.document.documentElement.dataset.uiAppearance,
    "light",
  );
  send("dark");
  resolve("light");
  await flush();
  assert.equal(
    dom.window.document.documentElement.dataset.uiAppearance,
    "dark",
  );
  send("invalid");
  assert.equal(
    dom.window.document.documentElement.dataset.uiAppearance,
    "dark",
  );
});

test("MCP loading survives locale updates, recovers through Retry and restores focus after toggling", async (t) => {
  const html = fs.readFileSync(
    path.join(__dirname, "../src/mcp-settings.html"),
    "utf8",
  );
  const dom = new JSDOM(html, { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  let localeChanged, rejectFirst;
  let requests = 0;
  let toggles = 0;
  let translated = false;
  dom.window.desktopUiI18n = {
    t: (key) => (translated && key === "Retry" ? "重试" : key),
    subscribe: (callback) => {
      localeChanged = callback;
    },
  };
  dom.window.mcpSettings = {
    get() {
      requests++;
      return requests === 1
        ? new Promise((_, reject) => {
            rejectFirst = reject;
          })
        : Promise.resolve({
            clients: [
              {
                id: "fixture",
                label: "Fixture client",
                path: "/fixture",
                enabled: false,
              },
            ],
          });
    },
    set: async () => {
      toggles++;
      return {
        clients: [
          {
            id: "fixture",
            label: "Fixture client",
            path: "/fixture",
            enabled: true,
          },
        ],
      };
    },
    close() {},
    copy: async () => {},
  };
  dom.window.eval(
    fs.readFileSync(
      path.join(__dirname, "../src/mcp-settings-renderer.js"),
      "utf8",
    ),
  );
  const clients = dom.window.document.getElementById("clients");
  assert.equal(clients.getAttribute("aria-busy"), "true");
  localeChanged();
  assert.match(clients.textContent, /Loading configuration/);
  rejectFirst(new Error("Offline"));
  await flush();
  assert.equal(clients.getAttribute("aria-busy"), "false");
  translated = true;
  localeChanged();
  assert.equal(clients.querySelector("button").textContent, "重试");
  clients.querySelector("button").click();
  await flush();
  assert.equal(requests, 2);
  const toggle = clients.querySelector('[role="switch"]');
  toggle.click();
  await flush();
  assert.equal(toggles, 1);
  assert.equal(
    dom.window.document.activeElement.getAttribute("aria-checked"),
    "true",
  );
});
