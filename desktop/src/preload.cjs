const { ipcRenderer, contextBridge } = require("electron");
if (window.top === window) {
  const languageArg = process.argv.find((arg) =>
    arg.startsWith("--shiguang-system-languages="),
  );
  contextBridge.exposeInMainWorld("desktopEnvironment", {
    setUiLocale: (locale) => ipcRenderer.invoke("desktop:ui-locale", locale),
    getUiMessages: () => {
      const stored = window.localStorage.getItem("shiguang.ui.language");
      return ipcRenderer.invoke(
        "desktop:ui-locale",
        ["en", "zh-CN", "zh-TW", "ja", "ko"].includes(stored)
          ? stored
          : undefined,
      );
    },
    onUiLocale: (callback) => {
      const listener = (_event, snapshot) => callback(snapshot);
      ipcRenderer.on("desktop:ui-locale", listener);
      return () => ipcRenderer.removeListener("desktop:ui-locale", listener);
    },
    systemLanguages: languageArg
      ? JSON.parse(languageArg.slice("--shiguang-system-languages=".length))
      : navigator.languages,
  });
  contextBridge.exposeInMainWorld("desktopUpdates", {
    command: (command) => ipcRenderer.invoke("desktop:update", command),
    onOpen: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on("desktop:update-open", listener);
      return () => ipcRenderer.removeListener("desktop:update-open", listener);
    },
    onStatus: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on("desktop:update-status", listener);
      return () =>
        ipcRenderer.removeListener("desktop:update-status", listener);
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

if (location.pathname === "/desktop/unified-login") {
  contextBridge.exposeInMainWorld("desktopUnifiedLogin", {
    command: (command) => ipcRenderer.invoke("desktop:auth-command", command),
    onStatus: (callback) =>
      ipcRenderer.on("desktop:auth-status", (_event, status) =>
        callback(status),
      ),
  });
}
