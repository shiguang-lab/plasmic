// Exercise the actual Electron session transport, including a broken range body.
const { app, session } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { randomBytes, createHash } = require("node:crypto");
const YAML = require("yaml");
const { buildBlockMap } = require("app-builder-lib/out/targets/blockmap/blockmap");
const { MacUpdater } = require("../src/mac-updater.cjs");
const { createNativeUpdater } = require("../src/native-updater.cjs");
const { DownloadedUpdateHelper } = require("electron-updater/out/DownloadedUpdateHelper");
const { CancellationToken } = require("builder-util-runtime");

let root, server;
app.whenReady().then(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-native-download-"));
  const assets = new Map(), requests = [];
  let manifest, interrupt = false, sent = 0;
  server = http.createServer((req, res) => {
    const name = path.basename(req.url);
    if (name === "latest-mac.yml") return res.end(YAML.stringify(manifest));
    const bytes = assets.get(name);
    if (!bytes) { res.writeHead(404); return res.end(); }
    if (name.endsWith(".blockmap")) return res.end(bytes);
    const range = req.headers.range;
    requests.push(range);
    let start = 0, end = bytes.length - 1;
    if (range) {
      const match = /^bytes=(\d+)-(\d+)$/.exec(range);
      start = Number(match[1]); end = Number(match[2]);
      res.writeHead(206, { "Content-Range": `bytes ${start}-${end}/${bytes.length}`, "Content-Length": end - start + 1 });
    } else res.writeHead(200, { "Content-Length": bytes.length });
    let body = bytes.subarray(start, end + 1);
    if (interrupt) {
      interrupt = false;
      body = body.subarray(0, Math.max(1, Math.floor(body.length / 2)));
      sent += body.length; res.write(body);
      setTimeout(() => res.destroy(), 50);
    } else { sent += body.length; res.end(body); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const transport = session.fromPartition(`update-download-${Date.now()}`);
  await transport.setProxy({ mode: "direct" });
  const make = (version) => new MacUpdater({
    app: { getPath: () => root, getVersion: () => version },
    feedUrl: `https://updates.example/darwin/${process.arch}/`,
    fetch: (url, options) => transport.fetch(`http://127.0.0.1:${server.address().port}${new URL(url).pathname}`, { ...options, bypassCustomProtocolHandlers: true }),
  });
  const release = async (version, bytes, extension = ".zip", platform = "mac") => {
    const name = `Plasmic-${version}-${platform}-${process.arch}${extension}`, file = path.join(root, name);
    await fs.writeFile(file, bytes); await buildBlockMap(file, "gzip", file + ".blockmap");
    assets.set(name, bytes); assets.set(name + ".blockmap", await fs.readFile(file + ".blockmap"));
    manifest = { version, files: [{ url: name, size: bytes.length, sha512: createHash("sha512").update(bytes).digest("base64") }] };
    requests.length = 0; sent = 0;
  };
  const old = Buffer.alloc(2 * 1024 * 1024);
  for (let offset = 0; offset < old.length; offset += 64) {
    createHash("sha512").update(`native-transport-baseline:${offset}`).digest().copy(old, offset);
  }
  await release("1.0.0", old);
  let updater = make("0.9.0");
  await updater.checkForUpdates(); await updater.downloadUpdate();
  const bytes = Buffer.concat([old.subarray(0, 256 * 1024), randomBytes(16 * 1024), old.subarray(256 * 1024)]);
  await release("1.0.1", bytes); interrupt = true;
  updater = make("1.0.0");
  await updater.checkForUpdates(); await assert.rejects(updater.downloadUpdate());
  const archive = path.join(root, "updates/Plasmic-1.0.1.zip");
  const prefix = await fs.readFile(archive + ".partial");
  assert(prefix.length > 0); assert.deepEqual(prefix, bytes.subarray(0, prefix.length));
  updater = make("1.0.0");
  await updater.checkForUpdates(); await updater.downloadUpdate();
  assert(requests.every((range) => range));
  assert.equal(Number(/^bytes=(\d+)/.exec(requests[1])[1]), prefix.length);
  assert.deepEqual(await fs.readFile(archive), bytes);
  assert(sent < bytes.length / 3);
  console.log(`PASS: Electron session.fetch reconstructed ${bytes.length} bytes, transferred ${sent} bytes (${(sent / bytes.length * 100).toFixed(1)}%), and resumed an interrupted differential download`);
  app.setPath("userData", root);
  const config = path.join(root, "app-update.yml");
  await fs.writeFile(config, YAML.stringify({ updaterCacheDirName: "fixture" }));
  for (const platform of ["win32", "linux"]) {
    const extension = platform === "win32" ? ".exe" : ".AppImage";
    const create = () => {
      const native = createNativeUpdater({ platform, feedUrl: `https://updates.example/${platform}/${process.arch}/` });
      native.autoInstallOnAppQuit = false; native.logger = null;
      native.updateConfigPath = config;
      native.downloadedUpdateHelper = new DownloadedUpdateHelper(path.join(root, `sdk-${platform}`));
      Object.defineProperty(native, "netSession", { value: { fetch: (url, options) => transport.fetch(`http://127.0.0.1:${server.address().port}${new URL(url).pathname}`, { ...options, bypassCustomProtocolHandlers: true }) } });
      return native;
    };
    const run = (native) => native.doDownloadUpdate({
      updateInfoAndProvider: { info: manifest, provider: { resolveFiles: () => [{ url: new URL(manifest.files[0].url, native.desktopFeedUrl), info: manifest.files[0] }] } },
      requestHeaders: {}, cancellationToken: new CancellationToken(), disableDifferentialDownload: false, disableWebInstaller: true,
    });
    const previousAppImage = process.env.APPIMAGE;
    try {
      if (platform === "linux") process.env.APPIMAGE = path.join(root, "installed.AppImage");
      await release(app.getVersion(), old, extension, platform); await run(create());
      await release("10.0.0", bytes, extension, platform); interrupt = true;
      await assert.rejects(run(create()));
      const partial = path.join(root, "updates", platform, process.arch, `Plasmic-10.0.0${extension}.partial`);
      const saved = await fs.readFile(partial);
      assert(saved.length > 0); assert.deepEqual(saved, bytes.subarray(0, saved.length));
      const [pending] = await run(create());
      assert(requests.every((range) => range));
      assert.equal(Number(/^bytes=(\d+)/.exec(requests[1])[1]), saved.length);
      assert.deepEqual(await fs.readFile(pending), bytes);
      assert(sent < bytes.length / 3);
      console.log(`PASS: ${platform} SDK + Electron session.fetch resumed differential download and verified all ${bytes.length} installer bytes`);
    } finally {
      if (previousAppImage === undefined) delete process.env.APPIMAGE; else process.env.APPIMAGE = previousAppImage;
    }
  }
}).then(async () => {
  server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
  await fs.rm(root, { recursive: true, force: true });
  app.exit(0);
}).catch(async (error) => {
  console.error(error);
  server?.closeAllConnections(); server?.close();
  if (root) await fs.rm(root, { recursive: true, force: true });
  app.exit(1);
});
