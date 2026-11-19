const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { gunzipSync } = require("node:zlib");
const asar = require("@electron/asar");
const { buildBlockMap } = require("app-builder-lib/out/targets/blockmap/blockmap");
const { computeOperations, OperationKind } = require("electron-updater/out/differentialDownloader/downloadPlanBuilder");

test("macOS update ZIP localizes an early ASAR edit and preserves executable modes and links", { skip: process.platform !== "darwin" }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zip-layout-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const files = path.join(root, "inputs");
  const resources = path.join(root, "Plasmic.app/Contents/Resources");
  await fs.mkdir(resources, { recursive: true });
  await fs.mkdir(files);
  const name = path.join(resources, "app.asar");
  const helper = path.join(resources, "helper");
  await fs.writeFile(helper, "helper", { mode: 0o755 });
  await fs.symlink("helper", path.join(resources, "link"));
  const payload = createHash("shake256", { outputLength: 4 * 1024 * 1024 }).update("zip fixture").digest();
  const maps = [];
  for (let version = 0; version < 2; version++) {
    payload[16] = version;
    await fs.writeFile(path.join(files, "large"), payload);
    await asar.createPackage(files, name);
    const archive = path.join(root, version + ".zip");
    execFileSync("/usr/bin/zip", ["-qry", archive, "Plasmic.app"], { cwd: root });
    execFileSync("go", ["run", path.join(__dirname, "../scripts/mac-update-zip.go"), archive]);
    await buildBlockMap(archive, "gzip", archive + ".blockmap");
    maps.push(JSON.parse(gunzipSync(await fs.readFile(archive + ".blockmap"))));
    const dest = path.join(root, "extracted");
    execFileSync("/usr/bin/ditto", ["-x", "-k", archive, dest]);
    const extracted = path.join(dest, "Plasmic.app/Contents/Resources");
    assert.deepEqual(await fs.readFile(path.join(extracted, "app.asar")), await fs.readFile(name));
    assert.equal(await fs.readlink(path.join(extracted, "link")), "helper");
    assert.equal((await fs.stat(path.join(extracted, "helper"))).mode & 0o777, 0o755);
    await fs.rm(dest, { recursive: true });
  }
  const bytes = computeOperations(...maps, { info() {}, warn() {} })
    .filter(op => op.kind === OperationKind.DOWNLOAD).reduce((sum, op) => sum + op.end - op.start, 0);
  assert(bytes > 0 && bytes < 512 * 1024, `Expected one changed segment and ZIP metadata, got ${bytes} bytes`);
});
