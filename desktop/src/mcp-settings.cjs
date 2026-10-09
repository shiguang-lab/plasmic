const { BrowserWindow, ipcMain, clipboard } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
function createMcpSettings(integrations, getParent, i18n) {
  let window;
  const page = pathToFileURL(path.join(__dirname, "mcp-settings.html")).href;
  ipcMain.handle("desktop:mcp-settings", (event, command, input) => {
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== event.sender.mainFrame ||
      event.senderFrame.url !== page
    )
      throw new Error("Invalid MCP settings page");
    if (command === "locale") return i18n.snapshot();
    if (command === "get")
      return {
        clients: integrations.status(),
      };
    if (command === "set") {
      try {
        return { clients: integrations.set(input?.id, input?.enabled) };
      } catch (error) {
        return { clients: integrations.status(), error: error.message };
      }
    }
    if (command === "copy") {
      clipboard.writeText(integrations.customConfig());
      return true;
    }
    if (command === "close") {
      window.close();
      return true;
    }
    throw new Error("Invalid MCP settings command");
  });
  i18n.subscribe(() => {
    if (window && !window.isDestroyed())
      window.webContents.send("desktop:ui-locale", i18n.snapshot());
  });
  return () => {
    if (window) {
      window.focus();
      return;
    }
    window = new BrowserWindow({
      parent: getParent(),
      modal: true,
      width: 760,
      height: 660,
      minWidth: 600,
      minHeight: 560,
      title: "MCP",
      backgroundColor: "#00000000",
      show: false,
      frame: false,
      transparent: true,
      roundedCorners: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "mcp-settings-preload.cjs"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    window.setMenu(null);
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => event.preventDefault());
    window.webContents.on("will-attach-webview", (event) =>
      event.preventDefault(),
    );
    window.once("ready-to-show", () => window.show());
    window.once("closed", () => {
      window = undefined;
    });
    void window.loadURL(page);
  };
}
module.exports = { createMcpSettings };
