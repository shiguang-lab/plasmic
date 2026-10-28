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

test("one build process retries a failed verifier and shares a successful suite across artifacts", async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-verifier-reuse-"));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const script = `
    const assert = require('node:assert/strict');
    const cp = require('node:child_process');
    const real = cp.execFileSync;
    let checks = 0;
    cp.execFileSync = (command, ...args) => {
      if (command === 'python3') {
        checks++;
        if (checks === 1) throw new Error('fixture verifier failed');
        return '';
      }
      return real(command, ...args);
    };
    require('node:module').syncBuiltinESMExports();
    (async () => {
      const { buildResources } = await import(${JSON.stringify(require("node:url").pathToFileURL(path.resolve(__dirname, "../../scripts/build-plasmic-resources.mjs")).href)});
      const output = ${JSON.stringify(temporary)};
      await assert.rejects(buildResources(output), /fixture verifier failed/);
      const first = await buildResources(output);
      const second = await buildResources(output);
      assert.equal(checks, 2, 'failed verification retries; successful verification is reused');
      assert.deepEqual(first.manifest, second.manifest, 'repeated artifacts retain all hashes and metadata');
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `;
  const result = spawnSync(process.execPath, ["-e", script], { encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
});
