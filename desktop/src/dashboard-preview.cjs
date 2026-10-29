const { BrowserWindow, app, ipcMain } = require("electron");
const path = require("node:path");

const TIMEOUT_MS = 90_000;
const HOST_PATH = "/static/desktop/preview-host.html";
const ENGINE_PATH = "/canvas-preview/index.html";

// Renders Dashboard canvas previews in a dedicated offscreen window. Its own
// renderer process runs model loading, code generation, rendering and
// capture, so the Dashboard's main thread stays free for input.
function createDashboardPreviews({ session, studioOrigin, trustedSender }) {
  const jobs = new Map();
  let queue = Promise.resolve();

  function render(id, src, request, scale) {
    let cancel = () => {};
    let cancelled = false;
    jobs.set(id, () => { cancelled = true; cancel(); });
    const result = queue.then(() => {
      if (cancelled) {throw abortError();}
      return new Promise((resolve, reject) => {
        const win = new BrowserWindow({
          show: false,
          width: 1440,
          height: 1024,
          useContentSize: true,
          webPreferences: {
            devTools: !app.isPackaged,
            session,
            preload: path.join(__dirname, "preview-host-preload.cjs"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            // Match the Dashboard's pixel ratio so canvas-based content sizes its backing store identically.
            offscreen: { deviceScaleFactor: scale },
            backgroundThrottling: false,
          },
        });
        const contents = win.webContents;
        let settled = false;
        const finish = (error, bytes) => {
          if (settled) {return;}
          settled = true;
          clearTimeout(timer);
          ipcMain.removeListener("desktop:preview-host-result", onResult);
          ipcMain.removeListener("desktop:preview-host-error", onError);
          // Destroy the whole renderer, including codegen memoization, roots and timers.
          if (!win.isDestroyed()) {win.destroy();}
          if (error) {reject(error);} else {resolve(bytes);}
        };
        const onResult = (event, bytes) => {
          if (event.sender !== contents) {return;}
          finish(undefined, new Uint8Array(bytes));
        };
        const onError = (event, message) => {
          if (event.sender !== contents) {return;}
          finish(new Error(String(message)));
        };
        const timer = setTimeout(() => finish(new Error("Canvas preview timed out")), TIMEOUT_MS);
        cancel = () => finish(abortError());
        ipcMain.on("desktop:preview-host-result", onResult);
        ipcMain.on("desktop:preview-host-error", onError);
        contents.setWindowOpenHandler(() => ({ action: "deny" }));
        contents.on("will-navigate", (event) => event.preventDefault());
        contents.on("will-attach-webview", (event) => event.preventDefault());
        contents.on("render-process-gone", () => finish(new Error("Canvas preview renderer exited")));
        win.loadURL(studioOrigin + HOST_PATH).then(
          () => contents.send("desktop:preview-host-start", { src, request }),
          () => finish(new Error("Canvas preview failed to load")),
        );
      });
    });
    queue = result.catch(() => {});
    return result.finally(() => jobs.delete(id));
  }

  ipcMain.handle("desktop:dashboard-preview", (event, id, src, request, scale) => {
    if (!trustedSender(event)) {throw new Error("Invalid Studio page");}
    if (typeof id !== "string" || !/^[\w-]{1,64}$/.test(id) || jobs.has(id)) {throw new Error("Invalid preview job");}
    const url = new URL(String(src));
    if (url.origin !== studioOrigin || url.pathname !== ENGINE_PATH) {throw new Error("Invalid preview renderer");}
    if (!request || typeof request !== "object" || typeof request.projectId !== "string" || !Number.isInteger(request.revision)) {
      throw new Error("Invalid preview request");
    }
    const ratio = Number(scale);
    // A reloaded or closed Dashboard can no longer cancel its jobs; do it here,
    // like removing the Dashboard document destroyed its preview iframe.
    const sender = event.sender;
    const abandon = (_event, _url, isSameDocument, isMainFrame) => {
      if (isMainFrame === undefined || (isMainFrame && !isSameDocument)) {jobs.get(id)?.();}
    };
    sender.once("destroyed", abandon);
    sender.on("did-start-navigation", abandon);
    return render(id, url.href, request, Number.isFinite(ratio) ? Math.min(4, Math.max(1, ratio)) : 1)
      .finally(() => {
        sender.removeListener("destroyed", abandon);
        sender.removeListener("did-start-navigation", abandon);
      });
  });
  const onCancel = (event, id) => {
    if (trustedSender(event)) {jobs.get(id)?.();}
  };
  ipcMain.on("desktop:dashboard-preview-cancel", onCancel);
  return {
    dispose() {
      ipcMain.removeHandler("desktop:dashboard-preview");
      ipcMain.removeListener("desktop:dashboard-preview-cancel", onCancel);
      for (const cancelJob of jobs.values()) {cancelJob();}
    },
  };
}

function abortError() {
  const error = new Error("Canvas preview was cancelled");
  error.name = "AbortError";
  return error;
}

module.exports = { createDashboardPreviews };
