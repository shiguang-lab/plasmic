const { ipcRenderer, contextBridge } = require("electron");
if (window.top === window) {
  contextBridge.exposeInMainWorld("desktopUpdates", {
    command: (command) => ipcRenderer.invoke("desktop:update", command),
    onStatus: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on("desktop:update-status", listener);
      return () => ipcRenderer.removeListener("desktop:update-status", listener);
    },
  });
}
const pending = new Set();
ipcRenderer.on("desktop:invoke", (_event, request) => {
  pending.add(request.id);
  window.postMessage(
    { channel: "plasmic-desktop-request", ...request },
    location.origin,
  );
});
window.addEventListener("message", (event) => {
  if (
    event.source !== window ||
    event.origin !== location.origin ||
    event.data?.channel !== "plasmic-desktop-response" ||
    !pending.delete(event.data.id)
  ) {
    return;
  }
  ipcRenderer.send("desktop:result", event.data.id, event.data.result);
});

window.addEventListener("message", (event) => {
  if (
    event.source === window &&
    event.origin === location.origin &&
    event.data?.channel === "plasmic-desktop-google-start"
  ) {
    ipcRenderer.send("desktop:google-start");
  }
});
if (location.pathname === "/desktop/google-login") {
  contextBridge.exposeInMainWorld("desktopGoogleLogin", {
    command: (command) => ipcRenderer.invoke("desktop:google-command", command),
    onStatus: (callback) =>
      ipcRenderer.on("desktop:google-status", (_event, status) =>
        callback(status),
      ),
  });
}
