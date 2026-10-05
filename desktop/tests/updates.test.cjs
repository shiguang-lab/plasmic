const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const YAML = require("yaml");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { UpdateManager } = require("../src/update-manager.cjs");
const { MacUpdater, parseManifest, acknowledgeMacUpdate } = require("../src/mac-updater.cjs");
const feed = "https://updates.example/desktop-updates/darwin/arm64/";
const bytes = Buffer.from("a complete update archive");
const manifest = { version: "0.0.2", files: [{ url: "Plasmic-0.0.2-mac-arm64.zip", size: bytes.length, sha512: createHash("sha512").update(bytes).digest("base64") }] };
function manager(updater, beforeInstall = async () => {}) {
  return new UpdateManager({ updater, version: "0.0.1", enabled: true, beforeInstall });
}
test("manual download and install preserve the save-before-quit ordering, without automatic install on quit", async () => {
  const updater = new EventEmitter();
  const order = [];
  updater.checkForUpdates = async () => { updater.emit("checking-for-update"); updater.emit("update-available", manifest); };
  updater.downloadUpdate = async () => { updater.emit("download-progress", { percent: 45.3 }); updater.emit("update-downloaded", manifest); };
  updater.quitAndInstall = async () => order.push("install");
  const updates = manager(updater, async () => order.push("save"));
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal((await updates.command("install")).phase, "idle");
  assert.equal((await updates.command("check")).phase, "available");
  assert.equal((await updates.command("download")).phase, "downloaded");
  assert.equal((await updates.command("check")).phase, "downloaded");
  assert.deepEqual(order, []);
  await updates.command("install");
  assert.deepEqual(order, ["save", "install"]);
});
test("failed save blocks installation and supports retry without another download", async () => {
  const updater = new EventEmitter();
  let installs = 0, saves = 0;
  updater.quitAndInstall = () => installs++;
  const updates = manager(updater, async () => { if (++saves === 1) throw new Error("Save failed"); });
  updater.emit("update-downloaded", manifest);
  assert.equal((await updates.command("install")).retry, "install");
  assert.equal(installs, 0);
  await updates.command("install");
  assert.equal(installs, 1);
});
test("overlapping checks share one request; failed downloads retry the same version", async () => {
  const updater = new EventEmitter();
  let resolve, checks = 0, downloads = 0;
  updater.checkForUpdates = () => { checks++; return new Promise((done) => { resolve = done; }); };
  updater.downloadUpdate = async () => { if (++downloads === 1) throw new Error("Network offline"); updater.emit("update-downloaded", manifest); };
  const updates = manager(updater);
  const first = updates.command("check"), second = updates.command("check");
  assert.equal(checks, 1);
  updater.emit("update-available", manifest);
  resolve();
  await Promise.all([first, second]);
  assert.equal((await updates.command("download")).retry, "download");
  assert.equal((await updates.command("download")).phase, "downloaded");
});
test("stable version comparison rejects downgrade, prerelease, traversal and cross-origin artifacts", () => {
  assert.equal(parseManifest(YAML.stringify(manifest), "0.0.2", feed), null);
  assert.equal(parseManifest(YAML.stringify(manifest), "0.0.10", feed), null);
  assert.equal(parseManifest(YAML.stringify({ ...manifest, version: "0.0.10" }), "0.0.9", feed).version, "0.0.10");
  for (const url of ["../update.zip", "https://other.example/update.zip", "dir/update.zip"]) {
    assert.throws(() => parseManifest(YAML.stringify({ ...manifest, files: [{ ...manifest.files[0], url }] }), "0.0.1", feed), /artifact/);
  }
  assert.throws(() => parseManifest(YAML.stringify({ ...manifest, version: "0.0.3-beta.1" }), "0.0.1", feed), /stable/);
});
test("macOS downloads verify complete bytes and SHA-512 before reporting ready; failed downloads remove partial files", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-updates-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let corrupt = false, downloaded = 0;
  const updater = new MacUpdater({ app: { getPath: () => root, getVersion: () => "0.0.1" }, feedUrl: feed, fetch: async (url) => url.endsWith(".yml") ? new Response(YAML.stringify(manifest)) : new Response(corrupt ? Buffer.from("bad") : bytes) });
  updater.on("update-downloaded", () => downloaded++);
  await updater.checkForUpdates();
  const [file] = await updater.downloadUpdate();
  assert.deepEqual(await fs.readFile(file), bytes);
  assert.equal(downloaded, 1);
  corrupt = true;
  await assert.rejects(updater.downloadUpdate(), /checksum/);
  assert.equal(downloaded, 1);
  await assert.rejects(fs.stat(file + ".partial"), { code: "ENOENT" });
  const malicious = new MacUpdater({ app: { getPath: () => root, getVersion: () => "0.0.1" }, feedUrl: feed, fetch: async () => new Response(bytes, { status: 503 }) });
  await assert.rejects(malicious.checkForUpdates(), /503/);
});
test("only the expected installed version and bundle acknowledge an update", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-update-receipt-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "updates"));
  const id = "eb954cc1-07c2-4b0b-85a0-5d00eedf12ae";
  const target = path.join(root, "Plasmic.app");
  const transaction = { id, version: "0.0.2", target };
  await fs.writeFile(path.join(root, "updates/mac-transaction.json"), JSON.stringify(transaction));
  const app = { getPath: () => root, getVersion: () => "0.0.1", getAppPath: () => path.join(target, "Contents/Resources/app.asar") };
  await acknowledgeMacUpdate(app);
  await assert.rejects(fs.stat(path.join(root, `updates/${id}.ready`)), { code: "ENOENT" });
  app.getVersion = () => "0.0.2";
  await fs.writeFile(path.join(root, "updates/Plasmic-0.0.2.zip"), "cached");
  await fs.mkdir(path.join(root, "updates/extract-fixture"));
  await fs.writeFile(path.join(root, "updates/extract-fixture/data"), "extracted");
  await acknowledgeMacUpdate(app);
  assert.equal(await fs.readFile(path.join(root, `updates/${id}.ready`), "utf8"), "ready");
  await assert.rejects(fs.stat(path.join(root, "updates/Plasmic-0.0.2.zip")), { code: "ENOENT" });
  await assert.rejects(fs.stat(path.join(root, "updates/extract-fixture")), { code: "ENOENT" });
});
test("development and unpacked launches keep updates disabled even after an updater error", async () => {
  const updater = new EventEmitter();
  updater.checkForUpdates = updater.downloadUpdate = updater.quitAndInstall = () => { throw new Error("Updater must not run"); };
  const updates = new UpdateManager({ updater, enabled: false, version: "0.0.1", beforeInstall: async () => { throw new Error("Must not install"); } });
  updater.emit("error", new Error("Prior install failed"));
  for (const command of ["check", "download", "install"]) assert.equal((await updates.command(command)).phase, "disabled");
});
test("installed clients check at startup and every four hours", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const updater = new EventEmitter();
  let checks = 0;
  updater.checkForUpdates = async () => { checks++; updater.emit("update-not-available"); };
  const updates = manager(updater);
  t.after(() => updates.stop());
  updates.start();
  t.mock.timers.tick(9999);
  assert.equal(checks, 0);
  t.mock.timers.tick(1);
  await updates.running;
  assert.equal(checks, 1);
  t.mock.timers.tick(4 * 60 * 60 * 1000 - 10000);
  await updates.running;
  assert.equal(checks, 2);
});
test("release validation refuses incomplete or modified artifacts before NAS upload", async (t) => {
  const { validateRelease } = await import("../scripts/release-artifacts.mjs");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-release-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "latest-mac.yml"), YAML.stringify(manifest));
  await fs.writeFile(path.join(root, manifest.files[0].url), bytes);
  assert.equal((await validateRelease(root, "darwin", "0.0.2")).files.length, 1);
  await fs.writeFile(path.join(root, manifest.files[0].url), "wrong bytes");
  await assert.rejects(validateRelease(root, "darwin", "0.0.2"), /checksum or size/);
  await assert.rejects(validateRelease(root, "darwin", "0.0.3"), /manifest version/);
});
test("macOS helper restores the previous bundle if the replacement cannot launch", { skip: process.platform !== "darwin" }, async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-update-rollback-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = path.join(root, "Plasmic.app"), staged = path.join(root, "staged.app"), backup = path.join(root, "backup.app");
  await fs.mkdir(target);
  await fs.mkdir(staged);
  await fs.writeFile(path.join(target, "old-version"), "retained");
  await assert.rejects(promisify(execFile)("/bin/sh", [path.resolve(__dirname, "../src/mac-update-install.sh"), "2147483647", target, staged, backup, path.join(root, "receipt"), path.join(root, "transaction"), path.join(root, "failure"), path.join(root, "log"), path.join(root, "pid")]));
  assert.equal(await fs.readFile(path.join(target, "old-version"), "utf8"), "retained");
  assert.match(await fs.readFile(path.join(root, "failure"), "utf8"), /previous version restored/);
  await assert.rejects(fs.stat(backup), { code: "ENOENT" });
});
test("NAS promotion keeps the existing manifest on corrupted uploads and rejects stale concurrent releases", async (t) => {
  const { promoteRelease } = require("../scripts/promote-release.cjs");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-promote-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const incoming = path.join(root, "incoming"), releases = path.join(root, "releases");
  await fs.mkdir(incoming);
  await fs.mkdir(releases);
  const live = path.join(releases, "latest-mac.yml");
  await fs.writeFile(live, "version: 0.0.1\n");
  await fs.writeFile(path.join(incoming, "latest-mac.yml"), YAML.stringify(manifest));
  await fs.writeFile(path.join(incoming, "._latest-mac.yml"), "macOS archive metadata");
  await fs.writeFile(path.join(incoming, manifest.files[0].url), "corrupt");
  await assert.rejects(promoteRelease(releases, incoming, "latest-mac.yml", manifest), /size mismatch/);
  assert.equal(await fs.readFile(live, "utf8"), "version: 0.0.1\n");
  await fs.writeFile(path.join(incoming, manifest.files[0].url), bytes);
  const results = await Promise.allSettled([
    promoteRelease(releases, incoming, "latest-mac.yml", manifest),
    promoteRelease(releases, incoming, "latest-mac.yml", manifest),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(YAML.parse(await fs.readFile(live, "utf8")).version, "0.0.2");
  assert.deepEqual(await fs.readFile(path.join(releases, manifest.files[0].url)), bytes);
  await assert.rejects(promoteRelease(releases, incoming, "latest-mac.yml", manifest), /must be newer/);
  assert.deepEqual((await fs.readdir(releases)).sort(), [manifest.files[0].url, "latest-mac.yml"].sort());
});
