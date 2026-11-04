const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const { build, Platform, Arch } = require("electron-builder");
const { productionFuses } = require("../src/runtime-security.cjs");
const desktop = path.resolve(__dirname, "..");
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === "ESRCH") return false; throw error; } };
(async () => {
  assert.equal(process.platform, "darwin");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-background-packaged-"));
  const children = new Set();
  try {
    const project = path.join(root, "project"); await fs.mkdir(path.join(project, "src"), { recursive: true });
    for (const name of ["background-worker.cjs", "background-task.cjs", "drafts.cjs", "draft-files.cjs", "vector.cjs", "raster-vector.cjs"]) await fs.copyFile(path.join(desktop, "src", name), path.join(project, "src", name));
    await fs.copyFile(path.join(__dirname, "background-packaged-host.cjs"), path.join(project, "fixture.cjs"));
    const meta = require("../package.json"), dependencies = {};
    for (const name of ["paper", "pngjs", "imagetracerjs"]) {
      dependencies[name] = meta.dependencies[name];
      await fs.cp(path.join(desktop, "node_modules", name), path.join(project, "node_modules", name), { recursive: true });
    }
    await fs.writeFile(path.join(project, "package.json"), JSON.stringify({ name: "plasmic-background-fixture", version: "1.0.0", main: "fixture.cjs", description: "Owned worker acceptance", author: "Shiguang", dependencies }));
    let appOutDir;
    await build({ projectDir: project, targets: Platform.MAC.createTarget(["dir"], Arch[process.arch]), publish: "never", config: {
      appId: "cn.publib.plasmic.background.fixture", productName: "BackgroundFixture", electronVersion: meta.devDependencies.electron,
      electronDist: path.join(desktop, "node_modules/electron/dist"), electronLanguages: ["en"],
      directories: { output: path.join(root, "out") }, files: ["fixture.cjs", "src/**/*", "package.json"],
      asar: true, npmRebuild: false, electronFuses: productionFuses, mac: { identity: "-", hardenedRuntime: false, notarize: false },
      afterPack: context => { appOutDir = context.appOutDir; },
    } });
    const executable = path.join(appOutDir, "BackgroundFixture.app/Contents/MacOS/BackgroundFixture");
    const injected = path.join(root, "injected"), injection = path.join(root, "inject.cjs");
    await fs.writeFile(injection, `require('node:fs').writeFileSync(${JSON.stringify(injected)},'injected')`);
    for (const crash of [false, true]) {
      const profile = path.join(root, crash ? "crash" : "normal"); await fs.mkdir(profile);
      const child = spawn(executable, [], { stdio: "inherit", env: { ...process.env,
        PLASMIC_BACKGROUND_PROFILE: profile, PLASMIC_BACKGROUND_CRASH_PROBE: crash ? "1" : "0",
        NODE_OPTIONS: "--require=" + injection, ELECTRON_RUN_AS_NODE: "1" } });
      children.add(child);
      const exited = new Promise(resolve => child.once("exit", code => { children.delete(child); resolve(code); }));
      const timeout = setTimeout(() => child.kill("SIGKILL"), 30000);
      try {
        let receipt;
        for (let i = 0; i < 200; i++) {
          receipt = await fs.readFile(path.join(profile, crash ? "ready.json" : "result.json"), "utf8").then(JSON.parse, error => { if (error.code !== "ENOENT") throw error; });
          if (receipt) break;
          await delay(50);
        }
        assert.ok(receipt, "Packaged host must complete its actual task");
        if (crash) child.kill("SIGKILL");
        const code = await exited; if (!crash) assert.equal(code, 0);
        for (let i = 0; receipt.pids.some(alive) && i < 100; i++) await delay(50);
        assert.ok(receipt.pids.every(pid => !alive(pid)), "No background process survives owner exit or crash");
        await assert.rejects(fs.stat(injected), { code: "ENOENT" });
      } finally { clearTimeout(timeout); }
    }
    console.log("PASS: signed ASAR utility processes work with production fuses; normal exit and owner SIGKILL leave no child");
  } finally {
    for (const child of children) { const ended = new Promise(resolve => child.once("exit", resolve)); child.kill("SIGKILL"); await ended; }
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
