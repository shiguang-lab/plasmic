const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("mcpSettings", {
  initialUiAppearance: process.argv
    .find((arg) => arg.startsWith("--shiguang-ui-appearance="))
    ?.split("=")[1],
  getUiAppearance: () =>
    ipcRenderer.invoke("desktop:mcp-settings", "appearance"),
  onUiAppearance: (callback) => {
    const listener = (_event, appearance) => callback(appearance);
    ipcRenderer.on("desktop:ui-appearance", listener);
    return () => ipcRenderer.removeListener("desktop:ui-appearance", listener);
  },
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
