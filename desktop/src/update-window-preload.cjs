const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("updateWindow", {
  command: (command) => ipcRenderer.invoke("desktop:update-window", command),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("desktop:update-status", listener);
    return () => ipcRenderer.removeListener("desktop:update-status", listener);
  },
});
