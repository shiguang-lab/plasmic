const { ipcRenderer, contextBridge } = require("electron");
if (window.top === window) {
  let browserExpanded = false;
  let editorVisibility, editorInert;
  ipcRenderer.on("desktop:reference-browser-mode", (_event, { expanded }) => {
    if (browserExpanded === expanded) return;
    browserExpanded = expanded;
    const root = document.documentElement;
    if (expanded) {
      editorVisibility = root.style.visibility;
      editorInert = root.inert;
      root.style.visibility = "hidden";
      root.inert = true;
    } else {
      root.style.visibility = editorVisibility;
      root.inert = editorInert;
    }
  });
  contextBridge.exposeInMainWorld("desktopBrowser", {
    open: () => ipcRenderer.invoke("desktop:open-reference-browser"),
    openPreview: (url) => ipcRenderer.invoke("desktop:open-preview", url),
  });
  window.addEventListener("DOMContentLoaded", () => {
    const appearance = document.documentElement.dataset.uiAppearance;
    if (appearance === "dark" || appearance === "light") {
      void ipcRenderer.invoke("desktop:ui-appearance", appearance);
    }
  });
  const languageArg = process.argv.find((arg) =>
    arg.startsWith("--shiguang-system-languages="),
  );
  contextBridge.exposeInMainWorld("desktopEnvironment", {
    setUiAppearance: (appearance) =>
      ipcRenderer.invoke("desktop:ui-appearance", appearance),
    setUiLocale: (locale) => ipcRenderer.invoke("desktop:ui-locale", locale),
    getUiMessages: () => {
      const stored = window.localStorage.getItem("shiguang.ui.language");
      return ipcRenderer.invoke(
        "desktop:ui-locale",
        ["system", "en", "zh-CN", "zh-TW", "ja", "ko"].includes(stored)
          ? stored
          : "system",
      );
    },
    onUiLocale: (callback) => {
      const listener = (_event, snapshot) => callback(snapshot);
      ipcRenderer.on("desktop:ui-locale", listener);
      return () => ipcRenderer.removeListener("desktop:ui-locale", listener);
    },
    consumeStartupData: (projectId) =>
      ipcRenderer.invoke("desktop:startup-data", projectId),
    getSavedEditorView: (projectId) =>
      ipcRenderer.invoke("desktop:saved-editor-view", projectId),
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
