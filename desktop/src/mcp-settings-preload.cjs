const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("mcpSettings", {
  setImageService: (config) =>
    ipcRenderer.invoke("desktop:mcp-settings", "image-set", config),
  get: () => ipcRenderer.invoke("desktop:mcp-settings", "get"),
  set: (id, enabled) =>
    ipcRenderer.invoke("desktop:mcp-settings", "set", { id, enabled }),
  copy: () => ipcRenderer.invoke("desktop:mcp-settings", "copy"),
  close: () => ipcRenderer.invoke("desktop:mcp-settings", "close"),
});
