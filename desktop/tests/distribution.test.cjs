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
  for (const target of releaseTargets) {
    const dir = path.join(input, `${target.platform}-${target.arch}`);
    await fs.mkdir(dir, { recursive: true });
    const filename = `Plasmic-${version}-${target.platform}-${target.arch}${target.extension}`;
    await fs.writeFile(path.join(dir, filename), bytes);
    await fs.writeFile(
      path.join(dir, manifestNames[target.platform]),
      YAML.stringify({
        version,
        files: [{ url: filename, size: bytes.length, sha512 }],
      }),
    );
  }
  const manifest = await buildDistribution(
    input,
    output,
    version,
    "https://studio.example.com/desktop-updates",
  );
  assert.equal(manifest.installers.length, 3);
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
  const linux = manifest.installers[2];
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
