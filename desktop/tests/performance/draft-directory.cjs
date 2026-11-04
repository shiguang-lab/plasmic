// Real model payloads, private files, no credentials/network or product writes.
// Node-only transport double; use native-series for actual Electron timing.
require("../fixtures/background.cjs");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { performance } = require("node:perf_hooks");
const assert = require("node:assert/strict");

async function main() {
  const [baseline, fixture, output] = process.argv.slice(2);
  if (!baseline || !fixture || !output) throw Error("Required: baseline desktop/src, private fixture, private output directory");
  await fs.mkdir(output, { recursive: true, mode: 0o700 });
  const read = async file => JSON.parse(await fs.readFile(path.join(fixture, file), "utf8"));
  const opening = await read("project-response.json"), resources = await read("model-resources.json");
  const { DesktopDraftStore: Before } = require(path.join(path.resolve(baseline), "drafts.cjs"));
  const { DesktopDraftStore: After } = require("../../src/drafts.cjs");
  const directory = path.join(output, "drafts"), writer = new Before(directory);
  const scope = { origin: "https://offline.invalid", userId: "fixture", projectId: opening.project.id, branchId: null };
  const payload = {
    format: 1, branchId: null, projectName: "Offline fixture", baseRevision: opening.rev.revision,
    sequence: 1, savedAt: 1, modelVersion: opening.modelVersion, hostlessDataVersion: opening.hostlessDataVersion,
    bundle: JSON.parse(opening.rev.data),
    dependencies: opening.depPkgs.map(pkg => ({ id: pkg.id, model: JSON.parse(resources["/api/v1/dependency-models/" + pkg.modelResourceId].body) })),
  };
  for (let i = 0; i < 17; i++) {
    const projectId = i === 0 ? scope.projectId : "unrelated-" + i;
    await writer.write({ ...scope, projectId }, { ...payload, id: randomUUID(), projectId });
  }
  const result = { scope: "In-process draft directory; empty summary cache, OS filesystem cache uncontrolled; not editor startup timing", fileCount: 17, samples: [] };
  for (const variant of ["before", "after", "after", "before"]) {
    for (const scenario of ["empty-project", "one-project", "all-projects"]) {
      const Store = variant === "before" ? Before : After, store = new Store(directory);
      const wanted = scenario === "empty-project" ? { ...scope, projectId: "no-drafts" } : scope;
      let reads = 0;
      if (store.readDraft) {
        const readDraft = store.readDraft.bind(store);
        store.readDraft = async file => { reads++; return readDraft(file); };
      }
      const start = performance.now(), entries = await store.list(wanted, scenario === "all-projects");
      const ms = performance.now() - start;
      assert.equal(entries.length, scenario === "all-projects" ? 17 : scenario === "empty-project" ? 0 : 1);
      reads = store.readDraft ? reads : store.summaries.size;
      const coldReads = reads, warmStart = performance.now();
      const again = await store.list(wanted, scenario === "all-projects");
      assert.deepEqual(again, entries);
      result.samples.push({ variant, scenario, ms, coldReads, warmMs: performance.now() - warmStart, warmReads: store.readDraft ? reads - coldReads : store.summaries.size - coldReads });
      await store.close?.();
    }
  }
  result.bytes = (await Promise.all((await fs.readdir(writer.scope(scope))).map(async file => (await fs.stat(path.join(writer.scope(scope), file))).size))).reduce((a,b) => a+b, 0);
  await fs.writeFile(path.join(output, "draft-directory.json"), JSON.stringify(result, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(result));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
