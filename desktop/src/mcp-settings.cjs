const { ipcMain, clipboard } = require("electron");
function createMcpSettings(integrations, getParent, studioOrigin) {
  ipcMain.handle("desktop:mcp-settings", (event, command, input) => {
    const parent = getParent();
    if (
      !parent ||
      event.sender !== parent.webContents ||
      event.senderFrame !== event.sender.mainFrame ||
      new URL(event.senderFrame.url).origin !== studioOrigin
    ) {
      throw new Error("Invalid MCP settings page");
    }
    if (command === "get") {
      return {
        clients: integrations.status(),
        config: integrations.customConfig(),
      };
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
    throw new Error("Invalid MCP settings command");
  });
  return () => getParent()?.webContents.send("desktop:mcp-settings-open");
}
module.exports = { createMcpSettings };
