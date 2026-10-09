const { uiError } = require("./ui-error.cjs");
const { EventEmitter } = require("node:events");
const fs = require("node:fs/promises");
// Removing application bundles must treat app.asar as a physical file.
const physicalFs = process.versions.electron
  ? require("original-fs").promises
  : fs;
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const { pipeline } = require("node:stream/promises");
const { Readable, Transform } = require("node:stream");
const { createWriteStream } = require("node:fs");
const semver = require("semver");
const YAML = require("yaml");
const { macUpdateArch } = require("./update-architecture.cjs");
const run = promisify(execFile);

function parseManifest(text, currentVersion, feedUrl, arch) {
  const info = YAML.parse(text);
  if (!semver.valid(info?.version) || semver.prerelease(info.version))
    throw uiError("Invalid stable update version");
  if (!semver.gt(info.version, currentVersion)) return null;
  const file = info.files?.find(
    (file) => typeof file.url === "string" && file.url.endsWith(".zip"),
  );
  if (
    !file ||
    !/^[a-zA-Z0-9._-]+\.zip$/.test(file.url) ||
    !Number.isSafeInteger(file.size) ||
    file.size <= 0 ||
    !/^[A-Za-z0-9+/]{86}==$/.test(file.sha512)
  )
    throw uiError("Invalid macOS update artifact");
  if (arch && file.url !== `Plasmic-${info.version}-mac-${arch}.zip`)
    throw uiError("Update artifact architecture or version mismatch");
  return { ...info, file: { ...file, url: new URL(file.url, feedUrl).href } };
}

class MacUpdater extends EventEmitter {
  constructor({ app, feedUrl, fetch }) {
    super();
    if (new URL(feedUrl).protocol !== "https:")
      throw uiError("Updates require HTTPS");
    this.app = app;
    this.arch = macUpdateArch(app);
    this.feedUrl = feedUrl;
    this.fetch = fetch;
    this.cache = path.join(app.getPath("userData"), "updates");
  }
  async checkForUpdates() {
    this.emit("checking-for-update");
    const response = await this.fetch(this.feedUrl + "latest-mac.yml", {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
    if (!response.ok)
      throw uiError("NAS update check failed (HTTP {status})", {
        status: response.status,
      });
    this.info = parseManifest(
      await response.text(),
      this.app.getVersion(),
      this.feedUrl,
      this.arch,
    );
    this.emit(
      this.info ? "update-available" : "update-not-available",
      this.info || {},
    );
  }
  async downloadUpdate() {
    if (!this.info) throw uiError("Check for an update first");
    await fs.mkdir(this.cache, { recursive: true, mode: 0o700 });
    this.archive = path.join(this.cache, `Plasmic-${this.info.version}.zip`);
    const partial = this.archive + ".partial";
    try {
      const response = await this.fetch(this.info.file.url, {
        signal: AbortSignal.timeout(30 * 60 * 1000),
        redirect: "error",
      });
      if (!response.ok || !response.body)
        throw uiError("Update download failed (HTTP {status})", {
          status: response.status,
        });
      let received = 0,
        lastPercent = -1;
      const hash = createHash("sha512");
      const progress = new Transform({
        transform: (chunk, _encoding, callback) => {
          received += chunk.length;
          hash.update(chunk);
          if (received > this.info.file.size)
            return callback(uiError("Update size exceeds manifest"));
          const percent = Math.floor((received / this.info.file.size) * 100);
          if (percent !== lastPercent) {
            lastPercent = percent;
            this.emit("download-progress", { percent });
          }
          callback(null, chunk);
        },
      });
      await pipeline(
        Readable.fromWeb(response.body),
        progress,
        createWriteStream(partial, { mode: 0o600 }),
      );
      if (
        received !== this.info.file.size ||
        hash.digest("base64") !== this.info.file.sha512
      )
        throw uiError("Update checksum verification failed");
      await fs.rename(partial, this.archive);
      this.emit("update-downloaded", this.info);
      return [this.archive];
    } catch (error) {
      await fs.rm(partial, { force: true });
      throw error;
    }
  }
  async quitAndInstall() {
    if (!this.archive || !this.info) throw uiError("Download an update first");
    const target = path.resolve(this.app.getAppPath(), "../../..");
    if (path.basename(target) !== "Plasmic.app" || !this.app.isPackaged)
      throw uiError("Run the installed Plasmic.app to update");
    if (target.startsWith("/Volumes/"))
      throw uiError("Move Plasmic to Applications before installing updates");
    await fs.access(path.dirname(target), require("node:fs").constants.W_OK);
    const id = randomUUID();
    const extract = await fs.mkdtemp(path.join(this.cache, "extract-"));
    const staged = path.join(path.dirname(target), `.Plasmic-update-${id}.app`);
    try {
      await run("/usr/bin/ditto", ["-x", "-k", this.archive, extract]);
      const source = path.join(extract, "Plasmic.app");
      const plist = path.join(source, "Contents/Info.plist");
      for (const [key, expected] of [
        ["CFBundleIdentifier", "cn.publib.plasmic.desktop"],
        ["CFBundleShortVersionString", this.info.version],
      ]) {
        const { stdout } = await run("/usr/bin/plutil", [
          "-extract",
          key,
          "raw",
          "-o",
          "-",
          plist,
        ]);
        if (stdout.trim() !== expected)
          throw uiError("Update application identity or version mismatch");
      }
      await run("/usr/bin/lipo", [
        path.join(source, "Contents/MacOS/Plasmic"),
        "-verify_arch",
        this.arch === "arm64" ? "arm64" : "x86_64",
      ]);
      await run("/usr/bin/codesign", [
        "--verify",
        "--deep",
        "--strict",
        source,
      ]);
      await run("/usr/bin/ditto", [source, staged]);
      // Finish extraction cleanup before Electron exits the current process.
      await physicalFs.rm(extract, { recursive: true, force: true });
      const helper = path.join(this.cache, "install.sh");
      const transaction = path.join(this.cache, "mac-transaction.json");
      const receipt = path.join(this.cache, `${id}.ready`);
      const backup = path.join(
        path.dirname(target),
        `.Plasmic-backup-${id}.app`,
      );
      await fs.copyFile(path.join(__dirname, "mac-update-install.sh"), helper);
      await fs.writeFile(
        transaction,
        JSON.stringify({ id, target, version: this.info.version }),
        { mode: 0o600 },
      );
      const child = spawn(
        "/bin/sh",
        [
          helper,
          String(process.pid),
          target,
          staged,
          backup,
          receipt,
          transaction,
          path.join(this.cache, "install-failure.txt"),
          path.join(this.cache, "install.log"),
          path.join(this.cache, `${id}.pid`),
        ],
        { detached: true, stdio: "ignore" },
      );
      await new Promise((resolve, reject) => {
        child.once("spawn", resolve);
        child.once("error", reject);
      });
      child.unref();
      this.app.quit();
    } catch (error) {
      await physicalFs.rm(staged, { recursive: true, force: true });
      throw error;
    } finally {
      await physicalFs.rm(extract, { recursive: true, force: true });
    }
  }
}
async function acknowledgeMacUpdate(app, ready = true) {
  const cache = path.join(app.getPath("userData"), "updates");
  try {
    const transaction = JSON.parse(
      await fs.readFile(path.join(cache, "mac-transaction.json"), "utf8"),
    );
    if (
      /^[a-f0-9-]{36}$/.test(transaction.id) &&
      transaction.version === app.getVersion() &&
      transaction.target === path.resolve(app.getAppPath(), "../../..")
    ) {
      if (ready) {
        await fs.rm(path.join(cache, `Plasmic-${transaction.version}.zip`), {
          force: true,
        });
        for (const entry of await fs.readdir(cache, { withFileTypes: true })) {
          if (entry.isDirectory() && entry.name.startsWith("extract-"))
            await physicalFs.rm(path.join(cache, entry.name), {
              recursive: true,
              force: true,
            });
        }
      }
      await fs.writeFile(
        path.join(cache, `${transaction.id}.${ready ? "ready" : "pid"}`),
        ready ? "ready" : String(process.pid),
        { mode: 0o600 },
      );
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
module.exports = { MacUpdater, parseManifest, acknowledgeMacUpdate };
