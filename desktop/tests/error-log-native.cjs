const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { attachErrorLog } = require("../src/error-log.cjs");
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "plasmic-error-native-"));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    attachErrorLog(win.webContents, profile);
    await win.loadURL("data:text/html,<html></html>");
    const record = { message: "HTTP 503", stack: "original error stack", statusCode: 503, request: { method: "GET", url: "/api/v1/projects" } };
    await win.webContents.executeJavaScript(`console.error(${JSON.stringify("Studio operation failed " + JSON.stringify(record))})`);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile, "logs", "errors.log"), "utf8")).detail, record);
    console.log("PASS: native Electron renderer errors persist with stack and request");
  } finally {
    win.destroy();
    fs.rmSync(profile, { recursive: true, force: true });
  }
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
