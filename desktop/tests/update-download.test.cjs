const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { createHash, randomBytes } = require("node:crypto");
const { gzipSync, gunzipSync } = require("node:zlib");
const YAML = require("yaml");
const { buildBlockMap } = require("app-builder-lib/out/targets/blockmap/blockmap");
const { MacUpdater, acknowledgeMacUpdate } = require("../src/mac-updater.cjs");
const baseline = createHash("shake256", { outputLength: 2 * 1024 * 1024 }).update("update-download-baseline").digest();

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-download-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const state = { assets: new Map(), requests: [], sent: 0, interrupt: false, ignoreRange: false, badRange: false, missingMap: false };
  const server = http.createServer((req, res) => {
    const filename = path.basename(req.url);
    if (filename === "latest-mac.yml") return res.end(YAML.stringify(state.manifest));
    if (filename.endsWith(".blockmap") && state.missingMap) { res.writeHead(404); return res.end(); }
    const bytes = state.assets.get(filename);
    if (!bytes) { res.writeHead(404); return res.end(); }
    if (filename.endsWith(".blockmap")) return res.end(bytes);
    const range = req.headers.range;
    state.requests.push({ filename, range, encoding: req.headers["accept-encoding"] });
    let start = 0, end = bytes.length - 1;
    if (range && !state.ignoreRange) {
      [, start, end] = /^bytes=(\d+)-(\d+)$/.exec(range).map((x, i) => i ? Number(x) : x);
      res.writeHead(206, { "Content-Range": state.badRange ? `bytes 0-${end}/${bytes.length}` : `bytes ${start}-${end}/${bytes.length}`, "Content-Length": end - start + 1 });
    } else {
      res.writeHead(200, { "Content-Length": bytes.length });
    }
    let body = bytes.subarray(start, end + 1);
    if (state.interrupt) {
      state.interrupt = false;
      body = body.subarray(0, Math.max(1, Math.floor(body.length / 2)));
      state.sent += body.length;
      res.write(body);
      setTimeout(() => res.destroy(), 30);
    } else {
      state.sent += body.length;
      res.end(body);
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const feedUrl = `https://updates.test/desktop-updates/darwin/${process.arch}/`;
  const make = (version) => new MacUpdater({
    app: { getPath: () => root, getVersion: () => version }, feedUrl,
    fetch: (url, options) => fetch(origin + new URL(url).pathname, options),
  });
  const release = async (version, bytes) => {
    const name = `Plasmic-${version}-mac-${process.arch}.zip`;
    const disk = path.join(root, name);
    await fs.writeFile(disk, bytes);
    await buildBlockMap(disk, "gzip", disk + ".blockmap");
    state.assets.clear(); // Model the NAS release image: only the latest release is hosted.
    state.assets.set(name, bytes);
    state.assets.set(name + ".blockmap", await fs.readFile(disk + ".blockmap"));
    state.manifest = { version, files: [{ url: name, size: bytes.length, sha512: createHash("sha512").update(bytes).digest("base64") }] };
    state.requests = []; state.sent = 0;
    return name;
  };
  return { root, state, make, release, archive: (version) => path.join(root, "updates", `Plasmic-${version}.zip`) };
}

async function differentialFixture(t) {
  const f = await fixture(t);
  const old = baseline;
  await f.release("1.0.0", old);
  const first = f.make("0.9.0");
  await first.checkForUpdates(); await first.downloadUpdate();
  const bytes = Buffer.concat([old.subarray(0, 256 * 1024), randomBytes(16 * 1024), old.subarray(256 * 1024)]);
  const name = await f.release("1.0.1", bytes);
  return { ...f, bytes, name };
}

test("full downloads resume after disconnection and application restart using exact byte ranges", async (t) => {
  const f = await fixture(t), bytes = randomBytes(256 * 1024);
  await f.release("1.0.0", bytes); f.state.missingMap = true; f.state.interrupt = true;
  let updater = f.make("0.9.0"), ready = 0;
  updater.on("update-downloaded", () => ready++);
  await updater.checkForUpdates();
  await assert.rejects(updater.downloadUpdate());
  const partial = f.archive("1.0.0") + ".partial";
  const saved = await fs.readFile(partial);
  assert(saved.length > 0 && saved.length < bytes.length);
  assert.equal(ready, 0);
  updater = f.make("0.9.0");
  await updater.checkForUpdates(); await updater.downloadUpdate();
  assert.equal(f.state.requests[1].range, `bytes=${saved.length}-${bytes.length - 1}`);
  assert.equal(f.state.sent, bytes.length);
  assert.deepEqual(await fs.readFile(f.archive("1.0.0")), bytes);
  assert(f.state.requests.every((r) => r.encoding.split(",").every((s) => s.trim() === "identity")));
  await assert.rejects(fs.stat(partial), { code: "ENOENT" });
});

test("a server ignoring resumed ranges restarts once without appending a full response", async (t) => {
  const f = await fixture(t), bytes = randomBytes(64 * 1024);
  await f.release("1.0.0", bytes); f.state.interrupt = true;
  let updater = f.make("0.9.0");
  await updater.checkForUpdates(); await assert.rejects(updater.downloadUpdate());
  f.state.ignoreRange = true;
  updater = f.make("0.9.0");
  await updater.checkForUpdates(); await updater.downloadUpdate();
  assert.equal(f.state.requests.length, 3);
  assert(f.state.requests[1].range);
  assert.equal(f.state.requests[2].range, undefined);
  assert.deepEqual(await fs.readFile(f.archive("1.0.0")), bytes);
});

test("a partial archive belongs to its SHA-512 identity, even when a version URL is reused", async (t) => {
  const f = await fixture(t);
  await f.release("1.0.0", randomBytes(64 * 1024)); f.state.interrupt = true;
  let updater = f.make("0.9.0");
  await updater.checkForUpdates(); await assert.rejects(updater.downloadUpdate());
  const bytes = randomBytes(64 * 1024);
  await f.release("1.0.0", bytes);
  updater = f.make("0.9.0");
  await updater.checkForUpdates(); await updater.downloadUpdate();
  assert.equal(f.state.requests[0].range, undefined);
  assert.deepEqual(await fs.readFile(f.archive("1.0.0")), bytes);
});

test("standard electron-builder blockmaps reconstruct an update while transferring only changed bytes", async (t) => {
  const f = await differentialFixture(t), updater = f.make("1.0.0"), progress = [];
  updater.on("download-progress", (p) => progress.push(p.percent));
  await updater.checkForUpdates(); await updater.downloadUpdate();
  assert(f.state.requests.length > 0);
  assert(f.state.requests.every((r) => r.range), "unchanged bytes must be read from the verified cache");
  assert(f.state.sent < f.bytes.length / 3, `downloaded ${f.state.sent} of ${f.bytes.length} bytes`);
  assert.deepEqual(await fs.readFile(f.archive("1.0.1")), f.bytes);
  assert.equal(progress.at(-1), 100);
  const before = f.state.requests.length;
  await updater.downloadUpdate();
  assert.equal(f.state.requests.length, before, "a complete, verified archive is reused");
});

test("interrupted differential downloads resume an assembled prefix across application restarts", async (t) => {
  const f = await differentialFixture(t);
  f.state.interrupt = true;
  let updater = f.make("1.0.0");
  await updater.checkForUpdates(); await assert.rejects(updater.downloadUpdate());
  const partial = await fs.readFile(f.archive("1.0.1") + ".partial");
  assert(partial.length > 0);
  assert.deepEqual(partial, f.bytes.subarray(0, partial.length));
  updater = f.make("1.0.0");
  await updater.checkForUpdates(); await updater.downloadUpdate();
  assert(f.state.requests.every((r) => r.range));
  assert.equal(Number(/^bytes=(\d+)/.exec(f.state.requests[1].range)[1]), partial.length);
  assert(f.state.sent < f.bytes.length / 3);
  assert.deepEqual(await fs.readFile(f.archive("1.0.1")), f.bytes);
});

for (const failure of ["ignoreRange", "badRange", "missingMap", "corruptBase", "corruptMap"]) {
  test(`differential ${failure} safely falls back to a verified full archive`, async (t) => {
    const f = await differentialFixture(t);
    if (failure === "corruptBase") await fs.writeFile(f.archive("1.0.0"), randomBytes(baseline.length));
    else if (failure === "corruptMap") {
      const map = JSON.parse(gunzipSync(f.state.assets.get(f.name + ".blockmap")));
      for (const key of ["sizes", "checksums"]) [map.files[0][key][0], map.files[0][key][1]] = [map.files[0][key][1], map.files[0][key][0]];
      f.state.assets.set(f.name + ".blockmap", gzipSync(JSON.stringify(map)));
    } else f.state[failure] = true;
    const updater = f.make("1.0.0");
    await updater.checkForUpdates(); await updater.downloadUpdate();
    assert.equal(f.state.requests.at(-1).range, undefined);
    assert.deepEqual(await fs.readFile(f.archive("1.0.1")), f.bytes);
  });
}

test("checksum failures never report ready, discard invalid partial data, and allow a clean retry", async (t) => {
  const f = await fixture(t), bytes = randomBytes(64 * 1024);
  const name = await f.release("1.0.0", bytes);
  f.state.assets.set(name, randomBytes(bytes.length));
  const updater = f.make("0.9.0"); let ready = 0;
  updater.on("update-downloaded", () => ready++);
  await updater.checkForUpdates(); await assert.rejects(updater.downloadUpdate(), /checksum/);
  assert.equal(ready, 0);
  await assert.rejects(fs.stat(f.archive("1.0.0") + ".partial"), { code: "ENOENT" });
  f.state.assets.set(name, bytes);
  await updater.downloadUpdate();
  assert.equal(ready, 1);
});

test("acknowledging installation retains one matching differential base and prunes old transfers", async (t) => {
  const f = await differentialFixture(t), updater = f.make("1.0.0");
  await updater.checkForUpdates(); await updater.downloadUpdate();
  const target = path.join(f.root, "Plasmic.app"), id = "eb954cc1-07c2-4b0b-85a0-5d00eedf12ae";
  await fs.writeFile(path.join(f.root, "updates/mac-transaction.json"), JSON.stringify({ id, version: "1.0.1", target }));
  await acknowledgeMacUpdate({ getPath: () => f.root, getVersion: () => "1.0.1", getAppPath: () => path.join(target, "Contents/Resources/app.asar") });
  for (const suffix of ["", ".json", ".blockmap"]) {
    await fs.access(f.archive("1.0.1") + suffix);
    await assert.rejects(fs.access(f.archive("1.0.0") + suffix), { code: "ENOENT" });
  }
});

test("an upgrade installed by the previous full-only updater seeds its cached ZIP for the next differential update", async (t) => {
  const f = await fixture(t), old = baseline;
  await f.release("1.0.0", old);
  await fs.mkdir(path.join(f.root, "updates"));
  // This is all the previous updater left behind: no metadata or blockmap.
  await fs.writeFile(f.archive("1.0.0"), old);
  const updater = f.make("1.0.0");
  await updater.checkForUpdates();
  assert.equal(updater.info, null);
  assert.equal(f.state.requests.length, 0, "seeding must not download the archive again");
  const bytes = Buffer.concat([old.subarray(0, 256 * 1024), randomBytes(8192), old.subarray(256 * 1024)]);
  await f.release("1.0.1", bytes);
  await updater.checkForUpdates(); await updater.downloadUpdate();
  assert(f.state.requests.every((r) => r.range));
  assert(f.state.sent < bytes.length / 3);
  assert.deepEqual(await fs.readFile(f.archive("1.0.1")), bytes);
});

test("cache seeding never changes a version-only already-current response into an update failure", async (t) => {
  const f = await fixture(t), bytes = randomBytes(64 * 1024);
  await f.release("1.0.0", bytes);
  await fs.mkdir(path.join(f.root, "updates"));
  await fs.writeFile(f.archive("1.0.0"), bytes);
  f.state.manifest = { version: "1.0.0" };
  const updater = f.make("1.0.0"); let current = 0;
  updater.on("update-not-available", () => current++);
  await updater.checkForUpdates();
  assert.equal(updater.info, null); assert.equal(current, 1);
  assert.equal(f.state.requests.length, 0);
  assert.deepEqual(await fs.readFile(f.archive("1.0.0")), bytes);
});
