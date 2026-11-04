// Minimal real Electron window, production preload/IPC and production-only ASAR
// graphics dependencies. App main footprint includes its Worker threads.
const { app, BrowserWindow, ipcMain, session } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const assert = require("node:assert/strict");
const [variant, desktop, output] = process.argv.slice(2);
let directory, win, store, graphics;
let exitCode = 0;
app.on("window-all-closed", () => {});
const load = name => require(path.resolve(desktop, "src", name + ".cjs"));
const origin = "https://offline.test";
async function memory() {
  const raw = execFileSync("/usr/bin/vmmap", ["-summary", String(process.pid)], { encoding: "utf8" });
  const match = raw.match(/^Physical footprint:\s+([\d.]+)([KMG])/m); assert.ok(match);
  const usage = process.memoryUsage();
  const background = [];
  for (const metric of app.getAppMetrics().filter(metric => /^Plasmic (Background|Graphics|Drafts)$/.test(metric.name || ""))) {
    try {
      const raw = execFileSync("/usr/bin/vmmap", ["-summary", String(metric.pid)], { encoding: "utf8" });
      const footprint = raw.match(/^Physical footprint:\s+([\d.]+)([KMG])/m); assert.ok(footprint);
      background.push({ pid: metric.pid, name: metric.name, footprintMiB: Number(footprint[1]) * ({ K: 1 / 1024, M: 1, G: 1024 }[footprint[2]]) });
    } catch (error) { if (app.getAppMetrics().some(item => item.pid === metric.pid)) throw error; }
  }
  return { mainFootprintMiB: Number(match[1]) * ({ K: 1 / 1024, M: 1, G: 1024 }[match[2]]),
    background, hostAndBackgroundFootprintMiB: Number(match[1]) * ({ K: 1 / 1024, M: 1, G: 1024 }[match[2]]) + background.reduce((sum, item) => sum + item.footprintMiB, 0),
    heapUsedMiB: usage.heapUsed / 1048576, heapTotalMiB: usage.heapTotal / 1048576,
    externalMiB: usage.external / 1048576, arrayBuffersMiB: usage.arrayBuffers / 1048576,
    electronMemoryKiB: await process.getProcessMemoryInfo(),
    mainRssMiB: process.memoryUsage().rss / 1048576,
    rendererRssMiB: Number(execFileSync("ps", ["-p", String(win.webContents.getOSProcessId()), "-o", "rss="], { encoding: "utf8" }).trim()) / 1024 };
}
(async () => {
  assert.ok(["before", "after"].includes(variant) && desktop && output);
  directory = process.env.PLASMIC_BACKGROUND_PROFILE;
  assert.ok(directory, "Run the owning node-optimization-native-series.cjs Node runner");
  app.setPath("userData", directory); app.setPath("sessionData", directory);
  await app.whenReady();
  const partition = session.fromPartition("optimization-native");
  partition.protocol.handle("https", () => new Response("<!doctype html><html><body>Offline fixture</body></html>", { headers: { "Content-Type": "text/html" } }));
  ipcMain.handle("desktop:view-state", () => ({ active: true }));
  const { DesktopDraftStore, createDraftHandler } = load("drafts");
  store = new DesktopDraftStore(path.join(directory, "drafts"));
  const handler = createDraftHandler({ store, origin,
    trustedSender: event => event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame,
    projectId: url => new URL(url).pathname.split("/")[2], currentUser: async () => "fixture" });
  ipcMain.handle("desktop:drafts", (event, command, input) => handler.command(event, command, input));
  win = new BrowserWindow({ show: false, webPreferences: { session: partition, preload: path.resolve(desktop, "src/preload.cjs"), contextIsolation: true, sandbox: true } });
  await win.loadURL(origin + "/projects/project");
  // Generate the identical payload on its consuming renderer, not on the host.
  const fixture = await win.webContents.executeJavaScript(`(async()=>{
    const map={},text="客户名称、金额与状态 ".repeat(8);
    for(let i=0;i<41944;i++)map[i]={__type:"FixtureNode",name:"Item"+i,text,children:["1","2"]};
    window.draft={id:"00000000-0000-4000-8000-000000000001",format:1,projectId:"project",branchId:null,baseRevision:1,sequence:1,savedAt:1,bundle:{map},dependencies:[]};
    window.draftJson=JSON.stringify(draft);window.handle=(await desktopDrafts.open("fixture","project",null)).handle;
    return {chars:draftJson.length,nodes:Object.keys(map).length};
  })()`);
  const report = { variant, runtime: process.versions, fixture,
    scope: "Minimal hidden Electron window, not full Studio/App total. Production preload, draft IPC and ASAR graph modules with only production graph dependencies. No forced GC. Main physical footprint includes workers; renderer RSS separately. Before/after same code paths and payload, separate processes; native operation samples include public bridge conversion.", memory: {}, samples: [] };
  await delay(100); report.memory.initial = await memory();
  report.cycles = [];
  for (let cycle = 0; cycle < Number(process.env.PERF_BACKGROUND_CYCLES || 1); cycle++) {
  report.samples = [];
  let maxDelay = 0, previous = performance.now();
  const timer = setInterval(() => { const now = performance.now(); maxDelay = Math.max(maxDelay, now - previous - 1); previous = now; }, 1);
  for (let round = 0; round < (process.env.PERF_BACKGROUND_PHASE === "graphics" ? 0 : 4); round++) {
    const sequence = cycle * 4 + round + 1;
    await win.webContents.executeJavaScript(`draft.sequence=${sequence};draftJson=JSON.stringify(draft);void 0`);
    for (const kind of ["write", "read"]) {
      await delay(20); maxDelay = 0;
      const start = performance.now();
      const result = await win.webContents.executeJavaScript(kind === "write" ? 'desktopDrafts.write(handle,draftJson).then(()=>true)' : 'desktopDrafts.read(handle,draft.id).then(value=>{window.restored=value;return {sequence:value.sequence,nodes:Object.keys(value.bundle.map).length,text:value.bundle.map[0].text}})');
      const ms = performance.now() - start; await delay(10);
      if (kind === "read") assert.deepEqual(result, { sequence, nodes: 41944, text: "客户名称、金额与状态 ".repeat(8) }); else assert.equal(result, true);
      report.samples.push({ kind, round, cold: round === 0, ms, maxLoopDelayMs: maxDelay });
    }
  }
  clearInterval(timer);
  report.memory.afterDrafts = await memory();
  // Packaging happens in the parent before launch, never in the measured host.
  const archive = process.env.PLASMIC_BACKGROUND_ARCHIVE;
  assert.ok(archive);
  const hasBackground = await fs.access(path.join(desktop, "src/background-worker.cjs")).then(() => true, () => false);
  const { PNG } = require("pngjs"), png = new PNG({ width: 1024, height: 1024 });
  for (let i = 0; i < png.data.length; i += 4) { png.data[i] = (i >> 8) % 256; png.data[i + 1] = (i >> 12) % 256; png.data[i + 2] = (i >> 16) % 256; png.data[i + 3] = 255; }
  const pixels = PNG.sync.write(png), vector = { width: 100, height: 100, operation: "unite", paths: ["M0 0h40v40h-40z", "M20 0h40v40h-40z"] };
  if (hasBackground) graphics ||= new (require(path.join(archive, "src/background-worker.cjs")).BackgroundWorker)();
  let graphDelay = 0, lastGraphBeat = performance.now();
  const graphTimer = setInterval(() => { const now = performance.now(); graphDelay = Math.max(graphDelay, now - lastGraphBeat - 1); lastGraphBeat = now; }, 1);
  report.graphSamples = [];
  for (let i = 0; i < (process.env.PERF_BACKGROUND_PHASE === "drafts" ? 0 : 3); i++) {
    await delay(20); graphDelay = 0;
    const start = performance.now();
    const traced = hasBackground ? await graphics.run("trace", { png: pixels }) : require(path.join(archive, "src/raster-vector.cjs")).tracePng(pixels);
    const result = hasBackground ? await graphics.run("vector", vector) : require(path.join(archive, "src/vector.cjs")).makeVector(vector);
    const ms = performance.now() - start; await delay(10);
    report.graphSamples.push({ round: i, cold: i === 0, ms, maxLoopDelayMs: graphDelay,
      digest: require("node:crypto").createHash("sha256").update(traced.svg + result.svg).digest("hex") });
    assert.equal(traced.width, 1024); assert.equal(result.area, 2400);
  }
  clearInterval(graphTimer);
  report.memory.afterJobs = await memory();
  await delay(16500);
  report.workersReleased = !hasBackground || (graphics.worker === null && store.worker.worker === null);
  assert.ok(report.workersReleased);
  report.memory.afterIdle = await memory();
  assert.equal(report.memory.afterIdle.background.length, 0, "all owned utility processes must actually exit");
  if (process.env.PERF_BACKGROUND_GC_CONTROL === "1") {
    // Attribution only, after all unforced samples; never used by production.
    require("node:v8").setFlagsFromString("--expose_gc");
    require("node:vm").runInNewContext("gc")();
    await delay(100);
    report.memory.afterDiagnosticGc = await memory();
  }
  report.cycles.push({ cycle, memory: structuredClone(report.memory), samples: report.samples, graphSamples: report.graphSamples });
  }
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true }); await fs.writeFile(output, JSON.stringify(report, null, 2));
  console.log("PASS native performance " + variant);
})().catch(error => { console.error(error); exitCode = 1; }).finally(async () => {
  try {
    await graphics?.close(); await store?.close?.(); win?.destroy();
  } catch (error) { console.error(error); exitCode = 1; }
  finally { app.exit(exitCode); }
});
