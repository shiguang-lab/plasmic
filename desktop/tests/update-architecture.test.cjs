const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const YAML = require("yaml");
const { macUpdateArch } = require("../src/update-architecture.cjs");
const { MacUpdater, parseManifest } = require("../src/mac-updater.cjs");

test("native Intel/Apple Silicon and Rosetta select the physical Mac architecture", () => {
  assert.equal(macUpdateArch({}, "arm64"), "arm64");
  assert.equal(macUpdateArch({}, "x64"), "x64");
  assert.equal(macUpdateArch({ runningUnderARM64Translation: true }, "x64"), "arm64");
  assert.throws(() => macUpdateArch({}, "ia32"), /Unsupported/);
});

test("architecture-specific feeds refuse wrong-CPU and wrong-version archives", () => {
  for (const arch of ["arm64", "x64"]) {
    const feed = `https://updates.example/darwin/${arch}/`;
    const file = { url: `Plasmic-1.2.3-mac-${arch}.zip`, size: 1, sha512: "a".repeat(86) + "==" };
    const text = (url) => YAML.stringify({ version: "1.2.3", files: [{ ...file, url }] });
    assert.equal(parseManifest(text(file.url), "1.2.2", feed, arch).file.url, feed + file.url);
    for (const name of [`Plasmic-1.2.3-mac-${arch === "arm64" ? "x64" : "arm64"}.zip`, "Plasmic-1.2.3-mac-universal.zip", `Plasmic-1.2.4-mac-${arch}.zip`]) {
      assert.throws(() => parseManifest(text(name), "1.2.2", feed, arch), /architecture or version/);
    }
  }
});

test("Rosetta refuses an Intel archive before downloading", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-arch-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const requests = [];
  const updater = new MacUpdater({
    app: { runningUnderARM64Translation: true, getPath: () => root, getVersion: () => "1.2.2" },
    feedUrl: "https://updates.example/darwin/arm64/",
    fetch: async (url) => {
      requests.push(url);
      return new Response(YAML.stringify({ version: "1.2.3", files: [{ url: "Plasmic-1.2.3-mac-x64.zip", size: 1, sha512: "a".repeat(86) + "==" }] }));
    },
  });
  await assert.rejects(updater.checkForUpdates(), /architecture or version/);
  assert.equal(requests.length, 1);
  assert.equal(updater.arch, "arm64");
});
