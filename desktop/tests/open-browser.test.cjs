const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

function setup(platform) {
  const calls = [];
  let finish;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve("../src/open-browser.cjs"), "utf8"), {
    module,
    process: { platform },
    require(name) {
      if (name === "electron") return {
        app: { getApplicationInfoForProtocol: async () => ({ path: "/Applications/Google Chrome.app" }) },
        shell: { openExternal: async (...args) => { calls.push(args); } },
      };
      if (name === "node:child_process") return {
        execFile: (file, args, callback) => {
          calls.push([file, Array.from(args)]);
          finish = callback;
        },
      };
      return require(name);
    },
  });
  return { ...module.exports, calls, finish: (error) => finish(error) };
}

test("macOS targets the default browser and waits for LaunchServices handoff", async () => {
  const s = setup("darwin");
  const url = "https://studio.example/projects/p/preview-full?tab=one#page";
  let done = false;
  const pending = s.openBrowser(url).then(() => { done = true; });
  await new Promise(setImmediate);
  assert.deepEqual(s.calls, [["/usr/bin/open", ["-a", "/Applications/Google Chrome.app", url]]]);
  assert.equal(done, false);
  s.finish(null);
  await pending;
  assert.equal(done, true);
});

test("macOS propagates native launch failures", async () => {
  const s = setup("darwin");
  const pending = s.openBrowser("https://studio.example");
  await new Promise(setImmediate);
  s.finish(new Error("Launch failed"));
  await assert.rejects(pending, /Launch failed/);
});

test("other platforms await the default system browser", async () => {
  const s = setup("win32");
  await s.openBrowser("https://studio.example");
  assert.equal(s.calls[0][0], "https://studio.example");
  assert.equal(s.calls[0][1].activate, true);
});
