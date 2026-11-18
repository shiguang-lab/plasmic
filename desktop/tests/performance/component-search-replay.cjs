// Diagnostic bridge for component-search-replay.test.ts. All listeners are loopback only.
const http = require("node:http");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const {
  ComponentCandidates,
  nasComponentSearch,
  hash,
} = require("../../src/component-candidates.cjs");
const searchRoot = path.resolve(
  __dirname,
  "../../../platform/wab/src/wab/server/component-reuse",
);
const publicDocs = require(
  path.join(searchRoot, "component-reuse-public-documents.json"),
);
const [mode, target] = process.argv.slice(2);
if (!["local", "nas", "serve"].includes(mode) || !target)
  throw new Error(
    "Expected local BASELINE_SOURCE_DIR, nas TUNNEL_ORIGIN or serve MODEL_DIR",
  );
// Keep the original Antd/Overseas comparison fixture when a library is not specified.
const libraries = process.env.COMPONENT_REPLAY_LIBRARY
  ? [process.env.COMPONENT_REPLAY_LIBRARY]
  : ["@shiguang-lab/plasmic-antd6", "@shiguang-lab/plasmic-overseas"];
const docs = publicDocs.filter(doc => libraries.includes(doc.fromProject));
if (!docs.length) throw new Error("No public contracts for " + libraries.join(", "));
const scope = {
  account: hash("component-search-replay"),
  project: "component-search-replay",
};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "component-search-replay-"));
const stats = { libraries, catalogueSize: docs.length, checks: 0, syncs: 0, requests: [] };
let service;
let model;
if (mode === "nas") {
  const post = nasComponentSearch({ fetch }, target);
  service = new ComponentCandidates(async (project, body, signal) => {
    const start = performance.now();
    try {
      const result = await post(project, body, signal);
      if (body.command === "sync") stats.coverage = { indexed: result.indexed, total: result.total };
      return result;
    } finally {
      stats.requests.push({
        command: body.command,
        ...(body.command === "search" ? { intent: body.intent } : {}),
        ms: performance.now() - start,
      });
    }
  });
} else {
  const source = mode === "local" ? path.resolve(target) : searchRoot;
  const { ComponentEmbedding } = require(
    path.join(source, "component-embedding.cjs"),
  );
  const runtime =
    mode === "serve" ? target : process.env.COMPONENT_MODEL_DIRECTORY;
  if (!runtime)
    throw new Error("Set COMPONENT_MODEL_DIRECTORY to the baseline runtime");
  model = new ComponentEmbedding(runtime);
  service =
    mode === "local"
      ? new (require(path.join(source, "component-reuse.cjs")).ComponentReuse)({
          directory: dir,
          embedding: model,
        })
      : new (require(
          path.join(source, "search-service.cjs"),
        ).ComponentSearchService)(dir, model);
}
const server = http.createServer(async (req, res) => {
  try {
    let reply;
    if (mode !== "serve" && req.url === "/stats")
      reply = { ...stats, counters: service.stats };
    else {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 4 * 1024 * 1024)
          throw new Error("Replay payload too large");
      }
      const body = JSON.parse(raw);
      if (
        mode === "serve" &&
        req.url === "/api/v1/projects/component-search-replay/component-search"
      ) {
        if (body.command === "sync") reply = await service.sync(scope, body);
        if (body.command === "search")
          reply = await service.search(scope, body, AbortSignal.timeout(5000));
      } else if (mode !== "serve" && req.url === "/command") {
        if (body.command === "sync") {
          stats.syncs++;
          reply = await service.sync(scope, docs, 0, body.retry === true, body.defer === true);
        } else if (body.command === "review") {
          stats.checks++;
          reply = await service.review(scope, body.regions);
        } else reply = {};
      }
    }
    res
      .writeHead(reply ? 200 : 409, { "Content-Type": "application/json" })
      .end(JSON.stringify(reply));
  } catch (error) {
    res.writeHead(500).end(error.message);
  }
});
async function listen() {
  if (mode === "serve") {
    const start = performance.now();
    await service.prepare();
    console.log(JSON.stringify({ servicePreparationMs: performance.now() - start }));
  }
  server.listen(
    Number(process.env.COMPONENT_REPLAY_PORT || (mode === "serve" ? 39045 : 39047)),
    "127.0.0.1",
  );
}
listen().catch(async error => { console.error(error); await model?.close(); process.exitCode = 1; });
process.once("SIGTERM", async () => {
  server.closeAllConnections();
  server.close();
  await model?.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
