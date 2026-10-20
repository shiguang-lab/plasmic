const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { spawn, execFileSync } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const { build, Platform, Arch } = require("electron-builder");
const { getCurrentFuseWire, FuseV1Options } = require("@electron/fuses");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { productionFuses } = require("../src/runtime-security.cjs");
const desktop = path.resolve(__dirname, "..");

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function isListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.setTimeout(500);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
  });
}

(async () => {
  assert.equal(process.platform, "darwin", "Packaged runtime acceptance requires macOS");
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-runtime-security-"));
  let child, client;
  try {
    const project = path.join(temporary, "project");
    const profile = path.join(temporary, "profile");
    await fs.mkdir(project);
    await fs.mkdir(profile);
    for (const file of ["runtime-security.cjs"]) {
      await fs.copyFile(path.join(desktop, "src", file), path.join(project, file));
    }
    await fs.writeFile(path.join(project, "package.json"), JSON.stringify({ name: "plasmic-runtime-security", version: "1.0.0", main: "fixture.cjs", description: "Owned runtime security fixture", author: "Shiguang" }));
    await fs.writeFile(path.join(project, "fixture.cjs"), `
      const { app, BrowserWindow } = require("electron");
      const fs = require("node:fs");
      const path = require("node:path");
      require("./runtime-security.cjs").configureProductionRuntime(app);
      if (process.argv.includes("--mcp")) {
        require(process.env.PLASMIC_SECURITY_SOURCE_ENTRY);
      } else {
        app.setPath("userData", process.env.PLASMIC_DESKTOP_PROFILE);
        let opened = false;
        app.whenReady().then(async () => {
          const window = new BrowserWindow({ show: false, webPreferences: { devTools: !app.isPackaged } });
          window.webContents.on("devtools-opened", () => { opened = true; });
          await window.loadURL("data:text/html,<main>Owned fixture</main>");
          window.webContents.openDevTools({ mode: "bottom", activate: false });
          await new Promise(resolve => setTimeout(resolve, 200));
          const productionOpened = window.webContents.isDevToolsOpened();
          window.destroy();
          const control = new BrowserWindow({ show: false, webPreferences: { devTools: true } });
          await control.loadURL("data:text/html,<main>Development control</main>");
          const controlOpened = new Promise(resolve => control.webContents.once("devtools-opened", () => resolve(true)));
          control.webContents.openDevTools({ mode: "bottom", activate: false });
          await controlOpened;
          control.destroy();
          fs.writeFileSync(path.join(process.env.PLASMIC_DESKTOP_PROFILE, "result.json"), JSON.stringify({ isPackaged: app.isPackaged, productionOpened, opened, developmentOpened: true,
            debuggingSwitch: app.commandLine.hasSwitch("remote-debugging-port"),
            debuggingPipe: app.commandLine.hasSwitch("remote-debugging-pipe") }));
        }).catch(error => { console.error(error); app.exit(1); });
        app.on("window-all-closed", () => {});
      }
    `);
    const metadata = JSON.parse(await fs.readFile(path.join(desktop, "package.json"), "utf8"));
    await build({ projectDir: project, targets: Platform.MAC.createTarget(["dir"], Arch[process.arch]), publish: "never", config: {
      appId: "cn.publib.plasmic.runtime-security", productName: "Plasmic", electronVersion: metadata.devDependencies.electron,
      electronDist: path.join(desktop, "node_modules/electron/dist"), electronLanguages: ["en"],
      directories: { output: path.join(temporary, "out"), buildResources: path.join(desktop, "assets") },
      files: ["*.cjs", "package.json"], asar: true, npmRebuild: false,
      electronFuses: productionFuses,
      afterPack: (context) => {
        // Production's packaged dependency check runs before fuses and signing.
        execFileSync(path.join(context.appOutDir, "Plasmic.app/Contents/MacOS/Plasmic"), ["-e", "console.log('Pre-fuse package check passed')"], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, stdio: "inherit" });
      },
      mac: { identity: "-", hardenedRuntime: false, notarize: false },
    } });
    const bundle = path.join(temporary, `out/mac${process.arch === "arm64" ? "-arm64" : ""}/Plasmic.app`);
    const executable = path.join(bundle, "Contents/MacOS/Plasmic");
    const wire = await getCurrentFuseWire(bundle);
    for (const option of [FuseV1Options.RunAsNode, FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseV1Options.EnableNodeCliInspectArguments]) {
      assert.equal(wire[option], 48);
    }
    const injected = path.join(temporary, "node-options-injected");
    const evaluated = path.join(temporary, "node-eval-injected");
    const preload = path.join(temporary, "inject.cjs");
    await fs.writeFile(preload, `require("node:fs").writeFileSync(${JSON.stringify(injected)}, "injected")`);
    const remotePort = await unusedPort();
    const inspectorPort = await unusedPort();
    child = spawn(executable, [`--remote-debugging-port=${remotePort}`, "--remote-debugging-pipe", "--auto-open-devtools-for-tabs", `--inspect=${inspectorPort}`, "-e", `require("node:fs").writeFileSync(${JSON.stringify(evaluated)}, "injected")`], {
      env: { ...process.env, PLASMIC_DESKTOP_PROFILE: profile, ELECTRON_RUN_AS_NODE: "1", NODE_OPTIONS: `--require=${preload}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", data => { output += data; });
    child.stderr.on("data", data => { output += data; });
    let result;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { result = JSON.parse(await fs.readFile(path.join(profile, "result.json"), "utf8")); break; }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      assert.equal(child.exitCode, null, output);
      await delay(100);
    }
    assert(result, output || "Packaged fixture did not finish");
    assert.deepEqual(result, { isPackaged: true, productionOpened: false, opened: false, developmentOpened: true, debuggingSwitch: false, debuggingPipe: false });
    assert.equal(await isListening(remotePort), false);
    assert.equal(await isListening(inspectorPort), false);
    await assert.rejects(fs.access(injected), { code: "ENOENT" });
    await assert.rejects(fs.access(evaluated), { code: "ENOENT" });
    child.kill();
    client = new Client({ name: "runtime-security-acceptance", version: "1.0.0" });
    await client.connect(new StdioClientTransport({ command: executable, args: ["--mcp"], env: {
      ...process.env, PLASMIC_DESKTOP_PROFILE: profile, PLASMIC_SECURITY_SOURCE_ENTRY: path.join(desktop, "src/entry.cjs"),
    }, stderr: "pipe" }));
    const listing = await client.listTools();
    assert(listing.tools.some(tool => tool.name === "open_design"));
    assert(listing.tools.some(tool => tool.name === "execute"));
    console.log("PASS: Packaged DevTools, remote debugging, Node inspector and environment injection disabled; MCP startup preserved");
  } finally {
    if (client) await client.close();
    if (child && child.exitCode === null) child.kill();
    await fs.rm(temporary, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
