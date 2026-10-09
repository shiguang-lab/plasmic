const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("mcpSettings", {
  getUiMessages: () => ipcRenderer.invoke("desktop:mcp-settings", "locale"),
  onUiLocale: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on("desktop:ui-locale", listener);
    return () => ipcRenderer.removeListener("desktop:ui-locale", listener);
  },
  get: () => ipcRenderer.invoke("desktop:mcp-settings", "get"),
  set: (id, enabled) =>
    ipcRenderer.invoke("desktop:mcp-settings", "set", { id, enabled }),
  copy: () => ipcRenderer.invoke("desktop:mcp-settings", "copy"),
  close: () => ipcRenderer.invoke("desktop:mcp-settings", "close"),
});
