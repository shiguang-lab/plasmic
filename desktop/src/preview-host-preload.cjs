const { ipcRenderer, contextBridge } = require("electron");

// Bridge for preview-host.html, which runs in a dedicated offscreen window.
contextBridge.exposeInMainWorld("desktopPreviewHost", {
  onStart: (callback) =>
    ipcRenderer.once("desktop:preview-host-start", (_event, job) => callback(job)),
  result: (bytes) => ipcRenderer.send("desktop:preview-host-result", bytes),
  fail: (message) => ipcRenderer.send("desktop:preview-host-error", String(message)),
});
