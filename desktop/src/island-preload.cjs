const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktopIsland", {
  command: (command, input) => ipcRenderer.invoke("desktop:presentation", command, input),
  onState: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("desktop:island-state", listener);
    return () => ipcRenderer.removeListener("desktop:island-state", listener);
  },
});
