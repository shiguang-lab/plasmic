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
const {
  MacUpdater,
  parseManifest,
  acknowledgeMacUpdate,
} = require("../src/mac-updater.cjs");
const feed = `https://updates.example/desktop-updates/darwin/${process.arch}/`;
const bytes = Buffer.from("a complete update archive");
const manifest = {
  version: "0.0.2",
  files: [
    {
      url: `Plasmic-0.0.2-mac-${process.arch}.zip`,
      size: bytes.length,
      sha512: createHash("sha512").update(bytes).digest("base64"),
    },
  ],
};
function manager(updater, beforeInstall = async () => {}) {
  return new UpdateManager({
    updater,
    version: "0.0.1",
    enabled: true,
    beforeInstall,
  });
}
test("install confirmation at the download completion event waits for the download command to settle", async () => {
  const updater=new EventEmitter();let release,installing,installs=0;
  const updates=manager(updater);
  updater.checkForUpdates=async()=>updater.emit("update-available",manifest);
  updater.downloadUpdate=async()=>{updater.emit("update-downloaded",manifest);await new Promise(resolve=>{release=resolve})};
  updater.quitAndInstall=async()=>installs++;
  updates.on("status",status=>{if(status.phase==="downloaded")queueMicrotask(()=>{installing=updates.command("install")})});
  const checking=updates.command("check");
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(installs,0);release();await checking;await installing;
  assert.equal(installs,1);assert.equal(updates.state.phase,"installing");
});
test("checks download automatically but installation waits for confirmation and saves before quitting", async () => {
  const updater = new EventEmitter();
  const order = [];
  updater.checkForUpdates = async () => {
    updater.emit("checking-for-update");
    updater.emit("update-available", manifest);
  };
  updater.downloadUpdate = async () => {
    updater.emit("download-progress", { percent: 45.3 });
    updater.emit("update-downloaded", manifest);
  };
  updater.quitAndInstall = async () => order.push("install");
  const updates = manager(updater, async () => order.push("save"));
  const phases = [];
  updates.on("status", ({ phase }) => phases.push(phase));
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal((await updates.command("install")).phase, "idle");
  assert.equal((await updates.command("check")).phase, "downloaded");
  assert.deepEqual(phases, [
    "checking",
    "available",
    "downloading",
    "downloading",
    "downloaded",
  ]);
  assert.equal((await updates.command("check")).phase, "downloaded");
  assert.deepEqual(order, []);
  await updates.command("install");
  assert.deepEqual(order, ["save", "install"]);
});
test("failed save reports failure and blocks installation and a later check allows installation", async () => {
  const updater = new EventEmitter();
  let installs = 0,
    saves = 0;
  updater.quitAndInstall = () => installs++;
  updater.checkForUpdates = async () =>
    updater.emit("update-available", manifest);
  updater.downloadUpdate = async () =>
    updater.emit("update-downloaded", manifest);
  const updates = manager(updater, async () => {
    if (++saves === 1) throw new Error("Save failed");
  });
  updater.emit("update-downloaded", manifest);
  assert.equal((await updates.command("install")).phase, "error");
  assert.equal(installs, 0);
  await updates.command("check");
  await updates.command("install");
  assert.equal(installs, 1);
});
test("overlapping checks share one request; failed downloads wait for a later check", async () => {
  const updater = new EventEmitter();
  let resolve,
    checks = 0,
    downloads = 0;
  updater.checkForUpdates = () => {
    checks++;
    return new Promise((done) => {
      resolve = done;
    });
  };
  updater.downloadUpdate = async () => {
    if (++downloads === 1) throw new Error("Network offline");
    updater.emit("update-downloaded", manifest);
  };
  const updates = manager(updater);
  const first = updates.command("check"),
    second = updates.command("check");
  assert.equal(checks, 1);
  updater.emit("update-available", manifest);
  resolve();
  const results = await Promise.all([first, second]);
  assert.equal(results[0].phase, "error");
  assert.equal(results[1].phase, "error");
  assert.equal(updates.state.version, undefined);
  assert.equal(updates.state.releaseNotes, undefined);
  assert.equal(updates.state.percent, undefined);
  assert.equal(updates.state.error, undefined);
  assert.equal(downloads, 1);
  assert.equal((await updates.command("download")).phase, "error");
  updater.checkForUpdates = async () => {
    checks++;
    updater.emit("update-available", manifest);
  };
  assert.equal((await updates.command("check")).phase, "downloaded");
  assert.equal(checks, 2);
  assert.equal(downloads, 2);
});
test("startup downloads in the background and periodic checks cannot interrupt the download or ready state", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const updater = new EventEmitter();
  let checks = 0,
    downloads = 0,
    finish;
  updater.checkForUpdates = async () => {
    checks++;
    updater.emit("update-available", manifest);
  };
  updater.downloadUpdate = () => {
    downloads++;
    return new Promise((resolve) => {
      finish = () => {
        updater.emit("update-downloaded", manifest);
        resolve();
      };
    });
  };
  const updates = manager(updater);
  t.after(() => updates.stop());
  updates.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(updates.state.phase, "downloading");
  t.mock.timers.tick(60 * 1000);
  assert.equal(checks, 1);
  assert.equal(downloads, 1);
  finish();
  await updates.running;
  t.mock.timers.tick(60 * 1000);
  assert.equal(updates.state.phase, "downloaded");
  assert.equal(checks, 1);
});
test("stable version comparison rejects downgrade, prerelease, traversal and cross-origin artifacts", () => {
  assert.equal(parseManifest(YAML.stringify(manifest), "0.0.2", feed), null);
  assert.equal(parseManifest(YAML.stringify(manifest), "0.0.10", feed), null);
  assert.equal(
    parseManifest(
      YAML.stringify({ ...manifest, version: "0.0.10" }),
      "0.0.9",
      feed,
    ).version,
    "0.0.10",
  );
  for (const url of [
    "../update.zip",
    "https://other.example/update.zip",
    "dir/update.zip",
  ]) {
    assert.throws(
      () =>
        parseManifest(
          YAML.stringify({
            ...manifest,
            files: [{ ...manifest.files[0], url }],
          }),
          "0.0.1",
          feed,
        ),
      /artifact/,
    );
  }
  assert.throws(
    () =>
      parseManifest(
        YAML.stringify({ ...manifest, version: "0.0.3-beta.1" }),
        "0.0.1",
        feed,
      ),
    /stable/,
  );
});
test("macOS downloads verify complete bytes and SHA-512 before reporting ready; failed downloads remove partial files", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-updates-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let corrupt = false,
    downloaded = 0;
  const updater = new MacUpdater({
    app: { getPath: () => root, getVersion: () => "0.0.1" },
    feedUrl: feed,
    fetch: async (url) => url.endsWith(".blockmap") ? new Response(null, { status: 404 }) :
      url.endsWith(".yml")
        ? new Response(YAML.stringify(manifest))
        : new Response(corrupt ? Buffer.from("bad") : bytes),
  });
  updater.on("update-downloaded", () => downloaded++);
  await updater.checkForUpdates();
  const [file] = await updater.downloadUpdate();
  assert.deepEqual(await fs.readFile(file), bytes);
  assert.equal(downloaded, 1);
  // A valid complete cache is reused; corrupt bytes must never be reused.
  await updater.downloadUpdate();
  assert.equal(downloaded, 2);
  await fs.writeFile(file, "corrupt cached archive");
  corrupt = true;
  await assert.rejects(updater.downloadUpdate(), /checksum/);
  assert.equal(downloaded, 2);
  await assert.rejects(fs.stat(file + ".partial"), { code: "ENOENT" });
  const malicious = new MacUpdater({
    app: { getPath: () => root, getVersion: () => "0.0.1" },
    feedUrl: feed,
    fetch: async () => new Response(bytes, { status: 503 }),
  });
  await assert.rejects(malicious.checkForUpdates(), /503/);
});
test("only the expected installed version and bundle acknowledge an update", async (t) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "plasmic-update-receipt-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "updates"));
  const id = "eb954cc1-07c2-4b0b-85a0-5d00eedf12ae";
  const target = path.join(root, "Plasmic.app");
  const transaction = { id, version: "0.0.2", target };
  await fs.writeFile(
    path.join(root, "updates/mac-transaction.json"),
    JSON.stringify(transaction),
  );
  const app = {
    getPath: () => root,
    getVersion: () => "0.0.1",
    getAppPath: () => path.join(target, "Contents/Resources/app.asar"),
  };
  await acknowledgeMacUpdate(app);
  await assert.rejects(fs.stat(path.join(root, `updates/${id}.ready`)), {
    code: "ENOENT",
  });
  app.getVersion = () => "0.0.2";
  await fs.writeFile(path.join(root, "updates/Plasmic-0.0.2.zip"), "cached");
  await fs.writeFile(path.join(root, "updates/Plasmic-0.0.1.zip"), "old base");
  await fs.mkdir(path.join(root, "updates/extract-fixture"));
  await fs.writeFile(
    path.join(root, "updates/extract-fixture/data"),
    "extracted",
  );
  await acknowledgeMacUpdate(app);
  assert.equal(
    await fs.readFile(path.join(root, `updates/${id}.ready`), "utf8"),
    "ready",
  );
  assert.equal(await fs.readFile(path.join(root, "updates/Plasmic-0.0.2.zip"), "utf8"), "cached");
  await assert.rejects(fs.stat(path.join(root, "updates/Plasmic-0.0.1.zip")), {
    code: "ENOENT",
  });
  await assert.rejects(fs.stat(path.join(root, "updates/extract-fixture")), {
    code: "ENOENT",
  });
});
test("development and unpacked launches keep updates disabled even after an updater error", async () => {
  const updater = new EventEmitter();
  updater.checkForUpdates =
    updater.downloadUpdate =
    updater.quitAndInstall =
      () => {
        throw new Error("Updater must not run");
      };
  const updates = new UpdateManager({
    updater,
    enabled: false,
    version: "0.0.1",
    beforeInstall: async () => {
      throw new Error("Must not install");
    },
  });
  updater.emit("error", new Error("Prior install failed"));
  for (const command of ["check", "download", "install"])
    assert.equal((await updates.command(command)).phase, "disabled");
});
test("installed clients check immediately at startup and every minute until stopped", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const updater = new EventEmitter();
  let checks = 0;
  updater.checkForUpdates = async () => {
    checks++;
    updater.emit("update-not-available");
  };
  const updates = manager(updater);
  t.after(() => updates.stop());
  updates.start();
  assert.equal(checks, 1);
  await updates.running;
  t.mock.timers.tick(60 * 1000 - 1);
  assert.equal(checks, 1);
  t.mock.timers.tick(1);
  await updates.running;
  assert.equal(checks, 2);
  t.mock.timers.tick(60 * 1000);
  await updates.running;
  assert.equal(checks, 3);
  updates.stop();
  t.mock.timers.tick(60 * 1000);
  assert.equal(checks, 3);
});
test("release validation refuses incomplete or modified artifacts before publication", async (t) => {
  const { validateRelease } = await import("../scripts/release-artifacts.mjs");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-release-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(
    path.join(root, "latest-mac.yml"),
    YAML.stringify(manifest),
  );
  await fs.writeFile(path.join(root, manifest.files[0].url), bytes);
  const { gzipSync } = require("node:zlib");
  await fs.writeFile(path.join(root, manifest.files[0].url + ".blockmap"), gzipSync(JSON.stringify({
    version: "2", files: [{ name: "file", offset: 0, sizes: [bytes.length], checksums: [manifest.files[0].sha512] }],
  })));
  assert.equal(
    (await validateRelease(root, "darwin", "0.0.2")).files.length,
    2,
  );
  await fs.writeFile(path.join(root, manifest.files[0].url), "wrong bytes");
  await assert.rejects(
    validateRelease(root, "darwin", "0.0.2"),
    /checksum or size/,
  );
  await assert.rejects(
    validateRelease(root, "darwin", "0.0.3"),
    /manifest version/,
  );
});
test(
  "macOS helper restores the previous bundle if the replacement cannot launch",
  { skip: process.platform !== "darwin" },
  async (t) => {
    const root = await fs.mkdtemp(
      path.join(os.tmpdir(), "plasmic-update-rollback-"),
    );
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const target = path.join(root, "Plasmic.app"),
      staged = path.join(root, "staged.app"),
      backup = path.join(root, "backup.app");
    await fs.mkdir(target);
    await fs.mkdir(staged);
    await fs.writeFile(path.join(target, "old-version"), "retained");
    await assert.rejects(
      promisify(execFile)("/bin/sh", [
        path.resolve(__dirname, "../src/mac-update-install.sh"),
        "2147483647",
        target,
        staged,
        backup,
        path.join(root, "receipt"),
        path.join(root, "transaction"),
        path.join(root, "failure"),
        path.join(root, "log"),
        path.join(root, "pid"),
      ]),
    );
    assert.equal(
      await fs.readFile(path.join(target, "old-version"), "utf8"),
      "retained",
    );
    assert.match(
      await fs.readFile(path.join(root, "failure"), "utf8"),
      /previous version restored/,
    );
    await assert.rejects(fs.stat(backup), { code: "ENOENT" });
  },
);

for (const mode of ["rejection", "event"]) {
  test(`failed checks from ${mode} report failure and periodic checks recover`, async (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] });
    t.mock.method(console, "warn", () => {});
    const updater = new EventEmitter();
    let checks = 0;
    updater.checkForUpdates = async () => {
      checks++;
      updater.emit("checking-for-update");
      if (checks === 1) {
        const error = new Error("NAS update check failed (HTTP 503)");
        if (mode === "event") updater.emit("error", error);
        else throw error;
      } else updater.emit("update-available", manifest);
    };
    updater.downloadUpdate = async () =>
      updater.emit("update-downloaded", manifest);
    const updates = manager(updater);
    const statuses = [];
    updates.on("status", (status) => statuses.push(status));
    t.after(() => updates.stop());
    updates.start();
    await updates.running;
    assert.equal(updates.state.phase, "error");
    assert.equal(checks, 1);
    assert.equal(console.warn.mock.calls.length, 1);
    assert.equal(
      statuses.some(
        (status) =>
          status.error ||
          status.uiMessage ||
          status.retry,
      ),
      false,
    );
    t.mock.timers.tick(60 * 1000);
    await updates.running;
    assert.equal(checks, 2);
    assert.equal(updates.state.phase, "downloaded");
  });
}

test("a failed background download clears its badge and is retried at the next periodic check", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  t.mock.method(console, "warn", () => {});
  const updater = new EventEmitter();
  let checks = 0,
    downloads = 0;
  updater.checkForUpdates = async () => {
    checks++;
    updater.emit("update-available", {
      ...manifest,
      releaseNotes: "- Improvement",
    });
  };
  updater.downloadUpdate = async () => {
    if (++downloads === 1) {
      updater.emit("download-progress", { percent: 45 });
      throw new Error("Network unavailable");
    }
    updater.emit("update-downloaded", manifest);
  };
  const updates = manager(updater);
  t.after(() => updates.stop());
  updates.start();
  await updates.running;
  assert.equal(updates.state.phase, "error");
  for (const key of [
    "version",
    "releaseNotes",
    "percent",
    "error",
    "uiMessage",
    "retry",
  ]) {
    assert.equal(updates.state[key], undefined);
  }
  t.mock.timers.tick(60 * 1000);
  await updates.running;
  assert.equal(checks, 2);
  assert.equal(downloads, 2);
  assert.equal(updates.state.phase, "downloaded");
});
