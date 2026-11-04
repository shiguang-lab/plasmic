// Isolated synthetic workloads against production functions. No app/profile/network.
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { fork } = require("node:child_process");
const { Worker, isMainThread, parentPort } = require("node:worker_threads");
const { performance } = require("node:perf_hooks");
const { createHash } = require("node:crypto");
const assert = require("node:assert/strict");
require("../fixtures/background.cjs");
const { setTimeout: delay } = require("node:timers/promises");
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const scope = { origin: "https://offline.invalid", userId: "fixture", projectId: "project", branchId: null };
let store, cache, rpc, closeRpc;

async function execute(spec, input) {
  switch (spec.kind) {
    case "trace": return require("../../src/raster-vector.cjs").tracePng(Buffer.from(input));
    case "vector": return require("../../src/vector.cjs").makeVector(input);
    case "preview": return require("../../src/image-preview.cjs").encodeImagePreview(Buffer.from(input));
    case "pdf": {
      const { PDFDocument } = require("pdf-lib");
      const merged = await PDFDocument.create();
      for (let i = 0; i < spec.pages; i++) {
        const document = await PDFDocument.load(input);
        for (const page of await merged.copyPages(document, document.getPageIndices())) merged.addPage(page);
      }
      return { pages: merged.getPageCount(), bytes: (await merged.save()).length };
    }
    case "draft-write":
      store ||= new (require("../../src/drafts.cjs").DesktopDraftStore)(spec.directory);
      // Mutate the fixture outside the store; its production boundary uses JSON.
      { const draft = JSON.parse(input); draft.sequence = spec.sequence; await store.write(scope, new TextEncoder().encode(JSON.stringify(draft))); return { saved: true }; }
    case "draft-read":
      store ||= new (require("../../src/drafts.cjs").DesktopDraftStore)(spec.directory);
      return JSON.parse(new TextDecoder().decode(await store.read(scope, spec.id)));
    case "draft-list":
      store ||= new (require("../../src/drafts.cjs").DesktopDraftStore)(spec.directory);
      return store.list(scope, true);
    case "export": {
      const result = await require("../../src/code-export.cjs").writeCodeBundle(spec.target, input);
      return { ...result, path: "<private-output>" };
    }
    case "blockmap": {
      const map = require("../../src/update-download.cjs").parseBlockmap(Buffer.from(input), spec.archiveSize);
      const { computeOperations } = require("electron-updater/out/differentialDownloader/downloadPlanBuilder");
      const next = structuredClone(map);
      next.files[0].checksums = next.files[0].checksums.map((sum, i) => i % 7 ? sum : "changed" + sum);
      return computeOperations(map, next, { info() {}, warn() {} });
    }
    case "cache": {
      // Exercise the real disk store via its existing owner; no remote fetch.
      cache ||= new (require("../../src/library-cache.cjs").LibraryCache)({ directory: spec.directory, buildId: "fixture" });
      const s = { ...scope, buildId: "fixture" };
      if (spec.action === "write") { await cache.store.write(s, "code", "fixture", Buffer.from(input), {}, () => {}); return { saved: true }; }
      const value = await cache.store.read(s, "code", "fixture", () => {});
      assert.ok(value); return value.body;
    }
    case "rpc": {
      rpc ||= require("../../src/local-rpc.cjs");
      closeRpc ||= await rpc.startRpc(spec.directory, async () => input);
      return rpc.requestRpc(spec.directory, "fixture", {});
    }
    case "rpc-linear-client": {
      rpc ||= require("../../src/local-rpc.cjs");
      closeRpc ||= await rpc.startRpc(spec.directory, async () => input);
      const address = JSON.parse(await fs.readFile(path.join(spec.directory, "mcp-connection.json"), "utf8"));
      // Diagnostic client only: accumulate chunks once instead of rescanning the
      // entire accumulated string on every chunk in the existing Node client.
      return new Promise((resolve, reject) => {
        const socket = require("node:net").createConnection(address.socket);
        const chunks = []; let bytes = 0;
        socket.on("error", reject);
        socket.on("connect", () => socket.write(JSON.stringify({ token: address.token, method: "fixture", input: {} }) + "\n"));
        socket.on("data", chunk => { bytes += chunk.length; chunks.push(chunk); if (bytes > 32 * 1048576) socket.destroy(Error("Response limit")); });
        socket.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks, bytes)).result); } catch (error) { reject(error); } });
      });
    }
    default: throw Error("Unknown scenario: " + spec.kind);
  }
}

if (!isMainThread) {
  parentPort.on("message", async ({ spec, input }) => {
    try { parentPort.postMessage({ result: await execute(spec, input) }); }
    catch (error) { parentPort.postMessage({ error: error.stack }); }
  });
  parentPort.postMessage({ ready: true });
} else if (process.argv[2] === "--child") {
  process.once("message", async ({ spec, input, mode }) => {
    try {
      // Buffer JSON is converted by advanced IPC serialization; retain raw bytes.
      const samples = []; let worker;
      const memoryBefore = process.memoryUsage();
      // monitorEventLoopDelay.reset() can miss a fully synchronous microtask
      // stall; an armed heartbeat is also validated with a 100ms busy-loop.
      let lastBeat = performance.now(), maxDelay = 0;
      const heartbeat = setInterval(() => { const now = performance.now(); maxDelay = Math.max(maxDelay, now - lastBeat - 1); lastBeat = now; }, 1);
      await delay(20); maxDelay = 0;
      const controlStart = performance.now(); while (performance.now() - controlStart < 100) {}
      await delay(10);
      const positiveControlMs = maxDelay;
      assert.ok(positiveControlMs >= 90, "Heartbeat must detect synchronous blocking");
      for (let round = 0; round < 4; round++) {
        const current = { ...spec, sequence: round + 1, target: spec.directory + "/export-" + round };
        await delay(20); maxDelay = 0;
        const cpuStart = process.cpuUsage(), started = performance.now();
        let result;
        if (mode === "main") result = await execute(current, input);
        else {
          if (!worker) {
            worker = new Worker(__filename);
            await new Promise((resolve, reject) => { worker.once("message", resolve); worker.once("error", reject); });
          }
          result = await new Promise((resolve, reject) => {
            worker.once("message", message => message.error ? reject(Error(message.error)) : resolve(message.result));
            worker.postMessage({ spec: current, input });
          });
        }
        const ms = performance.now() - started, cpu = process.cpuUsage(cpuStart);
        // Let the timer observe synchronous stalls before resetting the histogram.
        await delay(10);
        const memory = process.memoryUsage();
        let digest;
        if (spec.kind === "export") {
          const contents = await Promise.all(result.files.map(async name => [name, hash(await fs.readFile(path.join(current.target, name)))]));
          digest = hash(JSON.stringify(contents));
        } else if (Buffer.isBuffer(result) || result instanceof Uint8Array) digest = hash(result);
        else digest = hash(JSON.stringify(result));
        samples.push({ round, cold: round === 0, ms, cpuMs: (cpu.user + cpu.system) / 1000,
          maxLoopDelayMs: maxDelay, rssMiB: memory.rss / 1048576,
          heapUsedMiB: memory.heapUsed / 1048576, digest });
      }
      await worker?.terminate(); await closeRpc?.(); clearInterval(heartbeat);
      process.send({ samples, positiveControlMs, memoryBefore, maxRssKiB: process.resourceUsage().maxRSS }, () => process.exit());
    } catch (error) { process.send({ error: error.stack }, () => process.exit(1)); }
  });
} else if (require.main === module) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}

function draft(mib, id) {
  // Many modest objects, not one giant compressible string; Chinese text and references.
  const map = {};
  const text = "客户名称、金额与状态 ".repeat(8);
  for (let i = 0; i < Math.ceil(mib * 1048576 / 400); i++) map[i] = { __type: "FixtureNode", name: "Item" + i, text, children: ["1", "2"] };
  return { id, format: 1, projectId: scope.projectId, branchId: null, baseRevision: 1, sequence: 1, savedAt: 1, projectName: "离线夹具", bundle: { map }, dependencies: [] };
}
async function main() {
  const output = path.resolve(process.argv[2] || "/tmp/plasmic-node-candidates.json");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "plasmic-candidates-"));
  const specs = [];
  const add = (name, kind, input, extra = {}) => specs.push({ name, kind, input, ...extra });
  const { PNG } = require("pngjs");
  for (const size of [256, 1024, 2048]) {
    const png = new PNG({ width: size, height: size });
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      png.data[i] = ((x >> 4) * 37 + (y >> 5) * 11) % 256;
      png.data[i + 1] = ((y >> 4) * 53 + (x >> 5) * 7) % 256;
      png.data[i + 2] = ((x + y) >> 3) % 256; png.data[i + 3] = 255;
    }
    const bytes = PNG.sync.write(png);
    if (size <= 1024) add("trace-" + size, "trace", bytes, { pixels: size * size });
    if (size >= 1024) add("preview-" + size, "preview", bytes, { pixels: size * size });
  }
  for (const count of [2, 64]) add("vector-" + count, "vector", {
    width: 1000, height: 1000, operation: "unite", fill: "#123456",
    paths: Array.from({ length: count }, (_, i) => { const x = (i % 8) * 35 + 10, y = Math.floor(i / 8) * 35 + 10; return `M${x} ${y}c0 -40 70 -40 70 0s-70 40 -70 0z`; }),
  }, { paths: count });
  const { PDFDocument, StandardFonts } = require("pdf-lib");
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([800, 600]);
  for (let i = 0; i < 40; i++) page.drawText("Offline PDF fixture: " + i, { x: 20, y: 580 - i * 14, size: 10, font });
  const pdfBytes = await pdf.save();
  for (const pages of [10, 100]) add("pdf-" + pages, "pdf", pdfBytes, { pages });
  const id = "00000000-0000-4000-8000-000000000001";
  const draftJson = JSON.stringify(draft(16, id));
  add("draft-write", "draft-write", draftJson, { payloadBytes: Buffer.byteLength(draftJson) });
  add("draft-read", "draft-read", null, { id, payloadBytes: Buffer.byteLength(draftJson) });
  add("draft-list", "draft-list", null, { count: 8 });
  for (const count of [20, 200]) {
    const bundle = { components: Array.from({ length: count }, (_, i) => ({
      id: "component" + i, componentName: "Page" + i,
      renderModuleFileName: "PlasmicPage" + i + ".tsx", renderModule: "/* generated fixture */\n".repeat(1024) + "export default function Page(){return <div/>}",
      skeletonModuleFileName: "Page" + i + ".tsx", skeletonModule: "export { default } from './PlasmicPage" + i + "';",
      cssFileName: "Page" + i + ".css", cssRules: ".item{color:red;margin:4px;}\n".repeat(1024),
    })) };
    add("export-" + count, "export", bundle, { payloadBytes: Buffer.byteLength(JSON.stringify(bundle)), components: count });
  }
  for (const count of [4096, 65536]) {
    const file = { name: "archive", offset: 0, sizes: Array(count).fill(32768), checksums: Array.from({ length: count }, (_, i) => createHash("sha256").update(String(i)).digest("base64")) };
    const raw = Buffer.from(JSON.stringify({ version: "2", files: [file] }));
    add("blockmap-" + count, "blockmap", require("node:zlib").gzipSync(raw), { archiveSize: count * 32768, rawBytes: raw.length });
  }
  for (const mib of [8, 32]) {
    const bytes = Buffer.alloc(mib * 1048576, 65);
    add("cache-write-" + mib, "cache", bytes, { action: "write", payloadBytes: bytes.length });
    add("cache-read-" + mib, "cache", bytes, { action: "read", payloadBytes: bytes.length });
  }
  for (const mib of [0, 8]) {
    add("rpc-" + mib, "rpc", { text: "x".repeat(mib * 1048576) }, { payloadBytes: mib * 1048576 });
    add("rpc-linear-" + mib, "rpc-linear-client", { text: "x".repeat(mib * 1048576) }, { payloadBytes: mib * 1048576 });
  }
  const report = { runtime: process.versions, platform: process.platform, arch: process.arch, cpu: os.cpus()[0].model,
    method: "Synthetic production-function microbenchmarks; one fresh process per case/mode; cold then 3 warm operations; serial; no forced GC; worker full input/output structured clone; OS file cache uncontrolled. RSS is total process working set, not physical footprint or App total. Timer max is scheduling delay, not UI frame time.", cases: [] };
  try {
    for (const fixture of specs) {
      const entry = { ...fixture }; delete entry.input; entry.modes = {};
      for (const mode of ["main", "worker"]) {
        const directory = path.join(root, fixture.name + "-" + mode); await fs.mkdir(directory);
        if (fixture.kind === "draft-read" || fixture.kind === "draft-list") {
          const writer = new (require("../../src/drafts.cjs").DesktopDraftStore)(directory);
          for (let i = 1; i <= (fixture.kind === "draft-list" ? 8 : 1); i++) {
            const d = fixture.kind === "draft-read" ? JSON.parse(draftJson) : draft(8, id.slice(0, -1) + i);
            await writer.write(scope, new TextEncoder().encode(JSON.stringify(d)));
          }
          await writer.close();
        }
        if (fixture.kind === "cache" && fixture.action === "read") {
          const owner = new (require("../../src/library-cache.cjs").LibraryCache)({ directory, buildId: "fixture" });
          await owner.store.write({ ...scope, buildId: "fixture" }, "code", "fixture", fixture.input, {}, () => {});
        }
        const spec = { ...fixture, directory }; delete spec.input;
        entry.modes[mode] = await new Promise((resolve, reject) => {
          const child = fork(__filename, ["--child"], { serialization: "advanced", stdio: ["ignore", "inherit", "inherit", "ipc"] });
          let result; const timeout = setTimeout(() => { child.kill(); reject(Error("Case timeout: " + fixture.name)); }, 120000);
          child.on("message", value => { result = value; });
          child.on("error", reject);
          child.on("exit", code => { clearTimeout(timeout); code || result?.error ? reject(Error(result?.error || "Child exit " + code)) : resolve(result); });
          child.send({ spec, input: fixture.input, mode });
        });
      }
      const mainHashes = entry.modes.main.samples.map(s => s.digest), workerHashes = entry.modes.worker.samples.map(s => s.digest);
      assert.deepEqual(workerHashes, mainHashes, fixture.name + " output parity"); entry.parity = true;
      report.cases.push(entry);
      await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, JSON.stringify(report, null, 2));
      console.log(fixture.name + " verified");
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}
