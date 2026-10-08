const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const YAML = require("yaml");

test("release JSON and image files publish complete, verified native installers", async (t) => {
  const { buildDistribution, releaseTargets } =
    await import("../scripts/build-distribution.mjs");
  const { manifestNames } = await import("../scripts/release-artifacts.mjs");
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "plasmic-distribution-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const version = "1.2.3";
  const input = path.join(root, "input");
  const output = path.join(root, "public/desktop-updates");
  const bytes = Buffer.from("installer fixture");
  const sha512 = createHash("sha512").update(bytes).digest("base64");
  for (const target of [...releaseTargets, { platform: "darwin", arch: "universal", extension: ".zip" }]) {
    const dir = path.join(input, `${target.platform}-${target.arch}`);
    await fs.mkdir(dir, { recursive: true });
    const filename = `Plasmic-${version}-${target.platform === "darwin" ? "mac" : target.platform}-${target.arch}${target.extension}`;
    await fs.writeFile(path.join(dir, filename), bytes);
    const files = [{ url: filename, size: bytes.length, sha512 }];
    if (target.platform === "darwin" && target.arch !== "universal") {
      const archive = filename.replace(/\.dmg$/, ".zip");
      await fs.writeFile(path.join(dir, archive), bytes);
      files.push({ url: archive, size: bytes.length, sha512 });
    }
    await fs.writeFile(
      path.join(dir, manifestNames[target.platform]),
      YAML.stringify({
        version,
        files,
      }),
    );
  }
  const manifest = await buildDistribution(
    input,
    output,
    version,
    "https://studio.example.com/desktop-updates",
  );
  assert.equal(manifest.installers.length, 4);
  assert.deepEqual(manifest.installers.map((file) => file.id), ["mac-arm64", "mac-x64", "windows", "linux"]);
  const legacy = YAML.parse(await fs.readFile(path.join(output, "darwin/universal/latest-mac.yml"), "utf8"));
  assert.equal(legacy.version, version);
  assert.equal(legacy.files[0].url, `Plasmic-${version}-mac-universal.zip`);
  assert.deepEqual(await fs.readFile(path.join(output, "darwin/universal", legacy.files[0].url)), bytes);
  assert(!manifest.installers.some((file) => file.arch === "universal"));
  for (const arch of ["arm64", "x64"]) {
    const native = YAML.parse(await fs.readFile(path.join(output, `darwin/${arch}/latest-mac.yml`), "utf8"));
    assert(native.files.some((file) => file.url === `Plasmic-${version}-mac-${arch}.zip`));
  }
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(output, "latest.json"), "utf8")),
    manifest,
  );
  for (const file of manifest.installers) {
    assert.match(file.url, /^https:\/\/studio.example.com\/desktop-updates\//);
    assert.equal(file.version, version);
    assert.equal(file.sha512, sha512);
    assert.deepEqual(
      await fs.readFile(
        path.join(
          output,
          new URL(file.url).pathname.slice("/desktop-updates/".length),
        ),
      ),
      bytes,
    );
  }
  await assert.rejects(
    buildDistribution(input, output, version, "https://127.0.0.1/updates"),
    /HTTPS domain/,
  );
  const armManifest = path.join(input, "darwin-arm64/latest-mac.yml");
  const armText = await fs.readFile(armManifest, "utf8");
  const armInfo = YAML.parse(armText);
  armInfo.files = armInfo.files.filter((file) => !file.url.endsWith(".zip"));
  await fs.writeFile(armManifest, YAML.stringify(armInfo));
  await assert.rejects(buildDistribution(input, path.join(root, "no-zip"), version, "https://studio.example.com/desktop-updates"), /Missing arm64 macOS update/);
  await fs.writeFile(armManifest, armText);
  armInfo.files[0].url = `Plasmic-${version}-mac-x64.dmg`;
  await fs.writeFile(armManifest, YAML.stringify(armInfo));
  await assert.rejects(buildDistribution(input, path.join(root, "wrong-arch"), version, "https://studio.example.com/desktop-updates"), /architecture/);
  await fs.writeFile(armManifest, armText);
  const linux = manifest.installers.find((file) => file.id === "linux");
  await fs.writeFile(
    path.join(input, "linux-x64", path.basename(linux.url)),
    "corrupt",
  );
  const incomplete = path.join(root, "incomplete");
  await assert.rejects(
    buildDistribution(
      input,
      incomplete,
      version,
      "https://studio.example.com/desktop-updates",
    ),
    /checksum or size/,
  );
  await assert.rejects(fs.access(path.join(incomplete, "latest.json")), {
    code: "ENOENT",
  });
});
