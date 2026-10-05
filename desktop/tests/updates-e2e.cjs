// Real NAS upgrade acceptance. Uses a copy of an older installed app and an
// isolated profile; leaves the ordinary app/profile untouched.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const net = require("node:net");
const { spawn, execFileSync } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const { createWriteStream } = require("node:fs");
const { requestRpc } = require("../src/local-rpc.cjs");
const { chromium } = require(require.resolve("playwright", { paths: [path.resolve(__dirname, "../../platform/wab")] }));
const [source, expectedVersion] = process.argv.slice(2);
if (process.platform !== "darwin" || !source || !expectedVersion) throw new Error("Usage: node tests/updates-e2e.cjs /absolute/old/Plasmic.app new-version");
const reportDir = process.env.PLASMIC_REPORT_DIR || path.resolve("desktop-report/updates");
const target = path.join(reportDir, "installed/Plasmic.app");
const profile = path.join(reportDir, "profile");
const report = { status: "RUNNING", expectedVersion };
let browser, child;
async function until(predicate, timeout = 120000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { const value = await predicate(); if (value) return value; } catch {}
    await delay(500);
  }
  throw new Error("Update acceptance timed out");
}
async function activateUpdate(page, command) {
  for (const frame of page.frames()) {
    const button = frame.locator(".update-action").first();
    if (await button.isVisible()) {
      await button.click();
      return;
    }
  }
  // Login has no sidebar; exercise the same main-frame update command.
  await page.evaluate((action) => { void window.desktopUpdates.command(action); }, command);
}
(async () => {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.mkdir(profile, { recursive: true });
  execFileSync("/usr/bin/ditto", [path.resolve(source), target]);
  const port = await new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
  const log = createWriteStream(path.join(reportDir, "runtime.log"));
  child = spawn(path.join(target, "Contents/MacOS/Plasmic"), [`--remote-debugging-port=${port}`], { env: { ...process.env, PLASMIC_DESKTOP_PROFILE: profile }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  await until(async () => (await fetch(`http://127.0.0.1:${port}/json/version`)).ok);
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const page = await until(() => browser.contexts()[0].pages().find((page) => page.url().startsWith("https://plasmic.studio.publib.cn")));
  await page.waitForFunction(() => !!window.desktopUpdates, undefined, { timeout: 120000 });
  const before = await page.evaluate(() => window.desktopUpdates.command("status"));
  report.before = before.currentVersion;
  assert.notEqual(before.currentVersion, expectedVersion);
  await page.waitForFunction(async () => ["available", "error"].includes((await window.desktopUpdates.command("status")).phase), undefined, { timeout: 45000, polling: 1000 });
  const available = await page.evaluate(() => window.desktopUpdates.command("status"));
  assert.equal(available.phase, "available", available.error);
  assert.equal(available.version, expectedVersion);
  report.nasDetection = true;
  report.startupDetection = true;
  console.log(`Detected NAS version ${available.version} from installed ${before.currentVersion}`);
  await activateUpdate(page, "download");
  await page.waitForFunction(async () => ["downloaded", "error"].includes((await window.desktopUpdates.command("status")).phase), undefined, { timeout: 25 * 60 * 1000, polling: 1000 });
  const downloaded = await page.evaluate(() => window.desktopUpdates.command("status"));
  assert.equal(downloaded.phase, "downloaded", downloaded.error);
  report.downloadVerified = true;
  console.log("NAS download completed and verified; installing");
  await page.screenshot({ path: path.join(reportDir, "downloaded.png") });
  await activateUpdate(page, "install");
  const after = await until(async () => {
    if (browser.isConnected() && !page.isClosed()) {
      const status = await page.evaluate(() => window.desktopUpdates.command("status"));
      if (status.phase === "error") return { error: status.error };
    }
    const state = await requestRpc(profile, "get_app_state");
    return state.version === expectedVersion && state.windowOpen && state;
  }, 180000);
  assert(!after.error, after.error);
  report.after = after.version;
  await until(async () => {
    try { await fs.stat(path.join(profile, "updates/mac-transaction.json")); return false; }
    catch (error) { return error.code === "ENOENT"; }
  });
  assert.equal((await fs.readdir(path.dirname(target))).filter((name) => name.startsWith(".Plasmic-backup-")).length, 0);
  assert.equal((await fs.readdir(path.join(profile, "updates"))).filter((name) => name.endsWith(".zip") || name.startsWith("extract-")).length, 0);
  report.restarted = report.oldBundleCleaned = true;
  report.cacheCleaned = true;
  report.status = "PASS";
  console.log(JSON.stringify(report));
})().catch((error) => { report.status = "FAIL"; report.error = error.message; console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close().catch(() => {});
  if (child && child.exitCode === null) child.kill();
  const executable = path.join(target, "Contents/MacOS/Plasmic");
  for (const line of execFileSync("ps", ["-axo", "pid=,comm="], { encoding: "utf8" }).split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (match?.[2] === executable) { try { process.kill(Number(match[1]), "SIGTERM"); } catch {} }
  }
  await fs.mkdir(reportDir, { recursive: true });
  await fs.writeFile(path.join(reportDir, "report.json"), JSON.stringify(report, null, 2));
});
