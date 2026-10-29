// Isolated Electron regression: no NAS, credentials or prototype mutations.
const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { DesktopController } = require("../src/controller.cjs");

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
    if (req.url.startsWith("/runtime")) return res.end('<div class="live-root-container" data-plasmic-preview-component="page"><input aria-label="Missing route" oninput="location.href=\'/missing\'"></div>' + (req.url.includes("hung") ? '<script>Object.defineProperty(document.fonts,"ready",{value:new Promise(()=>{})});window.setTimeout=()=>0;window.requestAnimationFrame=()=>0;</script>' : ""));
    if (req.url === "/missing") { res.statusCode = 404; return res.end("Bundled asset not found"); }
    res.end("Editor restored");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  win = new BrowserWindow({ show: false, width: 1000, height: 800, webPreferences: { backgroundThrottling: false } });
  controller = new DesktopController(() => win, { studioOrigin: origin });
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
  await win.loadURL(origin + "/projects/p/preview#/page?hung");
  const hungStart = Date.now();
  const failed = assert.rejects(controller.dispatch("preview", { action: "state" }), /runtime timed out after 30 seconds/);
  // Queue recovery immediately behind the real, non-settling renderer Promise.
  const recovered = recover();
  await failed;
  await recovered;
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
