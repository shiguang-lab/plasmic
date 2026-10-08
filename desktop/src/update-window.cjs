const { BrowserWindow, ipcMain, nativeTheme } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function createUpdateWindow(manager, getParent) {
  let window;
  let phase = manager.state.phase;
  const page = pathToFileURL(path.join(__dirname, "update-window.html")).href;
  ipcMain.handle("desktop:update-window", (event, command) => {
    if (!window || event.sender !== window.webContents ||
        event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== page) {
      throw new Error("Invalid update window sender");
    }
    if (command === "close") { window.close(); return true; }
    if (!["status", "check", "download", "install"].includes(command)) {
      throw new Error("Invalid update window command");
    }
    return manager.command(command);
  });
  manager.on("status", (status) => {
    if (window && !window.isDestroyed()) window.webContents.send("desktop:update-status", status);
    const completed = status.phase === "downloaded" && phase !== "downloaded";
    phase = status.phase;
    if (completed) open();
  });
  function open() {
    if (window) { window.show(); window.focus(); return; }
    window = new BrowserWindow({
      parent: getParent(), modal: false,
      width: 560, height: 520, resizable: false, minimizable: false, maximizable: false,
      title: "Software Update", show: false, autoHideMenuBar: true,
      backgroundColor: nativeTheme.shouldUseDarkColors ? "#18181b" : "#ffffff",
      webPreferences: {
        preload: path.join(__dirname, "update-window-preload.cjs"),
        nodeIntegration: false, contextIsolation: true, sandbox: true,
      },
    });
    window.setMenu(null);
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => event.preventDefault());
    window.webContents.on("will-attach-webview", (event) => event.preventDefault());
    window.once("ready-to-show", () => window.show());
    window.once("closed", () => { window = undefined; });
    void window.loadURL(page);
    if (["idle", "current"].includes(manager.state.phase)) void manager.command("check");
  }
  if (phase === "downloaded") open();
  return open;
}
module.exports = { createUpdateWindow };
