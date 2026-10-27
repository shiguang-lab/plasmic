const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const Module = require("node:module");
const { EventEmitter } = require("node:events");
const { randomBytes, createHash } = require("node:crypto");
const YAML = require("yaml");
const { CancellationToken, CancellationError, CURRENT_APP_INSTALLER_FILE_NAME } = require("builder-util-runtime");
const { DownloadedUpdateHelper } = require("electron-updater/out/DownloadedUpdateHelper");
const { buildBlockMap } = require("app-builder-lib/out/targets/blockmap/blockmap");
const { createNativeUpdater } = require("../src/native-updater.cjs");
const baseline = createHash("shake256", { outputLength: 2 * 1024 * 1024 }).update("native-update-baseline").digest();

async function fixture(t, platform) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `plasmic-${platform}-updates-`));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const extension = platform === "win32" ? ".exe" : ".AppImage";
  const state = { assets: new Map(), requests: [], interrupt: false, ignoreRange: false, sent: 0, signature: null, verified: 0 };
  const server = http.createServer((req, res) => {
    const name = path.basename(req.url), bytes = state.assets.get(name);
    if (!bytes) { res.writeHead(404); return res.end(); }
    assert.equal(req.headers["x-update-test"], "forwarded");
    if (name.endsWith(".blockmap")) return res.end(bytes);
    const range = req.headers.range;
    state.requests.push(range);
    let start = 0, end = bytes.length - 1;
    if (range && !state.ignoreRange) {
      const match = /^bytes=(\d+)-(\d+)$/.exec(range);
      start = Number(match[1]); end = Number(match[2]);
      res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${bytes.length}`, "Content-Length": end - start + 1 });
    } else res.writeHead(200, { "Content-Length": bytes.length });
    let body = bytes.subarray(start, end + 1);
    if (state.interrupt) {
      state.interrupt = false; body = body.subarray(0, Math.max(1, Math.floor(body.length / 2)));
      state.sent += body.length; res.write(body);
      if (state.cancel) setTimeout(() => state.token.cancel(), 15);
      setTimeout(() => res.destroy(), 30);
    } else { state.sent += body.length; res.end(body); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const feedUrl = `https://updates.test/${platform}/${process.arch}/`;
  const config = path.join(root, "app-update.yml");
  await fs.writeFile(config, YAML.stringify({ updaterCacheDirName: "fixture", publisherName: "Fixture Publisher" }));
  const installed = path.join(root, "installed.AppImage"), originalAppImage = process.env.APPIMAGE;
  if (platform === "linux") {
    process.env.APPIMAGE = installed;
    t.after(() => { if (originalAppImage === undefined) delete process.env.APPIMAGE; else process.env.APPIMAGE = originalAppImage; });
  }
  const cache = path.join(root, "profile/updates", platform, process.arch);
  function make(version) {
    const app = Object.assign(new EventEmitter(), { isPackaged: true, getVersion: () => version, getName: () => "Plasmic", getPath: () => path.join(root, "profile") });
    const load = Module._load;
    Module._load = function (id, ...args) { return id === "electron" ? { app } : load.call(this, id, ...args); };
    let updater;
    try { updater = createNativeUpdater({ platform, feedUrl }); }
    finally { Module._load = load; }
    updater.logger = null; updater.autoInstallOnAppQuit = false; updater.autoDownload = false;
    updater.updateConfigPath = config;
    updater.setFeedURL({ provider: "generic", url: feedUrl, useMultipleRangeRequest: false });
    updater.downloadedUpdateHelper = new DownloadedUpdateHelper(path.join(root, "sdk-cache"));
    Object.defineProperty(updater, "netSession", { value: { fetch: (url, options) => {
      assert.equal(options.bypassCustomProtocolHandlers, true);
      return fetch(`http://127.0.0.1:${server.address().port}${new URL(url).pathname}`, options);
    } } });
    updater.verifyUpdateCodeSignature = async () => { state.verified++; return state.signature; };
    updater.httpExecutor.download = async () => { throw new Error("The non-resumable SDK downloader must not be used"); };
    return updater;
  }
  async function release(version, payload) {
    const name = `Plasmic-${version}-${platform}-${process.arch}${extension}`, disk = path.join(root, name);
    await fs.writeFile(disk, payload);
    const embedded = platform === "linux" ? await buildBlockMap(disk, "deflate") : {};
    const bytes = await fs.readFile(disk);
    await buildBlockMap(disk, "gzip", disk + ".blockmap");
    assert.deepEqual(await fs.readFile(disk), bytes, "sidecar generation must preserve the AppImage's embedded metadata and original bytes");
    state.assets.clear(); // No previous releases or intermediate versions on the server.
    state.assets.set(name, bytes); state.assets.set(name + ".blockmap", await fs.readFile(disk + ".blockmap"));
    state.info = { version, files: [{ url: name, size: bytes.length, sha512: createHash("sha512").update(bytes).digest("base64"), ...embedded }] };
    state.requests = []; state.sent = 0;
    return bytes;
  }
  async function run(updater) {
    state.token = new CancellationToken();
    const fileInfo = { url: new URL(state.info.files[0].url, feedUrl), info: state.info.files[0] };
    return updater.doDownloadUpdate({
      updateInfoAndProvider: { info: state.info, provider: { resolveFiles: () => [fileInfo] } },
      requestHeaders: { "X-Update-Test": "forwarded" }, cancellationToken: state.token,
      disableDifferentialDownload: false, disableWebInstaller: true,
    });
  }
  return { root, state, make, release, run, installed, archive: (version) => path.join(cache, `Plasmic-${version}${extension}`) };
}

for (const platform of ["win32", "linux"]) {
  test(`${platform}: full downloads survive SDK cleanup and resume after restart`, async (t) => {
    const f = await fixture(t, platform), bytes = await f.release("1.0.0", randomBytes(128 * 1024));
    f.state.interrupt = true;
    let updater = f.make("0.9.0"), ready = 0;
    updater.on("update-downloaded", () => ready++);
    await assert.rejects(f.run(updater));
    assert.equal(ready, 0);
    const prefix = await fs.readFile(f.archive("1.0.0") + ".partial");
    assert(prefix.length > 0);
    assert.deepEqual(await fs.readdir(path.join(f.root, "sdk-cache/pending")), []);
    updater = f.make("0.9.0");
    const [pending] = await f.run(updater);
    assert.equal(f.state.requests[1], `bytes=${prefix.length}-${bytes.length - 1}`);
    assert.equal(f.state.sent, bytes.length);
    assert.deepEqual(await fs.readFile(pending), bytes);
    if (platform === "win32") assert.equal(f.state.verified, 1);
    else if (process.platform !== "win32") assert.equal((await fs.stat(pending)).mode & 0o777, 0o755);
  });

  test(`${platform}: version 1 upgrades directly to 10 using resumable differential ranges`, async (t) => {
    const f = await fixture(t, platform), old = baseline;
    await f.release("1.0.0", old); await f.run(f.make("0.9.0"));
    const bytes = await f.release("10.0.0", Buffer.concat([old.subarray(0, 256 * 1024), randomBytes(8192), old.subarray(256 * 1024)]));
    f.state.interrupt = true;
    await assert.rejects(f.run(f.make("1.0.0")));
    const prefix = await fs.readFile(f.archive("10.0.0") + ".partial");
    assert.deepEqual(prefix, bytes.subarray(0, prefix.length));
    const [pending] = await f.run(f.make("1.0.0"));
    assert(f.state.requests.every((range) => range));
    assert.equal(Number(/^bytes=(\d+)/.exec(f.state.requests[1])[1]), prefix.length);
    assert(f.state.sent < bytes.length / 3);
    assert.deepEqual(await fs.readFile(pending), bytes);
  });

  test(`${platform}: ignored Range responses fall back to one complete verified artifact`, async (t) => {
    const f = await fixture(t, platform), old = baseline;
    await f.release("1.0.0", old); await f.run(f.make("0.9.0"));
    const bytes = await f.release("10.0.0", Buffer.concat([old, randomBytes(8192)]));
    f.state.ignoreRange = true;
    const [pending] = await f.run(f.make("1.0.0"));
    assert(f.state.requests[0]); assert.equal(f.state.requests.at(-1), undefined);
    assert.deepEqual(await fs.readFile(pending), bytes);
  });

  test(`${platform}: cancellation retains partial data while emitting the SDK cancellation event`, async (t) => {
    const f = await fixture(t, platform);
    await f.release("1.0.0", randomBytes(128 * 1024));
    f.state.interrupt = true; f.state.cancel = true;
    const updater = f.make("0.9.0"); let cancelled = 0;
    updater.on("update-cancelled", () => cancelled++);
    await assert.rejects(f.run(updater), CancellationError);
    assert.equal(cancelled, 1);
    const prefix = await fs.readFile(f.archive("1.0.0") + ".partial");
    assert(prefix.length > 0);
    await f.run(f.make("0.9.0"));
    assert(f.state.requests[1].startsWith(`bytes=${prefix.length}-`));
  });

  test(`${platform}: a checksum failure never exposes an installer as ready`, async (t) => {
    const f = await fixture(t, platform), bytes = await f.release("1.0.0", randomBytes(64 * 1024));
    f.state.assets.set(f.state.info.files[0].url, randomBytes(bytes.length));
    const updater = f.make("0.9.0"); let ready = 0;
    updater.on("update-downloaded", () => ready++);
    await assert.rejects(f.run(updater), /checksum/);
    assert.equal(ready, 0);
  });

  test(`${platform}: an existing installation seeds its native installer cache for the next differential update`, async (t) => {
    const f = await fixture(t, platform), old = baseline;
    const installedBytes = await f.release("1.0.0", old);
    const source = platform === "linux" ? f.installed : path.join(f.root, "sdk-cache", CURRENT_APP_INSTALLER_FILE_NAME);
    await fs.mkdir(path.dirname(source), { recursive: true }); await fs.writeFile(source, installedBytes);
    const updater = f.make("1.0.0"); updater.requestHeaders = { "X-Update-Test": "forwarded" };
    updater.emit("update-not-available", f.state.info);
    const start = Date.now();
    while (!await fs.stat(f.archive("1.0.0") + ".json").then(() => true, () => false)) {
      if (Date.now() - start > 3000) assert.fail("Native installer cache was not seeded");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(f.state.requests.length, 0, "cache seeding must reuse installed bytes");
    await f.release("10.0.0", Buffer.concat([old.subarray(0, 256 * 1024), randomBytes(8192), old.subarray(256 * 1024)]));
    const [pending] = await f.run(updater);
    assert(f.state.requests.every((range) => range));
    assert(f.state.sent < (await fs.stat(pending)).size / 3);
  });
}

test("Windows publisher signature verification still gates the ready event", async (t) => {
  const f = await fixture(t, "win32");
  await f.release("1.0.0", randomBytes(64 * 1024)); f.state.signature = "Publisher mismatch";
  const updater = f.make("0.9.0"); let ready = 0;
  updater.on("update-downloaded", () => ready++);
  await assert.rejects(f.run(updater), /not signed by the application owner/);
  assert.equal(f.state.verified, 1); assert.equal(ready, 0);
});
