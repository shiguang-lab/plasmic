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

test("the public MCP command replaces Electron with the bundled helper before GUI initialization",()=>{
  const calls=[],app={setActivationPolicy:()=>{},exit:()=>assert.fail("Unexpected startup failure")};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/entry.cjs"),"utf8"),{
    process:{argv:["--mcp"],platform:"darwin",env:{},execve:(command,args)=>{assert.equal(command,"/helper");assert.equal(args[0],command);calls.push("replace");}},
    require:name=>{
      if(name==="electron")return {app};
      if(name==="./runtime-security.cjs")return {configureProductionRuntime:()=>calls.push("restrict")};
      assert.equal(name,"./mcp-launch.cjs");return {mcpLaunch:()=>({command:"/helper",args:[]})};
    },
  });
  assert.deepEqual(calls,["restrict","replace"]);
});

test("the public Windows MCP command attaches inherited pipes to the native helper", () => {
  const child = new (require("node:events").EventEmitter)();
  const exits = [], app = { setActivationPolicy() {}, exit: code => exits.push(code) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/entry.cjs"), "utf8"), {
    process: { argv: ["--mcp"], platform: "win32", stderr: { write: () => {} } },
    require: name => {
      if (name === "electron") return { app };
      if (name === "./runtime-security.cjs") return { configureProductionRuntime() {} };
      if (name === "./mcp-launch.cjs") return { mcpLaunch: () => ({ command: "helper.exe", args: [] }) };
      assert.equal(name, "node:child_process");
      return { spawn: (command, args, options) => {
        assert.equal(command, "helper.exe"); assert.equal(args.length, 0);
        assert.equal(options.stdio, "inherit"); assert.equal(options.windowsHide, true); return child;
      } };
    },
  });
  child.emit("exit", 0);
  assert.deepEqual(exits, [0]);
});

test("the production View menu has no developer tools entry", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/main.cjs"), "utf8");
  const menu = source.match(/\{\s+label: t\("View"\),[\s\S]*?\n      \},/)[0];
  for (const isPackaged of [true, false]) {
    let toggled = 0;
    const view = vm.runInNewContext("(" + menu.slice(0, -1) + ")", {
      studioWindow: { webContents: { toggleDevTools: () => toggled++ } },
      app: { isPackaged }, t: (key) => key, process: { platform: "darwin" },
      MODES: ["window", "fullscreen", "island"], presentation: { mode: "window" },
      CLOSE_ACTIONS: ["ask", "island", "quit"],
    });
    const devtools = view.submenu.find((item) => item.id === "desktop-devtools");
    assert.equal(!!devtools, !isPackaged);
    devtools?.click();
    assert.equal(toggled, isPackaged ? 0 : 1);
  }
});
