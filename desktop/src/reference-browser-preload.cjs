const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("referenceBrowser", {
  command: (input) => ipcRenderer.invoke("desktop:reference-browser", input),
  onFocusUrl: (callback) =>
    ipcRenderer.on("desktop:reference-browser-focus-url", callback),
  onState: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on("desktop:reference-browser-state", listener);
    return () =>
      ipcRenderer.removeListener("desktop:reference-browser-state", listener);
  },
});
