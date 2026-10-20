const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { attachWindowRecovery } = require("../src/window-recovery.cjs");

const directory = process.env.PLASMIC_RECOVERY_REPORT;
assert(directory, "Use an isolated recovery report/profile directory");
fs.mkdirSync(directory, { recursive: true });
app.setPath("userData", path.join(directory, "profile"));
app.setPath("sessionData", path.join(directory, "profile"));
const editor = path.join(directory, "editor.html");
const dashboard = path.join(directory, "dashboard.html");
fs.writeFileSync(editor, "<title>Editor fixture</title><p>Editable canvas</p>");
fs.writeFileSync(dashboard, "<title>Dashboard fixture</title><p>Project recovery</p>");
const editorUrl = pathToFileURL(editor).href;
const homeUrl = pathToFileURL(dashboard).href;
const prompts = [], cancellations = [], failures = [];
let response;
const deadline = setTimeout(() => app.exit(1), 30000);
const pause = () => new Promise((resolve) => setTimeout(resolve, 50));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  attachWindowRecovery(win, {
    homeUrl, t: (text) => text,
    controller: { cancelPending: (_win, reason) => cancellations.push(reason) },
    dialog: {
      showMessageBox: async (_win, options) => {
        prompts.push(options);
        return { response: response ?? options.defaultId };
      },
      showErrorBox: (...args) => failures.push(args),
    },
  });
  await win.loadURL(editorUrl);
  const initialRendererPid = win.webContents.getOSProcessId();
  const gone = new Promise((resolve) => win.webContents.once("render-process-gone", (_event, details) => resolve(details.reason)));
  win.webContents.forcefullyCrashRenderer();
  const reason = await gone;
  for (let i = 0; i < 100 && (win.webContents.isCrashed() || win.webContents.getURL() !== homeUrl || win.webContents.isLoading()); i++) await pause();
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].defaultId, 1);
  assert.equal(win.webContents.getURL(), homeUrl);
  assert.equal(win.webContents.isCrashed(), false);
  assert.notEqual(win.webContents.getOSProcessId(), initialRendererPid);
  assert.equal(cancellations.length, 1);
  assert.match(cancellations[0], /Editor renderer exited/);
  // Explicit reload remains available for a transient failure.
  response = 0;
  await win.loadURL(editorUrl);
  const goneAgain = new Promise((resolve) => win.webContents.once("render-process-gone", resolve));
  win.webContents.forcefullyCrashRenderer();
  await goneAgain;
  for (let i = 0; i < 100 && (win.webContents.isCrashed() || win.webContents.isLoading() || prompts.length < 2); i++) await pause();
  assert.equal(prompts.length, 2);
  assert.equal(win.webContents.isCrashed(), false);
  assert.equal(win.webContents.getURL(), editorUrl);
  assert.equal(failures.length, 0);
  const report = { mainPid: process.pid, reason, initialRendererPid, recoveredRendererPid: win.webContents.getOSProcessId(), dashboardRecovered: true, explicitReloadRecovered: true, pendingCommandsCancelled: cancellations.length, prompts: prompts.map(({ buttons, defaultId }) => ({ buttons, defaultId })) };
  fs.writeFileSync(path.join(directory, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  clearTimeout(deadline);
  app.exit(0);
}).catch((error) => { console.error(error); clearTimeout(deadline); app.exit(1); });
