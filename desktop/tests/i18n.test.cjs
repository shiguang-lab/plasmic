const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const { createDesktopI18n } = require("../src/i18n.cjs");
const { fileMenu } = require("../src/workspace.cjs");
const directory = path.resolve(
  __dirname,
  "../../platform/wab/src/wab/client/i18n",
);
// Packaging places the same resolver alongside these packs.
function i18n(systemLanguages) {
  const os = require("node:os");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-i18n-test-"));
  fs.cpSync(path.join(directory, "locales"), root, { recursive: true });
  fs.copyFileSync(
    path.join(directory, "locale-resolution.cjs"),
    path.join(root, "locale-resolution.cjs"),
  );
  const result = createDesktopI18n(root, systemLanguages);
  fs.rmSync(root, { recursive: true });
  return result;
}
test("native menus share system resolution and change captions without altering design commands", async () => {
  const locale = i18n(["fr-FR", "zh-Hant-HK"]);
  assert.equal(locale.snapshot().locale, "zh-TW");
  const calls = [];
  const state = { ready: true, editorContext: { canEdit: true } };
  const controller = {
    state: async () => state,
    dispatch: async (...args) => calls.push(args),
  };
  for (const language of ["en", "zh-CN", "zh-TW", "ja", "ko"]) {
    locale.setLocale(language);
    const menu = fileMenu({
      t: locale.t,
      state,
      controller,
      workspace: {
        recent: [{ name: "WorkspaceCard", url: "project-url" }],
        capture: async () => {},
      },
      dialog: {},
      refresh: () => {},
    });
    assert.equal(menu.label, locale.t("File"));
    assert.equal(menu.submenu[1].submenu[0].label, "WorkspaceCard");
    assert.equal(
      menu.submenu.find((item) => item.id === "desktop-save").label,
      locale.t("Save"),
    );
    await menu.submenu.find((item) => item.id === "desktop-save").click();
  }
  assert.deepEqual(
    calls,
    Array.from({ length: 5 }, () => ["execute", { name: "save", input: {} }]),
  );
  assert.throws(() => locale.setLocale("__proto__"), /Invalid UI language/);
  assert.equal(locale.t("__proto__"), "__proto__");
});
test("an open update dialog follows all five languages without changing status or invoking install", async (t) => {
  const locale = i18n(["en-US"]);
  const dom = new JSDOM("<html><body></body></html>", {
    runScripts: "outside-only",
  });
  t.after(() => dom.window.close());
  const commands = [];
  dom.window.desktopEnvironment = {
    getUiMessages: async () => locale.snapshot(),
    onUiLocale: (callback) =>
      locale.subscribe(() => callback(locale.snapshot())),
  };
  dom.window.desktopUpdates = {
    command: async (command) => {
      commands.push(command);
      return {
        phase: "downloaded",
        version: "0.0.39",
        currentVersion: "0.0.38",
      };
    },
    onStatus: () => {},
    onOpen: () => {},
  };
  for (const name of ["renderer-i18n.js", "update-dialog.js"])
    dom.window.eval(
      fs.readFileSync(path.join(__dirname, "../src", name), "utf8"),
    );
  await new Promise((resolve) => setImmediate(resolve));
  const root = dom.window.document.getElementById(
    "plasmic-desktop-update-dialog",
  ).shadowRoot;
  for (const language of ["en", "zh-CN", "zh-TW", "ja", "ko"]) {
    locale.setLocale(language);
    assert.equal(dom.window.document.documentElement.lang, language);
    assert.equal(
      root.getElementById("status").textContent,
      locale.t("Ready to install"),
    );
    assert.equal(
      root.getElementById("primary").textContent,
      locale.t("Restart and Install"),
    );
    assert.equal(
      root.querySelector("dt").textContent,
      locale.t("Installed version"),
    );
    assert.equal(root.getElementById("latest-version").textContent, "0.0.39");
  }
  assert.deepEqual(commands, ["status"]);
});
test("desktop preload restores the existing Studio preference and follows system when unset", async () => {
  const vm = require("node:vm");
  const calls = [];
  let stored = "ko";
  const exposed = {};
  const window = {
    localStorage: {
      getItem: (key) => {
        assert.equal(key, "shiguang.ui.language");
        return stored;
      },
    },
    addEventListener: () => {},
  };
  window.top = window;
  const ipcRenderer = {
    invoke: async (...args) => {
      calls.push(args);
    },
    on: () => {},
    removeListener: () => {},
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, "../src/preload.cjs"), "utf8"),
    {
      window,
      navigator: { languages: ["en-US"] },
      location: { pathname: "/", origin: "https://studio.test" },
      process: { argv: ['--shiguang-system-languages=["ja-JP"]'] },
      require: () => ({
        ipcRenderer,
        contextBridge: {
          exposeInMainWorld: (name, api) => {
            exposed[name] = api;
          },
        },
      }),
    },
  );
  await exposed.desktopEnvironment.getUiMessages();
  assert.deepEqual(calls.pop(), ["desktop:ui-locale", "ko"]);
  assert.equal(exposed.desktopEnvironment.systemLanguages[0], "ja-JP");
  for (const preference of [null, "system", "unsupported"]) {
    stored = preference;
    await exposed.desktopEnvironment.getUiMessages();
    assert.deepEqual(calls.pop(), ["desktop:ui-locale", undefined]);
  }
  await exposed.desktopEnvironment.setUiLocale("zh-CN");
  assert.deepEqual(calls.pop(), ["desktop:ui-locale", "zh-CN"]);
});
test("every explicit native menu caption has a shared language-pack key", () => {
  const pack = JSON.parse(
    fs.readFileSync(path.join(directory, "locales/en.json"), "utf8"),
  );
  for (const name of ["main.cjs", "workspace.cjs"]) {
    const source = fs.readFileSync(
      path.join(__dirname, "../src", name),
      "utf8",
    );
    const labels = [...source.matchAll(/label:\s*t\(\s*"([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.ok(labels.length > 0);
    for (const label of labels) assert.ok(Object.hasOwn(pack, label), label);
  }
});
