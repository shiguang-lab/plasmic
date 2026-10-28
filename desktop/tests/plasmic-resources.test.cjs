const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");

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
