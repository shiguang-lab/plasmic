const { studioFixture } = require("./fixtures/studio.cjs");
// Isolated Electron regression: no NAS, credentials or prototype mutations.
const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { DesktopController } = require("../src/controller.cjs");
const { sendCdp } = require("../src/cdp.cjs");

const profile = require("node:fs").mkdtempSync(path.join(os.tmpdir(), "plasmic-preview-navigation-"));
app.setPath("userData", profile);
let win, controller, server;
const report = [];
const watchdog = setTimeout(() => app.exit(1), 90000);
app.whenReady().then(async () => {
  app.dock?.hide();
  server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (req.url.startsWith("/projects/p/preview")) return res.end('<iframe style="border:0;width:800px;height:600px" src="/runtime' + (req.url.includes("hung") ? "?hung" : "") + '#live=true"></iframe>');
    if (req.url.startsWith("/runtime")) return res.end(`<div class="live-root-container" data-plasmic-preview-component="page">
      <input aria-label="Missing route" oninput="location.href='/missing'">
      <div style="position:absolute;left:40px;top:80px;width:120px;height:50px;overflow:hidden">
        <section role="dialog" aria-label="Edit" style="height:100px;background:#369;color:white">
          <input aria-label="Missing route" value="dialog value">
        </section>
      </div></div>` + (req.url.includes("hung") ? `<script>
      Object.defineProperty(document.fonts, "ready", {value: new Promise(() => {})});
      // Root the callbacks so Chromium cannot collect the pending inspection
      // Promise and reject executeJavaScript before the controller deadline.
      window.pendingCallbacks = [];
      window.setTimeout = window.requestAnimationFrame = callback => window.pendingCallbacks.push(callback);
    </script>` : ""));
    if (req.url === "/missing") { res.statusCode = 404; return res.end("Bundled asset not found"); }
    res.end("Editor restored");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  win = new BrowserWindow({ show: false, width: 1000, height: 800, webPreferences: { backgroundThrottling: false } });
  controller = new DesktopController(() => studioFixture(win), { studioOrigin: origin });
  let mode = "preview";
  const context = () => ({ mode, projectId: "p", sessionId: "s", changeCounter: 0, previewContext: mode === "preview" ? { componentUuid: "page" } : null });
  controller.state = async () => ({ ready: true, projectId: "p", url: win.webContents.getURL(), editorContext: context() });
  controller.editor = async (name, input) => {
    if (name === "getEditorContext") return context();
    if (name === "preview" && input.action === "close") {
      await win.loadURL(origin + "/projects/p"); mode = "edit"; return { closed: true };
    }
    if (name === "read") return { text: await win.webContents.executeJavaScript("document.body.textContent") };
    throw new Error("Unexpected test operation: " + name);
  };
  async function recover() {
    const close = controller.dispatch("preview", { action: "close" });
    const read = controller.dispatch("execute", { name: "read", input: {} });
    assert.equal((await close).context.mode, "edit");
    assert.equal((await read).text, "Editor restored");
    assert.equal(controller.operations.size, 0);
  }
  await win.loadURL(origin + "/projects/p/preview#/page");
  const snapshot = await controller.dispatch("preview", { action: "snapshot" });
  const dialog = snapshot.elements.find(el => el.role === "dialog");
  assert.deepEqual(dialog.visibleBounds, { x: 40, y: 80, width: 120, height: 50 });
  const scoped = await controller.dispatch("preview", { action: "snapshot", scopeRef: dialog.ref });
  assert.equal(scoped.elements.find(el => el.role === "textbox").regionRef, dialog.ref);
  assert.equal((await controller.dispatch("preview", { action: "assert", scopeRef: dialog.ref,
    checks: [{ kind: "value", role: "textbox", name: "Missing route", value: "dialog value" }], timeoutMs: 0 })).passed, true);
  const screenshot = await controller.dispatch("preview", { action: "screenshot", scopeRef: dialog.ref, fullResolution: true });
  assert.deepEqual(screenshot.visibleBounds, dialog.visibleBounds);
  const image = require("sharp")(Buffer.from(screenshot.data, "base64"));
  const { data: pixels, info } = await image.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width * 50, info.height * 120);
  const bottomRight = (info.width * info.height - 1) * info.channels;
  assert.deepEqual([...pixels.subarray(bottomRight, bottomRight + 3)], [51, 102, 153]);
  report.push({ case: "scoped-preview", visibleBounds: screenshot.visibleBounds, imageWidth: info.width, imageHeight: info.height });
  const ref = snapshot.elements.find((el) => el.name === "Missing route").ref;
  const start = Date.now();
  let error;
  try {
    await controller.dispatch("preview", { action: "fill", ref, value: "go" });
    const navigationEnd = Date.now() + 2000;
    while (!win.webContents.mainFrame.framesInSubtree.some((frame) => frame.url === origin + "/missing") && Date.now() < navigationEnd) await new Promise((resolve) => setTimeout(resolve, 20));
    await controller.dispatch("preview", { action: "state" });
  } catch (failure) { error = failure; }
  assert(error, "Navigation to the missing runtime must fail inspection");
  assert(win.webContents.mainFrame.framesInSubtree.some((frame) => frame.url === origin + "/missing"));
  await recover();
  report.push({ case: "missing-route", elapsedMs: Date.now() - start, error: error.message, queueReleased: true });

  mode = "preview";
  // HTTP fixtures receive the query, not the fragment.
  await win.loadURL(origin + "/projects/p/preview?hung#/page");
  const hungStart = Date.now();
  const failed = assert.rejects(controller.dispatch("preview", { action: "state" }), error => {
    assert.match(error.message, /runtime timed out after 30 seconds/);
    assert.equal(error.context.code, "PREVIEW_TIMEOUT");
    return true;
  });
  // Queue recovery immediately behind the real, non-settling renderer Promise.
  const recovered = recover();
  const collectWhilePending = async () => {
    const frame = win.webContents.mainFrame.framesInSubtree.find(frame => frame.url === origin + "/runtime?hung#live=true");
    assert(frame, "The hung runtime fixture must be loaded");
    const end = Date.now() + 2000;
    while (await frame.executeJavaScript("pendingCallbacks.length") < 2) {
      assert(Date.now() < end, "Preview inspection did not reach the suspended renderer wait");
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    // Exercise the GC that previously destroyed the unrooted pending Promise.
    await sendCdp(win.webContents, "HeapProfiler.collectGarbage");
  };
  // Observe both rejections immediately, including on an assertion failure.
  await Promise.all([failed, recovered, collectWhilePending()]);
  const elapsedMs = Date.now() - hungStart;
  assert(elapsedMs >= 29000 && elapsedMs < 35000, `Unexpected runtime deadline: ${elapsedMs}`);
  report.push({ case: "non-settling-renderer-promise", elapsedMs, queueReleased: true });
  console.log(JSON.stringify({ passed: true, cases: report }, null, 2));
  if (process.env.PLASMIC_REPORT_DIR) {
    await fs.mkdir(process.env.PLASMIC_REPORT_DIR, { recursive: true });
    await fs.writeFile(path.join(process.env.PLASMIC_REPORT_DIR, "preview-navigation.json"), JSON.stringify({ passed: true, cases: report }, null, 2));
  }
}).then(() => finish(0), async (error) => { console.error(error); await finish(1); });
async function finish(code) {
  clearTimeout(watchdog);
  controller?.close();
  win?.destroy();
  if (server) await new Promise((resolve) => server.close(resolve));
  if (profile) await fs.rm(profile, { recursive: true, force: true });
  app.exit(code);
}
