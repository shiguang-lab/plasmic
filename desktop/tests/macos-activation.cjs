// Check the installed bundle's pre-JavaScript identity and real MCP startup.
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { setTimeout: delay } = require("node:timers/promises");

(async () => {
  assert.equal(process.platform, "darwin");
  const bundle = process.env.PLASMIC_APP_PATH || "/Applications/Plasmic.app";
  const agent = execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :LSUIElement", path.join(bundle, "Contents/Info.plist")], { encoding: "utf8" }).trim();
  assert.equal(agent, "true", "The bundle must start without a regular Dock identity before JS executes");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-activation-"));
  const events = [], transports = [];
  let watcher;
  try {
    const executable = path.join(temporary, "watch");
    execFileSync("/usr/bin/swiftc", [path.join(__dirname, "macos-activation.swift"), "-o", executable]);
    watcher = spawn(executable, [bundle], { stdio: ["ignore", "pipe", "inherit"] });
    let buffer = "";
    watcher.stdout.setEncoding("utf8");
    const ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Activation observer did not start")), 10000);
      watcher.once("error", reject);
      watcher.stdout.on("data", (chunk) => {
        buffer += chunk;
        while (buffer.includes("\n")) {
          const index = buffer.indexOf("\n"), line = buffer.slice(0, index);
          buffer = buffer.slice(index + 1);
          if (line === "ready") { clearTimeout(timer); resolve(); }
          else events.push(JSON.parse(line));
        }
      });
    });
    await ready;
    await delay(100);
    const baseline = events.at(-1)?.apps.filter((app) => app.policy === 0) || [];
    assert.equal(baseline.length, 1, "Start one regular GUI instance before this test");
    async function runTransport(method, params) {
      const child = spawn(path.join(bundle, "Contents/MacOS/Plasmic"), ["--mcp"], { stdio: ["pipe", "pipe", "pipe"] });
      let text = "", stderr = "";
      child.stderr.on("data", (data) => { stderr += data; });
      try {
        const response = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("MCP startup timed out: " + stderr)), 10000);
          child.once("error", reject);
          child.stdout.on("data", (data) => {
            text += data;
            if (text.includes("\n")) { clearTimeout(timer); resolve(JSON.parse(text.slice(0, text.indexOf("\n")))); }
          });
          child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) + "\n");
        });
        transports.push({ pid: child.pid, method, response });
        await delay(300);
        const exited = new Promise((resolve, reject) => {
          const timer = setTimeout(() => { child.kill(); reject(new Error("MCP did not exit on stdin close")); }, 5000);
          child.once("exit", (code) => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error("MCP exit code: " + code)); });
        });
        child.stdin.end();
        await exited;
        return response;
      } finally { if (child.exitCode === null) child.kill(); }
    }
    const probe = await runTransport("server/discover", {});
    assert.equal(probe.error?.code, -32601);
    const initialized = await runTransport("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "activation-test", version: "1" } });
    assert.equal(initialized.result?.serverInfo.name, "plasmic-desktop");
    await delay(100);
    const regular = new Set(baseline.map((app) => app.pid));
    for (const event of events) {
      assert.deepEqual(event.apps.filter((app) => app.policy === 0).map((app) => app.pid), [...regular], "A transport appeared as a second regular Dock app");
    }
    const report = { passed: true, LSUIElement: true, baselineGui: [...regular], transports, events, samplingMs: 5 };
    if (process.env.PLASMIC_REPORT_DIR) {
      await fs.mkdir(process.env.PLASMIC_REPORT_DIR, { recursive: true });
      await fs.writeFile(path.join(process.env.PLASMIC_REPORT_DIR, "macos-activation.json"), JSON.stringify(report, null, 2));
    }
    console.log(JSON.stringify({ passed: true, regularApps: regular.size, transportCount: transports.length, observations: events.length }));
  } finally {
    watcher?.kill();
    await fs.rm(temporary, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
