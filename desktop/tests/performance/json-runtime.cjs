// Same framed stdio transport in both variants; semantic JSON parity, not a store migration.
const fs = require("node:fs/promises");
const { spawn, execFileSync } = require("node:child_process");
const path = require("node:path");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { gzipSync } = require("node:zlib");
const { createHash } = require("node:crypto");

if (process.argv[2] === "--child") {
  process.stdout.write("R");
  let chunks = [], bytes = 0, expected;
  process.stdin.on("data", chunk => {
    chunks.push(chunk); bytes += chunk.length;
    if (expected === undefined && bytes >= 4) {
      const merged = Buffer.concat(chunks, bytes); chunks = [merged]; expected = merged.readUInt32BE(0) + 4;
    }
    if (expected !== undefined && bytes === expected) {
      const input = Buffer.concat(chunks, bytes).subarray(4);
      const result = Buffer.from(JSON.stringify(JSON.parse(input)));
      const header = Buffer.alloc(4); header.writeUInt32BE(result.length);
      process.stdout.write(header); process.stdout.write(result);
      chunks = []; bytes = 0; expected = undefined;
    }
  });
} else {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}

async function main() {
  const [binary, output] = process.argv.slice(2);
  assert.ok(binary && output, "Usage: json-runtime.cjs <diagnostic-go-binary> <output.json>");
  const map = {};
  for (let i = 0; i < 40000; i++) map[i] = { __type: "FixtureNode", name: "Item" + i, text: "客户名称、金额与状态 ".repeat(8), children: ["1", "2"] };
  const payload = { format: 1, sequence: 42, baseRevision: 1, bundle: { map }, dependencies: [] };
  const input = Buffer.from(JSON.stringify(payload)), header = Buffer.alloc(4); header.writeUInt32BE(input.length);
  const report = { inputBytes: input.length, nodeVersion: process.version,
    goVersion: execFileSync("go", ["version"], { encoding: "utf8" }).trim(),
    scope: "Parse to a generic object tree then serialize; identical framed stdio; 2 fresh processes per runtime in ABBA order, cold + 3 warm; no disk/draft durability/IPC/account checks. Go UseNumber preserves numeric spellings; semantic parity on this synthetic fixture only, not JS serialization compatibility proof. RSS is process working set, not physical footprint.", samples: [] };
  for (const runtime of ["node", "go", "go", "node"]) {
    const started = performance.now();
    const child = spawn(runtime === "node" ? process.execPath : binary, runtime === "node" ? [__filename, "--child"] : [], { stdio: ["pipe", "pipe", "inherit"] });
    let ready = false, chunks = [], bytes = 0, expected, response;
    let resolveReady, rejectReady;
    const readyPromise = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const timeout = setTimeout(() => { child.kill(); rejectReady(Error("Diagnostic timeout")); response?.reject(Error("Diagnostic timeout")); }, 120000);
    child.on("error", error => { rejectReady(error); response?.reject(error); });
    child.stdout.on("data", chunk => {
      if (!ready) { assert.equal(chunk[0], 82); ready = true; resolveReady(); chunk = chunk.subarray(1); if (!chunk.length) return; }
      chunks.push(chunk); bytes += chunk.length;
      if (expected === undefined && bytes >= 4) {
        const merged = Buffer.concat(chunks, bytes); chunks = [merged]; expected = merged.readUInt32BE(0) + 4;
      }
      if (expected !== undefined && bytes === expected) {
        const result = Buffer.concat(chunks, bytes).subarray(4);
        chunks = []; bytes = 0; expected = undefined;
        response.resolve(result); response = undefined;
      }
    });
    try {
      await readyPromise;
      const startupMs = performance.now() - started;
      const samples = [];
      for (let round = 0; round < 4; round++) {
        const start = performance.now();
        const promise = new Promise((resolve, reject) => { response = { resolve, reject }; });
        child.stdin.write(header); child.stdin.write(input);
        const result = await promise;
        const ms = performance.now() - start;
        assert.deepEqual(JSON.parse(result), payload);
        const rssKiB = Number(execFileSync("ps", ["-p", String(child.pid), "-o", "rss="], { encoding: "utf8" }).trim());
        samples.push({ round, ms, rssKiB, outputBytes: result.length });
      }
      report.samples.push({ runtime, startupMs, samples });
    } finally { clearTimeout(timeout); const exited = once(child, "exit"); child.stdin.end(); await exited; }
  }
  const bytes = await fs.readFile(binary);
  report.goBinary = { bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length, sha256: createHash("sha256").update(bytes).digest("hex") };
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
