const { ipcRenderer, contextBridge } = require("electron");
if (window.top === window) {
  let viewActive = false;
  let receivedViewState = false;
  const viewListeners = new Set();
  const applyViewState = (state) => {
    viewActive = state.active;
    if (document.documentElement) document.documentElement.inert = !viewActive;
    for (const listener of viewListeners) listener(state);
  };
  ipcRenderer.on("desktop:view-state", (_event, state) => {
    receivedViewState = true;
    applyViewState(state);
  });
  void ipcRenderer.invoke("desktop:view-state").then(state => {
    if (!receivedViewState) applyViewState(state);
  }).catch(error => console.warn("Cannot read Desktop view state:", error.message));
  contextBridge.exposeInMainWorld("desktopNavigation", {
    navigate: (url) => ipcRenderer.invoke("desktop:navigate", url),
    isActive: () => viewActive,
    onActiveChange: (callback) => {
      viewListeners.add(callback);
      return () => viewListeners.delete(callback);
    },
  });
  contextBridge.exposeInMainWorld("desktopDrafts", {
    open: (userId, projectId, branchId) => ipcRenderer.invoke("desktop:drafts", "open", { userId, projectId, branchId }),
    list: (userId) => ipcRenderer.invoke("desktop:drafts", "list", { userId }),
    read: async (handle, id) => {
      const data = await ipcRenderer.invoke("desktop:drafts", "read", { handle, id });
      return data === null ? null : JSON.parse(new TextDecoder().decode(data));
    },
    write: async (handle, draftJson) => {
      if (typeof draftJson !== "string") throw new Error("Invalid draft payload");
      // JSON.stringify escapes lone UTF-16 surrogates; preserve them even for a
      // caller supplying literal surrogate code units in its JSON source.
      const json = draftJson.isWellFormed() ? draftJson : JSON.stringify(JSON.parse(draftJson));
      return ipcRenderer.invoke("desktop:drafts", "write", { handle, draftData: new TextEncoder().encode(json) });
    },
    remove: (handle, id, sequence) => ipcRenderer.invoke("desktop:drafts", "remove", { handle, id, sequence }),
  });
  let browserExpanded = false;
  let editorVisibility, editorInert;
  ipcRenderer.on("desktop:reference-browser-mode", (_event, { expanded }) => {
    if (browserExpanded === expanded) {return;}
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
  if (!process.argv.includes("--plasmic-dashboard-preview-in-page")) {
    // Dashboard previews render in a separate offscreen renderer process.
    contextBridge.exposeInMainWorld("desktopPreview", {
      render: (id, src, request, scale) =>
        ipcRenderer.invoke("desktop:dashboard-preview", id, src, request, scale),
      cancel: (id) => ipcRenderer.send("desktop:dashboard-preview-cancel", id),
    });
  }
  contextBridge.exposeInMainWorld("desktopBrowser", {
    open: () => ipcRenderer.invoke("desktop:open-reference-browser"),
    openPreview: (url) => ipcRenderer.invoke("desktop:open-preview", url),
  });
  window.addEventListener("DOMContentLoaded", () => {
    document.documentElement.inert = !viewActive;
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
    consumeStartupData: (projectId, branchName) =>
      ipcRenderer.invoke("desktop:startup-data", projectId, branchName),
    getSavedEditorView: (projectId) =>
      ipcRenderer.invoke("desktop:saved-editor-view", projectId),
    systemLanguages: languageArg
      ? JSON.parse(languageArg.slice("--shiguang-system-languages=".length))
      : navigator.languages,
  });
  contextBridge.exposeInMainWorld("desktopUpdates", {
    closed: () => ipcRenderer.send("desktop:update-dialog-closed"),
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
ipcRenderer.on("desktop:caller-disconnected", (_event, { callerId }) => {
  window.postMessage({ channel: "plasmic-desktop-caller-disconnected", callerId }, location.origin);
});
ipcRenderer.on("desktop:cancel", (_event, { id }) => {
  if (pending.has(id)) {
    window.postMessage({ channel: "plasmic-desktop-cancel", id }, location.origin);
  }
});
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
