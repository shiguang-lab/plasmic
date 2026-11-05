// Explicit offline acceptance probe; needs the prepared pinned native runtime.
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { ComponentEmbedding, MODEL } = require("../../src/component-embedding.cjs");
const { ComponentReuse, hash } = require("../../src/component-reuse.cjs");
const repo = path.resolve(__dirname, "../../..");
const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const scope = { account: hash("offline-frozen-fixture"), project: "offline-component-fixture" };
const runtime = path.join(repo, "desktop/component-reuse-runtime", process.platform + "-" + process.arch);
function rss(pid) { try { return Number(execFileSync("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf8" }).trim()) * 1024; } catch { return null; } }
const checkpoint = embedding => ({ nodeRssBytes: process.memoryUsage().rss, nativeRssBytes: embedding.child ? rss(embedding.child.pid) : 0 });
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
async function ready(service) {
  const deadline = Date.now() + 180000;
  while (service.coverage().indexed < service.coverage().total) {
    if (service.failure) throw service.failure;
    if (Date.now() > deadline) throw new Error("Native index probe exceeded 180 seconds");
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
async function main() {
  const raw = await fs.readFile(path.join(repo, "docs/design/component-reuse-evidence/data.json")); const data = JSON.parse(raw);
  const docs = data.corpus.map(item => ({ componentUuid: item.id, name: item.name, fromProject: "frozen-document-fixture", version: "1", description: "", sections: [item.text], props: [], slots: [], events: [] }));
  if (args.includes("--changed")) docs[0].sections[0] += "\nNew registered event: onCommit(values).";
  const directory = option("--cache") ?? await fs.mkdtemp(path.join(os.tmpdir(), "component-reuse-native-"));
  let embedding = new ComponentEmbedding(runtime); let service = new ComponentReuse({ directory, embedding });
  const report = { measuredAt: new Date().toISOString(), cacheDirectory: directory, corpusSha256: hash(raw), model: MODEL, platform: process.platform, arch: process.arch, baselineMemory: checkpoint(embedding), limitations: [
    "Standalone production Node/native/cache/search path, not the installed Electron UI, MCP round trip or frame-rate acceptance.",
    "Same manually labeled 101 repository documentation fragments and 41 queries as prior pilot; not full live installed contracts or independent holdout.",
    "RSS phase checkpoints via ps; not a continuous peak or private physical footprint. OS disk cache not cleared.",
    "Native build uses GGML_NATIVE=OFF for distribution; CPU 2 threads, no GPU. Quality includes production fragmenting, threshold and keyword/embedding fusion.",
  ] };
  try {
    let started = performance.now(); const coverage = await service.sync(scope, docs);
    if (args.includes("--warm-only")) {
      Object.assign(report, { cacheLoadMs: performance.now() - started, coverage, counters: service.stats, nativeStarted: !!embedding.child });
    } else {
      report.coldCatalogueMs = performance.now() - started;
      await ready(service); report.coldIndexMs = performance.now() - started; report.coldCounters = { ...service.stats }; report.afterIndexMemory = checkpoint(embedding);
      console.log(JSON.stringify({ phase: "cold-index-ready", elapsedMs: report.coldIndexMs, ...report.coldCounters }));
      const results = [];
      for (const item of data.cases) {
        const region = { componentUuid: "owning-page", elementUuid: item.id, intent: item.intent, usedComponentUuids: [], facts: [] };
        const result = await service.review(scope, [region]);
        const candidates = result.suggestions[0]?.candidates ?? [];
        results.push({ id: item.id, expected: item.expected, status: result.status, elapsedMs: result.elapsedMs, candidates,
          hit: item.expected.length ? candidates.some(candidate => item.expected.includes(candidate.componentUuid)) : null });
      }
      report.retrieval = { positiveCases: results.filter(row => row.expected.length).length, hitAt3: results.filter(row => row.hit).length, negativeCases: results.filter(row => !row.expected.length).length,
        negativeSuggestions: results.filter(row => !row.expected.length && row.candidates.length).map(row => row.id), results };
      const before = service.stats.documentEmbeddings; const changed = docs.map((doc, index) => index === 0 ? { ...doc, sections: [doc.sections[0] + "\nNew registered event: onCommit(values)."] } : doc);
      started = performance.now(); await service.sync(scope, changed); await ready(service);
      report.incremental = { elapsedMs: performance.now() - started, documentEmbeddings: service.stats.documentEmbeddings - before };
      await service.close();
      const warm = [];
      for (let i = 0; i < 3; i++) {
        const file = path.join(directory, "warm-" + i + ".json");
        execFileSync(process.execPath, [__filename, "--warm-only", "--changed", "--cache", directory, "--report", file], { stdio: "pipe" });
        warm.push(JSON.parse(await fs.readFile(file, "utf8")));
      }
      report.warmReopen = warm.map(row => ({ cacheLoadMs: row.cacheLoadMs, ...row.coverage, ...row.counters, nativeStarted: row.nativeStarted }));
      embedding = new ComponentEmbedding(runtime); service = new ComponentReuse({ directory, embedding });
      await service.sync(scope, changed);
      started = performance.now(); await embedding.prepare(); report.runtimeVerificationMs = performance.now() - started;
      const query = item => service.review(scope, [{ componentUuid: "page", elementUuid: item.id, intent: item.intent, usedComponentUuids: [], facts: [] }]);
      const cases = data.cases.filter(item => item.expected.length).slice(0, 10);
      report.firstCachedQuery = await query(cases[0]); await query(cases[1]);
      const samples = [];
      for (let i = 0; i < 30; i++) { const result = await query(cases[i % cases.length]); samples.push({ id: cases[i % cases.length].id, elapsedMs: result.elapsedMs, status: result.status }); }
      report.warmQuery = { p50Ms: percentile(samples.map(row => row.elapsedMs), .5), p95Ms: percentile(samples.map(row => row.elapsedMs), .95), samples, counters: service.stats, memory: checkpoint(embedding) };
      report.cacheBytes = (await Promise.all((await fs.readdir(path.join(directory, scope.account))).filter(name => name.endsWith(".bin")).map(async name => (await fs.stat(path.join(directory, scope.account, name))).size))).reduce((a, b) => a + b, 0);
    }
  } finally { await service.close(); }
  if (option("--report")) await fs.writeFile(option("--report"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ report: option("--report"), coldIndexMs: report.coldIndexMs, incremental: report.incremental, warmReopen: report.warmReopen, warmQuery: report.warmQuery && { p50Ms: report.warmQuery.p50Ms, p95Ms: report.warmQuery.p95Ms, memory: report.warmQuery.memory }, hitAt3: report.retrieval?.hitAt3, negativeSuggestions: report.retrieval?.negativeSuggestions }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
