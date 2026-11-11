const { app, BrowserWindow, ipcMain, session } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const { createProjectOpenLog } = require("../src/project-open-log.cjs");
const { DesktopWorkspace } = require("../src/workspace.cjs");

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-open-log-"));
app.setPath("userData", profile);
app.on("window-all-closed", () => {});
const file = path.join(profile, "logs", "project-open.log");
const privateValue = "private-value-for-log-test";

async function waitFor(event, outcome) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) {
      const record = fs.readFileSync(file, "utf8").trim().split("\n").map(JSON.parse)
        .find(row => row.event === event && (outcome === undefined || row.outcome === outcome));
      if (record) return record;
    }
    await delay(20);
  }
  assert.fail(`Missing ${event} (${outcome ?? "any outcome"})`);
}

app.whenReady().then(async () => {
  let heldResponse;
  const server = http.createServer((request, response) => {
    if (request.url.startsWith("/api/v1/projects/")) {
      heldResponse = response;
      return;
    }
    response.setHeader("X-SG-Request-ID", "test-request-id");
    response.setHeader("Set-Cookie", `test=${privateValue}; HttpOnly`);
    response.writeHead(503).end(privateValue);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const ses = session.fromPartition("project-open-log-test");
  const workspace = new DesktopWorkspace(profile, origin);
  const projectOpenLog = createProjectOpenLog(profile, { studioOrigin: origin, slowMs: 750, timeoutMs: 2000 });
  projectOpenLog.attachSession(ses);
  ipcMain.handle("desktop:view-state", () => ({ active: true }));
  const html = body => new Response(body, { headers: { "Content-Type": "text/html", "X-Plasmic-Desktop-Asset": "local" } });
  ses.protocol.handle("http", request => {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/projects/project") {
      return html(`<iframe src="/static/host.html"></iframe><script>
        performance.mark("studio-entry");
        window.result = Promise.all([
          fetch("/api/v1/projects/project?secret=${privateValue}").then(response => response.text()),
          fetch("/api/v1/dependency-models/${privateValue}"),
          fetch("/static/js/failed.abcdef.js").catch(() => null),
        ]);
      </script>`);
    }
    if (pathname === "/static/host.html") {
      return html(`<script>console.info('[Studio startup] ["host","model-unbundle",10,20]')</script>`);
    }
    if (pathname === "/projects/stalled") return html("<p>Loading</p>");
    if (pathname.endsWith("failed.abcdef.js")) return Response.error();
    return ses.fetch(request, { bypassCustomProtocolHandlers: true });
  });
  const window = new BrowserWindow({
    show: false,
    webPreferences: { session: ses, sandbox: true, preload: path.join(__dirname, "../src/preload.cjs") },
  });
  try {
    projectOpenLog.attachContents(window.webContents, url => workspace.projectId(url));
    await window.loadURL(`${origin}/projects/project?branch=${privateValue}#${privateValue}`);
    const start = await waitFor("project-open.start");
    const slow = await waitFor("project-open.slow", "loading");
    assert.equal(slow.openId, start.openId);
    assert.equal(slow.projectId, "project");
    assert.ok(slow.stages.some(stage => stage.phase === "studio-entry" && stage.source === "top"));
    assert.ok(slow.stages.some(stage => stage.phase === "model-unbundle" && stage.source === "host" && stage.durationMs === 20), JSON.stringify(slow));
    assert.ok(slow.pending.some(request => request.route === "/api/v1/projects/:id" && request.elapsedMs > 0));
    assert.ok(slow.requests.some(request => request.route === "/static/host.html" && request.localAsset && request.status === 200));
    assert.ok(slow.requests.some(request => request.route === "/api/v1/dependency-models/:id" && request.status === 503 && request.requestId === "test-request-id"));
    assert.ok(slow.requests.some(request => request.route === "/static/js/failed.abcdef.js" && request.error));
    await window.webContents.executeJavaScript('performance.mark("studio-load-error")');
    assert.equal((await waitFor("project-open.error")).openId, start.openId);
    heldResponse.end("project");
    await window.webContents.executeJavaScript('window.result.then(() => { performance.mark("studio-ready"); })');
    const end = await waitFor("project-open.end", "ready");
    assert.equal(end.openId, start.openId);
    assert.ok(end.requests.some(request => request.route === "/api/v1/projects/:id" && request.durationMs >= 500 && request.status === 200));
    assert.ok(end.stages.some(stage => stage.phase === "studio-ready"));
    await window.loadURL(origin + "/projects/stalled");
    const timeout = await waitFor("project-open.end", "timed-out");
    assert.equal(timeout.projectId, "stalled");
    assert.notEqual(timeout.openId, end.openId);
    assert.ok(timeout.durationMs >= 2000);
    assert.ok(!fs.readFileSync(file, "utf8").includes(privateValue));
    console.log("PASS: Desktop records startup stages, pending and completed requests, errors, recovery, and timeout");
  } finally {
    heldResponse?.end();
    window.destroy();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(profile, { recursive: true, force: true });
  }
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
