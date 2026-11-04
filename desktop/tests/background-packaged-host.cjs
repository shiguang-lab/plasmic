const { app } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const { BackgroundWorker } = require("./src/background-worker.cjs");
const { DesktopDraftStore } = require("./src/drafts.cjs");
let graph, store;
app.setPath("userData", process.env.PLASMIC_BACKGROUND_PROFILE);
app.whenReady().then(async () => {
  assert.equal(app.isPackaged, true);
  graph = new BackgroundWorker({ name: "Plasmic Graphics" });
  store = new DesktopDraftStore(path.join(app.getPath("userData"), "drafts"));
  const result = await graph.run("vector", { width: 100, height: 100, paths: ["M0 0h40v40h-40z", "M20 0h40v40h-40z"], operation: "unite" });
  assert.equal(result.area, 2400);
  const scope = { origin: "https://offline.test", userId: "fixture", projectId: "project", branchId: null };
  const value = { id: "00000000-0000-4000-8000-000000000001", format: 1, projectId: "project", branchId: null,
    baseRevision: 1, sequence: 1, savedAt: 1, bundle: { map: { root: { text: "客户😀" } } }, dependencies: [] };
  await store.write(scope, new TextEncoder().encode(JSON.stringify(value)));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(await store.read(scope, value.id))), value);
  const pids = [store.worker.worker.pid, graph.worker.pid];
  if (process.env.PLASMIC_BACKGROUND_CRASH_PROBE === "1") {
    await fs.writeFile(path.join(app.getPath("userData"), "ready.json"), JSON.stringify({ pids }));
    return;
  }
  await store.close(); await graph.close();
  await fs.writeFile(path.join(app.getPath("userData"), "result.json"), JSON.stringify({ pass: true, pids }));
  app.exit(0);
}).catch(async error => { console.error(error); await store?.close(); await graph?.close(); app.exit(1); });
