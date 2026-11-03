// Real Electron process ownership, using an isolated profile and local pages.
const { app, BrowserWindow, session } = require("electron");
const { StudioWindow } = require("../src/studio-window.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-studio-process-"));
app.setPath("userData", profile);
const origin = "https://studio.test";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const timer = setTimeout(() => app.exit(1), 60000);
app.on("window-all-closed", () => {});
app.whenReady().then(async () => {
  const ses = session.fromPartition("studio-process-test");
  ses.protocol.handle("https", request => new Response(
    new URL(request.url).pathname.startsWith("/projects/")
      ? `<script>window.payload=new Uint8Array(128*1024*1024);for(let i=0;i<payload.length;i+=4096)payload[i]=1;</script><iframe src="https://host.test/"></iframe>`
      : "<h1>Dashboard</h1>", { headers: { "Content-Type": "text/html" } }
  ));
  const window = new BrowserWindow({ width: 1000, height: 700, show: false });
  let protect = async () => {};
  const studio = new StudioWindow(window, {
    studioOrigin: origin, backgroundColor: "#eceef3", webPreferences: { session: ses, sandbox: true },
    projectId: url => new URL(url || "about:blank").pathname.match(/^\/projects\/([^/]+)/)?.[1],
    beforeNavigate: () => protect(),
  });
  const rss = () => app.getAppMetrics().find(p => p.pid === studio.webContents.getOSProcessId()).memory.workingSetSize;
  await studio.loadURL(origin + "/projects");
  await pause(200);
  const cold = rss(), samples = [];
  const retired = [];
  for (let i = 0; i < 20; i++) {
    await studio.loadURL(origin + "/projects/project");
    await studio.webContents.executeJavaScript("payload.length");
    const contents = studio.webContents, pid = contents.getOSProcessId(), canvas = rss();
    const iframePids = contents.mainFrame.framesInSubtree.map(frame => frame.processId);
    await studio.loadURL(origin + "/projects");
    const deadline = Date.now() + 5000;
    while (app.getAppMetrics().some(p => p.pid === pid) && Date.now() < deadline) await pause(20);
    assert.equal(contents.isDestroyed(), true);
    assert(!app.getAppMetrics().some(p => p.pid === pid), "Retired editor PID must exit without GC");
    assert.notEqual(studio.webContents.getOSProcessId(), pid);
    assert.equal(BrowserWindow.getAllWindows().length, 1);
    retired.push(pid);
    const returned = rss();
    assert(returned < cold * 1.5 + 64 * 1024, "Dashboard renderer must stay near cold RSS");
    samples.push({ iteration: i + 1, pid, iframePids, canvasKiB: canvas, dashboardKiB: returned });
  }
  await studio.loadURL(origin + "/projects/project");
  const editor = studio.webContents;
  protect = async () => { throw Error("Draft backup failed"); };
  await assert.rejects(studio.loadURL(origin + "/projects"), /Draft backup failed/);
  assert.equal(studio.webContents, editor);
  assert.equal(editor.isDestroyed(), false);
  const resized = new Promise(resolve => window.once("resize", resolve));
  window.setContentSize(1100, 750);
  await resized;
  assert.deepEqual(studio.view.getBounds(), { x: 0, y: 0, width: 1100, height: 750 });
  const destroyed = new Promise(resolve => editor.once("destroyed", resolve));
  window.destroy();
  await destroyed;
  assert(editor.isDestroyed());
  console.log(JSON.stringify({ passed: true, coldDashboardKiB: cold, retiredPids: retired, samples, draftFailurePreserved: true, resize: true }));
  clearTimeout(timer);
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
