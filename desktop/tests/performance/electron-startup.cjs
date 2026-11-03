// Offline startup of the production Desktop shell with a fresh private profile.
// Usage: electron electron-startup.cjs <privateFixture> <newOutputDirectory>
const fs = require("node:fs");
const path = require("node:path");
const { app, session, dialog } = require("electron");
const { createProjectBackend } = require("./real-project-backend.cjs");
const { studioContents } = require("../fixtures/native-studio.cjs");
const fixture = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const profile = path.join(output, "profile");
if (fs.existsSync(profile)) throw Error("Startup requires a fresh diagnostic profile");
app.setPath("userData", profile);
app.setPath("sessionData", profile);
const launchedAt = Number(process.env.PERF_LAUNCHED_AT);
if (!Number.isFinite(launchedAt)) throw Error("Set PERF_LAUNCHED_AT immediately before spawning Electron");
const elapsed = () => Date.now() - launchedAt;
const report = { electron: process.versions.electron, scope: "Production main/preload, offline project-list fixture, fresh profile, OS file cache uncontrolled; launch to DOM card, not compositor presentation", errors: [], blocked: [], previewErrors: [] };
const read = name => JSON.parse(fs.readFileSync(path.join(fixture, name)));
const opening = read("project-response.json");
const models = { ...read("model-resources.json"), ...read("plume-resources.json") };
const codes = new Map(Object.entries(read("code-resources.json")).map(([key, value]) => {
  const url = new URL(key); url.searchParams.sort();
  return [url.pathname + url.search, value];
}));
const backend = createProjectBackend({ opening, startup: opening.startup, models, codes, plume: read("plume-opening.json"), report, phase: () => "startup", functional: false });
const timer = setTimeout(() => finish(Error("Startup timed out")), 60000);
function finish(error) {
  clearTimeout(timer);
  if (error) report.error = error.stack;
  fs.writeFileSync(path.join(output, "startup.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
  app.exit(error ? 1 : 0);
}
app.whenReady().then(async () => {
  report.appReadyMs = elapsed();
  const ses = session.fromPartition("persist:plasmic-desktop");
  ses.webRequest.onBeforeRequest({ urls: ["ws://*/*", "wss://*/*"] }, (_, callback) => callback({ cancel: true }));
  ses.fetch = async (request, options = {}) => {
    const value = typeof request === "string" ? new Request(request, options) : request;
    if (new URL(value.url).pathname === "/api/auth/session") return Response.json({ authenticated: true });
    return backend(value);
  };
  dialog.showErrorBox = (title, message) => report.errors.push({ title, message });
  const win = await require("../../src/main.cjs").startDesktop();
  report.shellStartedMs = elapsed();
  const contents = studioContents(win);
  contents.on("console-message", event => { if (event.level === "error") report.errors.push(event.message); });
  while (true) {
    const found = await contents.executeJavaScript(`Array.from(document.querySelectorAll('[role="link"][aria-label]')).some(e => e.getAttribute('aria-label').endsWith(${JSON.stringify(": " + opening.project.name)}))`);
    if (found) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  report.dashboardCardReadyMs = elapsed();
  if (report.errors.length) throw Error("Desktop startup reported errors");
  finish();
}).catch(finish);
