// Frozen-before vs production-after. Serial synthetic jobs; no user profile/network.
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { fork } = require("node:child_process");
const { createHash } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const assert = require("node:assert/strict");
const scope = { origin: "https://offline.invalid", userId: "fixture", projectId: "project", branchId: null };
const id = "00000000-0000-4000-8000-000000000001";
const hash = value => createHash("sha256").update(value).digest("hex");

if (process.argv[2] === "--child") {
  require("../fixtures/background.cjs");
  process.once("message", async spec => {
    let graphics, store, stop;
    try {
      const load = name => require(path.join(spec.source, name + ".cjs"));
      const samples = []; let heartbeatMax = 0, previous = performance.now();
      const heartbeat = setInterval(() => { const now = performance.now(); heartbeatMax = Math.max(heartbeatMax, now - previous - 1); previous = now; }, 1);
      await delay(20); heartbeatMax = 0;
      const controlStart = performance.now(); while (performance.now() - controlStart < 100) {}
      await delay(10); const controlMs = heartbeatMax; assert.ok(controlMs >= 90);
      const memoryBefore = process.memoryUsage();
      for (let round = 0; round < 4; round++) {
        let input = spec.input;
        if (spec.kind === "draft-write") {
          if (spec.variant === "before") input = spec.input.replace('"sequence":1,', '"sequence":' + (round + 1) + ',');
          else {
            input = Uint8Array.from(spec.input);
            const offset = Buffer.from(input.buffer).indexOf('"sequence":1,') + '"sequence":'.length;
            input[offset] = 49 + round;
          }
        }
        await delay(20); heartbeatMax = 0;
        const cpu = process.cpuUsage(), start = performance.now(); let result;
        if (spec.kind === "trace" || spec.kind === "vector") {
          if (spec.variant === "before") result = spec.kind === "trace" ? load("raster-vector").tracePng(input) : load("vector").makeVector(input);
          else {
            graphics ||= new (load("background-worker").BackgroundWorker)();
            result = await graphics.run(spec.kind, spec.kind === "trace" ? { png: input } : input);
          }
        } else if (spec.kind.startsWith("draft")) {
          store ||= new (load("drafts").DesktopDraftStore)(spec.directory);
          if (spec.kind === "draft-write") { await store.write(scope, spec.variant === "before" ? JSON.parse(input) : input); result = { saved: true }; }
          else if (spec.kind === "draft-read") result = await store.read(scope, id);
          else result = await store.list(scope, true);
        } else if (spec.kind.startsWith("cache")) {
          store ||= new (load("library-cache").LibraryCache)({ directory: spec.directory, buildId: "fixture" });
          if (spec.kind === "cache-write") { await store.store.write({ ...scope, buildId: "fixture" }, "code", "fixture", input, {}, () => {}); result = { saved: true }; }
          else { result = (await store.store.read({ ...scope, buildId: "fixture" }, "code", "fixture", () => {})).body; }
        } else if (spec.kind === "rpc") {
          const rpc = load("local-rpc"); stop ||= await rpc.startRpc(spec.directory, async () => input);
          result = await rpc.requestRpc(spec.directory, "fixture", {});
        }
        const ms = performance.now() - start, used = process.cpuUsage(cpu);
        await delay(10);
        const memory = process.memoryUsage(), maxLoopDelayMs = heartbeatMax;
        // Canonicalize only outside measurement; after reads deliberately return
        // text to the preload, whose public object conversion is tested natively.
        const digest = spec.kind === "draft-read" && spec.variant === "after" ? hash(JSON.stringify(JSON.parse(new TextDecoder().decode(result)))) : hash(Buffer.isBuffer(result) ? result : JSON.stringify(result));
        samples.push({ round, cold: round === 0, ms, cpuMs: (used.user + used.system) / 1000, maxLoopDelayMs,
          rssMiB: memory.rss / 1048576, heapUsedMiB: memory.heapUsed / 1048576, digest });
      }
      if (spec.kind === "draft-write") {
        const bytes = await fs.readFile(store.file(scope, id));
        const original = typeof spec.input === "string" ? spec.input : spec.input.toString("utf8");
        assert.equal(hash(bytes), hash(original.replace('"sequence":1,', '"sequence":4,')));
      }
      if (spec.kind.startsWith("cache")) samples.at(-1).diskBytes = (await store.store.files()).reduce((sum, file) => sum + file.bytes, 0);
      const peakRssKiB = process.resourceUsage().maxRSS;
      await graphics?.close(); if (spec.variant === "after" && spec.kind.startsWith("draft")) await store.close(); await stop?.();
      clearInterval(heartbeat);
      process.send({ samples, controlMs, memoryBefore, peakRssKiB }, () => process.exit());
    } catch (error) { process.send({ error: error.stack }, () => process.exit(1)); }
  });
} else if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

function draft(mib, suffix = "1") {
  const map = {}, text = "客户名称、金额与状态 ".repeat(8);
  for (let i = 0; i < Math.ceil(mib * 1048576 / 400); i++) map[i] = { __type: "FixtureNode", name: "Item" + i, text, children: ["1", "2"] };
  return { id: id.slice(0, -1) + suffix, format: 1, projectId: scope.projectId, branchId: null, baseRevision: 1, sequence: 1, savedAt: 1,
    projectName: "离线夹具", bundle: { map }, dependencies: [] };
}
async function main() {
  const [baseline, output] = process.argv.slice(2); assert.ok(baseline && output, "Usage: node-optimizations.cjs <frozenDesktopRoot> <output.json>");
  const before = path.resolve(baseline, "src"), after = path.resolve(__dirname, "../../src");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-optimization-ab-"));
  const cases = [], add = (name, kind, input, extra = {}) => cases.push({ name, kind, input, ...extra });
  const { PNG } = require("pngjs");
  for (const size of [256, 1024]) {
    const png = new PNG({ width: size, height: size });
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      png.data[i] = ((x >> 4) * 37 + (y >> 5) * 11) % 256;
      png.data[i + 1] = ((y >> 4) * 53 + (x >> 5) * 7) % 256;
      png.data[i + 2] = ((x + y) >> 3) % 256; png.data[i + 3] = 255;
    }
    add("trace-" + size, "trace", PNG.sync.write(png), { pixels: size * size });
  }
  for (const count of [2, 64]) add("vector-" + count, "vector", { width: 1000, height: 1000, operation: "unite", fill: "#123456",
    paths: Array.from({ length: count }, (_, i) => { const x = (i % 8) * 35 + 10, y = Math.floor(i / 8) * 35 + 10; return `M${x} ${y}c0 -40 70 -40 70 0s-70 40 -70 0z`; }) });
  const data = JSON.stringify(draft(16));
  add("draft-write", "draft-write", data, { payloadBytes: Buffer.byteLength(data) });
  add("draft-read", "draft-read", null, { payloadBytes: Buffer.byteLength(data) });
  add("draft-list", "draft-list", null, { count: 8 });
  for (const mib of [8, 32]) for (const kind of ["cache-write", "cache-read"]) add(kind + "-" + mib, kind, Buffer.alloc(mib * 1048576, 65), { payloadBytes: mib * 1048576 });
  for (const mib of [0, 8]) add("rpc-" + mib, "rpc", { text: "x".repeat(mib * 1048576) }, { payloadBytes: mib * 1048576 });
  const report = { runtime: process.versions, platform: process.platform, arch: process.arch, cpu: os.cpus()[0].model,
    method: "Synthetic host-stage production code, no Electron UI timing; 4 fresh child processes per case in before/after/after/before order; each cold then 3 warm. Full hashes checked outside measurement, no forced GC. RSS includes all Worker threads; heapUsed excludes Worker heaps. File cache uncontrolled. Draft after-read returns UTF-8 bytes internally; native preload separately verifies the unchanged public object API.", sources: {}, cases: [] };
  for (const [label, source] of Object.entries({ before, after })) {
    const files = (await fs.readdir(source)).filter(file => file.endsWith(".cjs")).sort();
    report.sources[label] = { path: source, hashes: Object.fromEntries(await Promise.all(files.map(async file => [file, hash(await fs.readFile(path.join(source, file)))]))) };
  }
  try {
    for (const fixture of cases) {
      const entry = { ...fixture, runs: [] }; delete entry.input;
      for (const [index, variant] of ["before", "after", "after", "before"].entries()) {
        const source = variant === "before" ? before : after, directory = path.join(root, fixture.name + "-" + index); await fs.mkdir(directory);
        if (["draft-read", "draft-list"].includes(fixture.kind)) {
          const writer = new (require(path.join(before, "drafts.cjs")).DesktopDraftStore)(directory);
          for (let i = 1; i <= (fixture.kind === "draft-list" ? 8 : 1); i++) await writer.write(scope, fixture.kind === "draft-read" ? JSON.parse(data) : draft(8, String(i)));
        }
        if (fixture.kind === "cache-read") {
          const writer = new (require(path.join(source, "library-cache.cjs")).LibraryCache)({ directory, buildId: "fixture" });
          await writer.store.write({ ...scope, buildId: "fixture" }, "code", "fixture", fixture.input, {}, () => {});
        }
        const result = await new Promise((resolve, reject) => {
          const child = fork(__filename, ["--child"], { serialization: "advanced", stdio: ["ignore", "inherit", "inherit", "ipc"] });
          let result; const timeout = setTimeout(() => { child.kill(); reject(Error("Case timeout: " + fixture.name)); }, 120000);
          child.on("error", reject); child.on("message", value => { result = value; });
          child.on("exit", code => { clearTimeout(timeout); code || result?.error ? reject(Error(result?.error || "Child exit " + code)) : resolve(result); });
          child.send({ ...fixture, input: variant === "after" && fixture.kind === "draft-write" ? Buffer.from(fixture.input) : fixture.input, variant, source, directory });
        });
        entry.runs.push({ variant, ...result });
      }
      const expected = entry.runs[0].samples.map(s => s.digest);
      for (const run of entry.runs) assert.deepEqual(run.samples.map(s => s.digest), expected, fixture.name + " output parity");
      entry.parity = true; report.cases.push(entry);
      await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true }); await fs.writeFile(output, JSON.stringify(report, null, 2));
      console.log(fixture.name + " ABBA verified");
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}
