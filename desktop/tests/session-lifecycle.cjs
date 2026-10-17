// Two differently signed packaged versions exercise the production updater and
// credential/session modules. IAM responses are owned local fixtures.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { execFileSync, spawn } = require("node:child_process");
const { once } = require("node:events");
const { setTimeout: delay } = require("node:timers/promises");
const { build, Platform, Arch } = require("electron-builder");
const { getCurrentFuseWire, FuseV1Options } = require("@electron/fuses");
const desktop = path.resolve(__dirname, "..");
const reports = path.join(desktop, "desktop-report/session-lifecycle");
const report = { status: "RUNNING", architecture: process.arch, phases: {} };
let temporary;
async function runPhase(app, profile, phase) {
  await fs.writeFile(path.join(profile, "control.json"), JSON.stringify({ phase }));
  const child = spawn(path.join(app, "Contents/MacOS/Plasmic"), [], {
    env: { ...process.env, PLASMIC_DESKTOP_PROFILE: profile }, stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", data => { output += data; });
  child.stderr.on("data", data => { output += data; });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 35000);
  try {
    const [code] = await once(child, "exit");
    await fs.writeFile(path.join(reports, `${phase}.log`), output);
    assert.equal(code, 0, `Phase ${phase} failed; see ${phase}.log`);
    const result = JSON.parse(await fs.readFile(path.join(profile, `${phase}.json`), "utf8"));
    assert.equal(result.status, "PASS", result.error);
    report.phases[phase] = result;
    console.log(`PASS: ${phase}`);
  } finally { clearTimeout(timeout); }
}
(async () => {
  assert.equal(process.platform, "darwin", "Packaged upgrade acceptance requires macOS");
  const { macSigningCertificate, verifyMacSignature } = await import("../scripts/local-signing.mjs");
  if (process.env.GITHUB_ACTIONS === "true") assert.equal(macSigningCertificate(), undefined);
  await fs.mkdir(reports, { recursive: true });
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-session-lifecycle-"));
  const metadata = JSON.parse(await fs.readFile(path.join(desktop, "package.json"), "utf8"));
  const apps = [];
  const hashes = [];
  for (const version of ["1.0.1", "1.0.2"]) {
    const project = path.join(temporary, version);
    await fs.mkdir(path.join(project, "src"), { recursive: true });
    for (const file of ["device-credentials.cjs", "unified-login.cjs", "ui-error.cjs", "session-ticket.cjs", "mac-updater.cjs", "update-architecture.cjs", "mac-update-install.sh"]) {
      await fs.copyFile(path.join(desktop, "src", file), path.join(project, "src", file));
    }
    for (const name of ["semver", "yaml"]) await fs.cp(path.join(desktop, "node_modules", name), path.join(project, "node_modules", name), { recursive: true });
    await fs.copyFile(path.join(__dirname, "session-lifecycle-phase.cjs"), path.join(project, "session-lifecycle-phase.cjs"));
    await fs.writeFile(path.join(project, "package.json"), JSON.stringify({ name: "plasmic-session-lifecycle", version,
      main: "session-lifecycle-phase.cjs", description: "Owned session lifecycle acceptance fixture", author: "Shiguang",
      dependencies: { semver: metadata.dependencies.semver, yaml: metadata.dependencies.yaml } }));
    await build({ projectDir: project, targets: Platform.MAC.createTarget(["dir"], Arch[process.arch]), publish: "never",
      config: { appId: "cn.publib.plasmic.desktop", productName: "Plasmic", electronVersion: metadata.devDependencies.electron,
        electronDist: path.join(desktop, "node_modules/electron/dist"), electronLanguages: ["en"],
        directories: { output: path.join(project, "out"), buildResources: path.join(desktop, "assets") },
        files: ["src/**/*", "session-lifecycle-phase.cjs", "package.json"], asar: true, npmRebuild: false, forceCodeSigning: true,
        electronFuses: { enableCookieEncryption: false },
        // Different code hashes exercise persistence without a stable Keychain identity.
        mac: { identity: "-", hardenedRuntime: false, notarize: false },
      } });
    const app = path.join(project, `out/mac${process.arch === "arm64" ? "-arm64" : ""}/Plasmic.app`);
    const wire = await getCurrentFuseWire(app);
    assert.equal(wire[FuseV1Options.EnableCookieEncryption], 48, "Cookie encryption must be disabled");
    verifyMacSignature(app);
    const signature = require("node:child_process").spawnSync("/usr/bin/codesign", ["-dv", "--verbose=4", app], { encoding: "utf8" });
    hashes.push(signature.stderr.match(/^CDHash=(.+)$/m)?.[1]);
    apps.push(app);
  }
  assert(hashes.every(Boolean));
  assert.notEqual(hashes[0], hashes[1]);
  report.distinctCodeHashes = true;
  report.cookieEncryption = false;
  const profile = path.join(temporary, "profile");
  const target = path.join(temporary, "installed/Plasmic.app");
  await fs.mkdir(profile);
  await fs.writeFile(path.join(profile, "device-credentials"), "legacy-ciphertext-unreadable-without-keychain");
  await fs.mkdir(path.dirname(target));
  execFileSync("/usr/bin/ditto", [apps[0], target]);
  execFileSync("/usr/bin/ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", apps[1], path.join(profile, "upgrade.zip")]);
  for (const phase of ["first_install", "login", "startup", "upgrade"]) await runPhase(target, profile, phase);
  const deadline = Date.now() + 110000;
  let upgraded;
  while (Date.now() < deadline) {
    try {
      upgraded = JSON.parse(await fs.readFile(path.join(profile, "upgraded_startup.json"), "utf8"));
      if (upgraded.status === "FAIL") throw new Error(upgraded.error);
      await fs.access(path.join(profile, "updates/mac-transaction.json"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (upgraded) break;
    }
    await delay(500);
  }
  assert.equal(upgraded?.status, "PASS", "Updated app did not complete startup");
  assert.equal(upgraded.version, "1.0.2");
  report.phases.upgraded_startup = upgraded;
  await runPhase(target, profile, "sign_out");
  assert.deepEqual((await fs.readdir(path.dirname(target))).filter(name => name.startsWith(".Plasmic-")), []);
  report.status = "PASS";
  console.log("PASS: installed and restarted a different code hash with login preserved, then signed out");
})().catch(error => { report.status = "FAIL"; report.error = error.message; console.error(error); })
  .finally(async () => {
    await fs.mkdir(reports, { recursive: true });
    await fs.writeFile(path.join(reports, "report.json"), JSON.stringify(report, null, 2) + "\n");
    if (report.status === "PASS" && temporary) await fs.rm(temporary, { recursive: true, force: true });
    else if (temporary) console.error(`Evidence retained in ${temporary}`);
    // electron-builder has exit cleanup handlers; keep failure explicit for CI.
    process.exit(report.status === "PASS" ? 0 : 1);
  });
