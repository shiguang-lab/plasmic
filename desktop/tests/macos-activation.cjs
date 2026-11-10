// Signed isolated bundle: keep MCP STDIO open while exercising LaunchServices,
// production GUI close handlers, and Electron's real relaunch.
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const { build, Platform, Arch } = require("electron-builder");
const { productionFuses } = require("../src/runtime-security.cjs");
const { requestRpc } = require("../src/local-rpc.cjs");
const desktop = path.resolve(__dirname, "..");
const children = new Set(), events = [], cases = [];
let bundle, profile;
async function until(check, label) {
  const end = Date.now() + 15000;
  while (Date.now() < end) { if (await check()) return; await delay(30); }
  throw new Error("Timed out: " + label);
}
function launch(command, args, env = process.env) {
  const child = spawn(command, args, { env, stdio: ["pipe", "pipe", "pipe"] });
  children.add(child);
  child.output = "";
  child.stdout.on("data", data => { child.output += data; });
  child.stderr.on("data", data => { child.output += data; });
  child.exited = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", code => { children.delete(child); resolve(code); });
  });
  return child;
}
function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
}
async function request(client, method, params) {
  const id = ++client.requestId;
  client.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  let response;
  await until(() => client.output.split("\n").some(line => {
    try { const value = JSON.parse(line); if (value.id === id) { response = value; return true; } } catch {}
    return false;
  }), "MCP response: " + client.output);
  return response;
}
async function transport(command, args) {
  const client = launch(command, args, { ...process.env, PLASMIC_DESKTOP_PROFILE: profile });
  client.requestId = 0;
  const response = await request(client, "initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "activation-test", version: "1" } });
  assert.equal(response.result?.serverInfo.name, "plasmic-desktop", client.output);
  client.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  return client;
}
async function gui(previousPid) {
  let pid;
  await until(async () => {
    try {
      pid = JSON.parse(await fs.readFile(path.join(profile, "gui.json"), "utf8")).pid;
      if (pid === previousPid || !alive(pid)) return false;
      const ready = (await fs.readFile(path.join(profile, "logs/lifecycle.log"), "utf8")).trim().split("\n").map(JSON.parse)
        .some(row => row.pid === pid && row.event === "startup.ready");
      if (!ready) return false;
      return (await requestRpc(profile, "get_app_state", {})).windowOpen;
    } catch { return false; }
  }, "GUI startup");
  await until(() => events.at(-1)?.apps.some(app => app.pid === pid && app.finished), "GUI launch completed");
  return pid;
}
function finderOpen(cold = false) {
  // Finder/Dock use LaunchServices reuse, NOT open -n's forced new instance.
  const args = cold ? ["--env", "PLASMIC_DESKTOP_PROFILE=" + profile] : [];
  execFileSync("/usr/bin/open", [...args, bundle], { encoding: "utf8", timeout: 10000 });
}
async function checkClients(clients, online) {
  for (const client of clients) {
    assert.equal(client.exitCode, null, "MCP survives GUI lifecycle");
    const response = await request(client, "tools/call", { name: "get_app_state", arguments: {} });
    assert.equal(response.result?.isError, !online, client.output);
  }
}
(async () => {
  assert.equal(process.platform, "darwin");
  const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-activation-")));
  try {
    profile = path.join(temporary, "profile");
    await fs.mkdir(profile);
    await fs.writeFile(path.join(profile, "presentation.json"), JSON.stringify({ mode: "window", closeAction: "quit" }));
    const project = path.join(temporary, "project");
    await fs.mkdir(path.join(project, "src"), { recursive: true });
    for (const name of ["entry.cjs", "runtime-security.cjs", "mcp-launch.cjs"]) await fs.copyFile(path.join(desktop, "src", name), path.join(project, "src", name));
    await fs.writeFile(path.join(project, "src/main.cjs"), `require(${JSON.stringify(path.join(__dirname, "mcp-lifecycle-host.cjs"))}); exports.bootstrap = () => {};`);
    const meta = require("../package.json");
    await fs.writeFile(path.join(project, "package.json"), JSON.stringify({ name: "plasmic-activation", version: meta.version, main: "src/entry.cjs", description: "Owned launch lifecycle fixture", author: "Shiguang" }));
    const { installMacLauncher } = await import("../scripts/mac-launcher.mjs");
    await build({ projectDir: project, targets: Platform.MAC.createTarget(["dir"], Arch[process.arch]), publish: "never", config: {
      appId: "cn.publib.plasmic.activation." + randomUUID(), productName: "Plasmic", electronVersion: meta.devDependencies.electron,
      electronDist: path.join(desktop, "node_modules/electron/dist"), electronLanguages: ["en"],
      directories: { output: path.join(temporary, "out"), buildResources: path.join(desktop, "assets") },
      files: ["src/**/*", "package.json"], asar: true, npmRebuild: false, electronFuses: productionFuses,
      extraResources: [{ from: path.join(desktop, "mcp-bin", `darwin-${process.arch}`, "plasmic-mcp"), to: "mcp/plasmic-mcp" }],
      afterPack: context => {
        bundle = path.join(context.appOutDir, "Plasmic.app");
        installMacLauncher(bundle, process.arch);
      },
      mac: { identity: "-", hardenedRuntime: false, notarize: false, extendInfo: { LSUIElement: true } },
    } });
    execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", bundle]);
    const minimum = execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :LSMinimumSystemVersion", path.join(bundle, "Contents/Info.plist")], { encoding: "utf8" }).trim();
    const macho = execFileSync("/usr/bin/otool", ["-l", path.join(bundle, "Contents/MacOS/Plasmic")], { encoding: "utf8" });
    assert.equal(macho.match(/\bminos\s+(\S+)/)?.[1], minimum, "Launcher retains Electron's minimum macOS version");
    const observer = path.join(temporary, "watch");
    execFileSync("/usr/bin/swiftc", [path.join(__dirname, "macos-activation.swift"), "-o", observer]);
    const watcher = launch(observer, [bundle]);
    let buffer = "";
    watcher.stdout.on("data", chunk => {
      buffer += chunk;
      while (buffer.includes("\n")) {
        const index = buffer.indexOf("\n"), line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        if (line !== "ready") events.push(JSON.parse(line));
      }
    });
    await until(() => events.length, "activation observer");
    const executable = path.join(bundle, "Contents/MacOS/Plasmic");
    const clients = [await transport(executable, ["--mcp"]), await transport(executable, ["--mcp"]),
      await transport(path.join(bundle, "Contents/Resources/mcp/plasmic-mcp"), [])];
    await delay(200);
    assert(events.every(event => event.apps.length === 0), "MCP must never register as an application, even without a Dock icon");
    const probe = await request(clients[0], "server/discover", {});
    assert.equal(probe.error?.code, -32601);
    await checkClients(clients, false);
    finderOpen(true);
    let pid = await gui();
    await checkClients(clients, true);
    for (const kind of ["close", "quit", "restart"]) {
      finderOpen();
      assert.equal(await gui(), pid, "Finder reuses the existing GUI");
      if (kind === "quit") await fs.writeFile(path.join(profile, "quit"), "");
      else await fs.writeFile(path.join(profile, "command"), kind);
      await until(() => !alive(pid), kind + " exits the old GUI");
      const previous = pid;
      if (kind !== "restart") {
        await checkClients(clients, false);
        await fs.rm(path.join(profile, "quit"), { force: true });
        finderOpen(true);
      }
      pid = await gui(previous);
      await checkClients(clients, true);
      finderOpen();
      assert.equal(await gui(), pid, "Finder reopens after " + kind);
      assert(events.every(event => event.apps.every(app => !clients.some(client => client.pid === app.pid))), "MCP cannot become a stale GUI instance");
      cases.push({ kind, finderReopen: true, clientsSurvived: clients.length });
    }
    const helper = path.join(bundle, "Contents/Resources/mcp/plasmic-mcp");
    await fs.rename(helper, helper + ".test");
    try {
      const missing = launch(executable, ["--mcp"]);
      await until(() => missing.exitCode !== null, "missing helper exits");
      assert.equal(missing.exitCode, 1);
      assert.match(missing.output, /Cannot start Plasmic MCP/);
    } finally { await fs.rename(helper + ".test", helper); }
    await fs.writeFile(path.join(profile, "quit"), "");
    await until(() => !alive(pid), "final GUI shutdown");
    for (const client of clients) client.stdin.end();
    await until(() => clients.every(client => client.exitCode !== null), "MCP exits on stdin EOF");
    for (const client of clients) assert.equal(client.exitCode, 0, client.output);
    const report = { passed: true, cases, transportsNeverRegistered: true, stdinEof: true, missingHelper: true };
    if (process.env.PLASMIC_REPORT_DIR) {
      await fs.mkdir(process.env.PLASMIC_REPORT_DIR, { recursive: true });
      await fs.writeFile(path.join(process.env.PLASMIC_REPORT_DIR, "macos-activation.json"), JSON.stringify({ ...report, events }, null, 2));
    }
    console.log(JSON.stringify(report));
  } finally {
    // The unique bundle/profile never controls the installed user App.
    if (profile) {
      await fs.writeFile(path.join(profile, "quit"), "").catch(() => {});
      let pid;
      try { pid = JSON.parse(await fs.readFile(path.join(profile, "gui.json"), "utf8")).pid; } catch {}
      if (pid && alive(pid)) {
        try { await until(() => !alive(pid), "fixture cleanup"); }
        catch { process.kill(pid, "SIGKILL"); }
      }
    }
    for (const child of children) child.kill("SIGKILL");
    await Promise.allSettled([...children].map(child => child.exited));
    await fs.rm(temporary, { recursive: true, force: true, maxRetries: 5 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
