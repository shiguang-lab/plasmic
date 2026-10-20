const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { productionFuses, configureProductionRuntime } = require("../src/runtime-security.cjs");

test("packaged startup removes remote debugging and automatic DevTools switches", () => {
  const switches = new Map([
    ["remote-debugging-port", "9222"],
    ["remote-debugging-pipe", ""],
    ["remote-debugging-address", "0.0.0.0"],
    ["remote-allow-origins", "*"],
    ["auto-open-devtools-for-tabs", ""],
    ["proxy-server", "localhost:8080"],
  ]);
  configureProductionRuntime({ isPackaged: true, commandLine: { removeSwitch: (name) => switches.delete(name) } });
  assert.deepEqual([...switches], [["proxy-server", "localhost:8080"]]);
});

test("development retains its debugging switches", () => {
  configureProductionRuntime({ isPackaged: false, commandLine: { removeSwitch: () => assert.fail("Development debugging must remain available") } });
});

test("the packaged binary disables Node launch, environment injection and inspector startup", () => {
  assert.equal(productionFuses.runAsNode, false);
  assert.equal(productionFuses.enableNodeOptionsEnvironmentVariable, false);
  assert.equal(productionFuses.enableNodeCliInspectArguments, false);
});

test("the shipped entry applies production restrictions before importing the application", () => {
  const calls = [];
  const app = { isPackaged: true };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/entry.cjs"), "utf8"), {
    process: { argv: [] },
    require: (name) => {
      if (name === "electron") return { app };
      if (name === "./runtime-security.cjs") return { configureProductionRuntime: (actual) => { assert.equal(actual, app); calls.push("restrict"); } };
      assert.equal(name, "./main.cjs");
      calls.push("import");
      return { bootstrap: () => calls.push("bootstrap") };
    },
  });
  assert.deepEqual(calls, ["restrict", "import", "bootstrap"]);
});

test("MCP startup stays a background transport without importing the GUI and exits on stdin close", async () => {
  const calls = [], stdin = new (require("node:events").EventEmitter)();
  const app = { setActivationPolicy: (policy) => calls.push(policy), dock: { hide: () => calls.push("hide") },
    quit: () => calls.push("quit"), exit: () => assert.fail("Unexpected startup failure") };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/entry.cjs"), "utf8"), {
    process: { argv: ["--mcp"], env: { PLASMIC_DESKTOP_PROFILE: "/test-profile" }, stdin },
    require: (name) => {
      if (name === "electron") return { app };
      if (name === "./runtime-security.cjs") return { configureProductionRuntime: () => calls.push("restrict") };
      assert.equal(name, "./mcp.cjs");
      return { serveMcp: async (profile) => { assert.equal(profile, "/test-profile"); calls.push("serve"); return { close: () => calls.push("close") }; } };
    },
  });
  await Promise.resolve();
  stdin.emit("end");
  assert.deepEqual(calls, ["restrict", "prohibited", "hide", "serve", "close", "quit"]);
});

test("the production View menu has no developer tools entry", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/main.cjs"), "utf8");
  const menu = source.match(/\{\s+label: t\("View"\),[\s\S]*?\n      \},/)[0];
  for (const isPackaged of [true, false]) {
    const view = vm.runInNewContext("(" + menu.slice(0, -1) + ")", { app: { isPackaged }, t: (key) => key });
    assert.equal(view.submenu.some((item) => item.role === "toggleDevTools"), !isPackaged);
  }
});
