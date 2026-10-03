const { app, BrowserWindow, ipcMain, clipboard } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
function createMcpSettings(integrations, getParent) {
  let window;
  const page = pathToFileURL(path.join(__dirname, "mcp-settings.html")).href;
  ipcMain.handle("desktop:mcp-settings", async (event, command, input) => {
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== event.sender.mainFrame ||
      event.senderFrame.url !== page
    )
      throw new Error("Invalid MCP settings page");
    if (command === "get")
      return {
        clients: integrations.status(),
        config: integrations.customConfig(),
        imageService: await require("./image-service.cjs").imageServiceSettings(
          app.getPath("userData"),
        ),
      };
    if (command === "image-set") {
      try {
        return {
          imageService: await require("./image-service.cjs").saveImageConfig(
            app.getPath("userData"),
            input,
          ),
        };
      } catch (error) {
        return { error: error.message };
      }
    }
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
  return () => {
    if (window) {
      window.focus();
      return;
    }
    window = new BrowserWindow({
      parent: getParent(),
      modal: true,
      width: 1120,
      height: 900,
      minWidth: 720,
      minHeight: 620,
      title: "MCP",
      backgroundColor: "#18181b",
      show: false,
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
