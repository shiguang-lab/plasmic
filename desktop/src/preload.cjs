const { ipcRenderer, contextBridge } = require("electron");
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

if (window.top === window) {
  contextBridge.exposeInMainWorld("desktopMcpSettings", {
    get: () => ipcRenderer.invoke("desktop:mcp-settings", "get"),
    set: (id, enabled) =>
      ipcRenderer.invoke("desktop:mcp-settings", "set", { id, enabled }),
    copy: () => ipcRenderer.invoke("desktop:mcp-settings", "copy"),
    onOpen: (callback) => {
      const listener = () => callback();
      ipcRenderer.on("desktop:mcp-settings-open", listener);
      return () =>
        ipcRenderer.removeListener("desktop:mcp-settings-open", listener);
    },
  });
}
