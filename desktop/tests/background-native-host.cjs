// Real Electron worker + sandboxed public preload bridge; private offline files.
const { app, BrowserWindow, ipcMain, session } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { PNG } = require("pngjs");
const { DesktopDraftStore, createDraftHandler } = require("../src/drafts.cjs");
const { DesktopController } = require("../src/controller.cjs");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const { mcpTransport } = require("./fixtures/mcp.cjs");
const { startRpc } = require("../src/local-rpc.cjs");
let directory, win, store, controller, archivedWorker, archivedDrafts, client, stopRpc;
let exitCode = 0;
app.on("window-all-closed", () => {});

(async () => {
  directory = process.env.PLASMIC_BACKGROUND_PROFILE;
  assert.ok(directory, "Run the owning background-native.cjs Node runner");
  app.setPath("userData", directory); app.setPath("sessionData", directory);
  await app.whenReady();
  const origin = "https://offline.test";
  const partition = session.fromPartition("background-native");
  await partition.protocol.handle("https", () => new Response("<!doctype html><html><body>Offline fixture</body></html>", { headers: { "Content-Type": "text/html" } }));
  ipcMain.handle("desktop:view-state", () => ({ active: true }));
  store = new DesktopDraftStore(path.join(directory, "drafts"));
  let userId = "fixture";
  const handler = createDraftHandler({ store, origin,
    trustedSender: event => event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame,
    projectId: url => new URL(url).pathname.split("/")[2], currentUser: async () => userId });
  ipcMain.handle("desktop:drafts", (event, command, input) => handler.command(event, command, input));
  win = new BrowserWindow({ show: false, webPreferences: { session: partition, preload: path.resolve(__dirname, "../src/preload.cjs"), contextIsolation: true, sandbox: true } });
  const rendererErrors = [];
  win.webContents.on("preload-error", (_event, file, error) => rendererErrors.push({ file, message: error.message }));
  await win.loadURL(origin + "/projects/project");
  const value = { format: 1, id: randomUUID(), projectId: "project", branchId: null, baseRevision: 1, sequence: 1, savedAt: 1,
    bundle: { map: { site: { text: "客户😀<&>".repeat(50000) } } }, dependencies: [] };
  const result = await win.webContents.executeJavaScript(`(async () => {
    const value = ${JSON.stringify(value)};
    const {handle} = await desktopDrafts.open("fixture", "project", null);
    await desktopDrafts.write(handle, JSON.stringify(value));
    const first = await desktopDrafts.read(handle, value.id);
    if (JSON.stringify(first) !== JSON.stringify(value)) throw Error("Public draft output changed");
    await desktopDrafts.write(handle, JSON.stringify({...value, sequence:2}));
    window.fixtureHandle=handle;
    return {sequence:(await desktopDrafts.read(handle,value.id)).sequence, list:(await desktopDrafts.list("fixture")).length};
  })()`);
  assert.deepEqual(result, { sequence: 2, list: 1 });
  const scope = { origin, userId, projectId: "project", branchId: null };
  await fs.writeFile(store.file(scope, value.id), "{broken");
  assert.equal(await win.webContents.executeJavaScript(`desktopDrafts.read(fixtureHandle,${JSON.stringify(value.id)}).then(value=>value.sequence)`), 1);
  assert.equal(await win.webContents.executeJavaScript(`(async()=>{
    const value=await desktopDrafts.read(fixtureHandle,${JSON.stringify(value.id)});
    value.sequence=3;value.bundle.map.site.text=String.fromCharCode(0xd800);
    const source=JSON.stringify(value).replace(String.fromCharCode(92)+"ud800",String.fromCharCode(0xd800));
    await desktopDrafts.write(fixtureHandle,source);
    return (await desktopDrafts.read(fixtureHandle,value.id)).bundle.map.site.text.charCodeAt(0);
  })()`), 0xd800);
  userId = "replacement"; handler.invalidate();
  await assert.rejects(win.webContents.executeJavaScript(`desktopDrafts.read(fixtureHandle,${JSON.stringify(value.id)})`), /Invalid draft session/);
  assert.deepEqual(rendererErrors, []);

  controller = new DesktopController(() => ({ window: win, webContents: win.webContents }), { studioOrigin: origin });
  const input = { width: 100, height: 100, operation: "unite", paths: ["M0 0h40v40h-40z", "M20 0h40v40h-40z"] };
  assert.equal((await controller.execute("make_vector", input)).area, 2400);
  const png = new PNG({ width: 32, height: 32 }); png.data.fill(255);
  const imagePath = path.join(directory, "image.png"), outputPath = path.join(directory, "image.svg");
  await fs.writeFile(imagePath, PNG.sync.write(png));
  const traced = await controller.execute("vectorize_image", { path: imagePath, outputPath });
  assert.equal(await fs.readFile(outputPath, "utf8"), traced.svg);
  await assert.rejects(controller.execute("vectorize_image", { path: imagePath, outputPath }), { code: "EEXIST" });
  stopRpc = await startRpc(directory, (method, input, _caller, signal) => controller.signalContext.run(signal, () => controller.execute(method, input)));
  client = new Client({ name: "native-background-acceptance", version: "1" });
  await client.connect(new StdioClientTransport(mcpTransport(directory)));
  const vectorTool = await client.callTool({ name: "make_vector", arguments: input });
  assert.equal(vectorTool.isError, false);
  assert.equal(JSON.parse(vectorTool.content[0].text).area, 2400);
  const traceTool = await client.callTool({ name: "vectorize_image", arguments: { path: imagePath } });
  assert.equal(traceTool.isError, false);
  const ref = JSON.parse(traceTool.content[0].text).svg;
  assert.equal(ref.__type, "ResultReference");
  const source = await client.callTool({ name: "read_result", arguments: { resultId: ref.resultId } });
  assert.equal(source.isError, false, JSON.stringify(source));
  assert.equal(JSON.parse(source.content[0].text).text, traced.svg);

  // Exercise the actual worker entry and production graph modules inside ASAR,
  // with production graph dependencies (no development-only jsdom/canvas).
  const stage = path.join(directory, "stage"), archive = path.join(directory, "fixture.asar");
  await fs.mkdir(path.join(stage, "src"), { recursive: true });
  for (const file of ["background-worker.cjs", "background-task.cjs", "raster-vector.cjs", "vector.cjs", "drafts.cjs", "draft-files.cjs"]) await fs.copyFile(path.resolve(__dirname, "../src", file), path.join(stage, "src", file));
  for (const name of ["paper", "pngjs", "imagetracerjs"]) await fs.cp(path.resolve(__dirname, "../node_modules", name), path.join(stage, "node_modules", name), { recursive: true });
  await (await import("@electron/asar")).createPackage(stage, archive);
  const { BackgroundWorker } = require(path.join(archive, "src/background-worker.cjs"));
  archivedWorker = new BackgroundWorker();
  assert.deepEqual(await archivedWorker.run("vector", input), await controller.execute("make_vector", input));
  const pixels = await fs.readFile(imagePath);
  assert.equal((await archivedWorker.run("trace", { png: pixels })).svg, traced.svg);
  const { DesktopDraftStore: ArchivedDraftStore } = require(path.join(archive, "src/drafts.cjs"));
  archivedDrafts = new ArchivedDraftStore(path.join(directory, "archived-drafts"));
  await archivedDrafts.write(scope, new TextEncoder().encode(JSON.stringify(value)));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(await archivedDrafts.read(scope, value.id))), value);
  const starting = new BackgroundWorker();
  const pending = assert.rejects(starting.run("vector", input), /Desktop closed/);
  await starting.close(); await pending;
  assert.equal(starting.worker, null, "closing during process launch must wait for actual exit");
  const cancelled = new BackgroundWorker(), abort = new AbortController();
  const interrupted = assert.rejects(cancelled.run("vector", input, { signal: abort.signal }), /cancelled/);
  abort.abort(Error("cancelled")); await interrupted;
  assert.equal((await cancelled.run("vector", input)).area, 2400);
  await cancelled.close();
  console.log("PASS: Electron graphics, Go MCP/STDIO roundtrip, sandboxed public draft bridge, checkpoint recovery, account fencing and ASAR workers");
})().catch(error => { console.error(error); exitCode = 1; }).finally(async () => {
  try {
    await client?.close(); await stopRpc?.();
    controller?.close(); await controller?.graphics.close(); await archivedWorker?.close(); await archivedDrafts?.close(); await store?.close();
    win?.destroy();
  } catch (error) { console.error(error); exitCode = 1; }
  finally { app.exit(exitCode); }
});
