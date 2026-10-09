const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { promoteResources } = require("../scripts/promote-plasmic-resources.cjs");

test("failed verifier tests block resource packaging before artifacts are written", { skip: process.platform === "win32" }, async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-gate-test-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  // Simulate the verifier test command failing; the builder must propagate it.
  const bin = path.join(temporary, "bin");
  await fs.mkdir(bin);
  await fs.writeFile(path.join(bin, "python3"), "#!/bin/sh\nexit 19\n", { mode: 0o755 });
  const output = path.join(temporary, "output");
  const result = spawnSync(process.execPath, [path.resolve(__dirname, "../../scripts/build-plasmic-resources.mjs"), "--output", output], {
    env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH }, encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /python3/);
  await assert.rejects(fs.access(output));
});

test("NAS promotion verifies downloads, is idempotent and keeps latest on failed upload", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-nas-test-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const { buildResources } = await import("../../scripts/build-plasmic-resources.mjs");
  const { releaseId } = await import("../../packages/plasmic-cli/src/protocol.mjs");
  const built = await buildResources(path.join(temporary, "incoming"));
  const root = path.join(temporary, "nas");
  await promoteResources(root, built.output, built.manifest);
  const latest = await fs.readFile(path.join(root, "latest.json"), "utf8");
  assert.equal(JSON.parse(latest).releaseId, built.manifest.releaseId);
  assert.deepEqual(await fs.readFile(path.join(root, "releases", built.manifest.releaseId, "plasmic-cli.tgz")), await fs.readFile(path.join(built.directory, "plasmic-cli.tgz")));
  await promoteResources(root, built.output, built.manifest);
  assert.equal(await fs.readFile(path.join(root, "latest.json"), "utf8"), latest);
  const invalid = structuredClone(built.manifest);
  invalid.version = built.manifest.version.replace(/\d+$/, (patch) => String(Number(patch) + 1));
  invalid.artifacts.resources.sha256 = "0".repeat(64);
  invalid.releaseId = releaseId(invalid);
  await fs.cp(built.directory, path.join(built.output, "releases", invalid.releaseId), { recursive: true });
  await assert.rejects(promoteResources(root, built.output, invalid), /checksum/);
  assert.equal(await fs.readFile(path.join(root, "latest.json"), "utf8"), latest);
  await assert.rejects(fs.access(path.join(root, "releases", invalid.releaseId)));
  await assert.rejects(fs.access(path.join(root, ".publish-lock")));
  const conflict = structuredClone(built.manifest);
  conflict.artifacts.resources.sha256 = "1".repeat(64);
  conflict.releaseId = releaseId(conflict);
  await assert.rejects(promoteResources(root, built.output, conflict), /already published with different resources/);
  const downgrade = structuredClone(built.manifest);
  downgrade.version = "0.0.33";
  downgrade.releaseId = releaseId(downgrade);
  await assert.rejects(promoteResources(root, built.output, downgrade), /downgrade/);
  await fs.writeFile(path.join(root, "releases", built.manifest.releaseId, "plasmic-cli.tgz"), "corrupt");
  await assert.rejects(promoteResources(root, built.output, built.manifest), /immutable release is corrupt/);
  assert.equal(await fs.readFile(path.join(root, "latest.json"), "utf8"), latest);
});
