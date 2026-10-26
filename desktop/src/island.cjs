const { app, BrowserWindow, ipcMain, Menu, screen, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { currentContext } = require("./tool-context.cjs");
const { createIslandCapture } = require("./island-capture.cjs");
const { IslandAccount } = require("./island-account.cjs");

const MODES = ["window", "fullscreen", "island"];
const CLOSE_ACTIONS = ["ask", "island", "quit"];
function containsPoint(point, rect) {
  if (!rect || point.x < rect.x || point.y < rect.y || point.x > rect.x + rect.width || point.y > rect.y + rect.height) return false;
  const radius = Math.min(rect.radius || 0, rect.width / 2, rect.height / 2);
  const x = Math.max(rect.x + radius, Math.min(point.x, rect.x + rect.width - radius));
  const y = Math.max(rect.y + radius, Math.min(point.y, rect.y + rect.height - radius));
  return (point.x - x) ** 2 + (point.y - y) ** 2 <= radius ** 2;
}

function createIsland({ getWindow, controller, i18n, appearance, config, signIn, changed = () => {} }) {
  const page = pathToFileURL(path.join(__dirname, "island.html")).href;
  const preference = path.join(app.getPath("userData"), "presentation.json");
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(preference, "utf8")); } catch { /* First launch has no presentation preference. */ }
  let closeAction = CLOSE_ACTIONS.includes(saved.closeAction) ? saved.closeAction : "ask";
  let mode = closeAction === "island" ? "island" : MODES.includes(saved.mode) ? saved.mode : "window";
  let window, context = { allowed: false }, image = null, stale = false, epoch = 0;
  let disposed = false, expanded = false, reading = false, capturing = false, drag, hit, inside = false;
  let hoverUntil = 0;
  let updates, updateOpen = false;
  let transitions = Promise.resolve();
  let fullscreenWait, navigationUrl;
  let refreshTimer, captureTimer, hitTimer;
  let cookies, cookieChanged, lastResource, lastCanvasOperation;
  const mirror = createIslandCapture();
  const framingOperations = () => [...controller.activity.operations.values(), ...(lastCanvasOperation ? [lastCanvasOperation] : [])];
  const account = new IslandAccount(path => controller.requestStudio(path, undefined, AbortSignal.timeout(10_000)), publish);
  function persist() {
    const position = window && !window.isDestroyed() ? window.getPosition() : saved.position;
    saved = { mode, position, closeAction };
    fs.writeFileSync(preference + ".tmp", JSON.stringify(saved));
    fs.renameSync(preference + ".tmp", preference);
  }
  function snapshot() {
    return { mode, expanded, context: { ...context, account: account.snapshot() }, image, stale, update: updates?.state, updateOpen,
      updateWaiting: updates?.state.phase === "installing" && controller.activity.operations.size > 0,
      appearance: appearance.snapshot(), localization: i18n.snapshot(),
      activity: controller.activity.snapshot(context.projectId, context.sessionId) };
  }
  function publish() {
    const wasExpanded = expanded;
    const signedOut = !context.allowed && account.snapshot().status === "signed-out";
    expanded = mode === "island" && (updateOpen || !signedOut && (controller.activity.keepExpanded() || inside || performance.now() < hoverUntil));
    if (wasExpanded && !expanded) {
      mirror.close(controller.activity.snapshot(context.projectId, context.sessionId).operation, framingOperations());
      image = null; stale = false;
    }
    if (window && !window.isDestroyed()) window.webContents.send("desktop:island-state", snapshot());
  }
  async function refresh() {
    if (reading || disposed || mode !== "island") return;
    if (navigationUrl) { updateContext({url:navigationUrl,ready:false}); publish(); return; }
    reading = true;
    const version = epoch;
    try {
      const state = await controller.state();
      if (disposed || mode !== "island" || version !== epoch) return;
      updateContext(state);
      publish();
    } catch {
      if (version === epoch) {
        updateContext({ url: getWindow()?.webContents?.getURL?.(), ready: false });
        publish();
      }
    } finally { reading = false; }
  }
  function updateContext(state) {
    const pathname = state.url ? new URL(state.url).pathname : "";
    const routeProject = pathname.match(/^\/projects\/([^/]+)/)?.[1] || null;
    const actual = currentContext({ ...state, projectId: state.projectId ?? routeProject }, config.studioOrigin), editor = state.editorContext || {};
    // Editor routes govern image eligibility; signed-out accounts stay compact.
    const loading = !actual.ready || !actual.mode || !!actual.sessionProjectId || !!actual.routeProjectId;
    const allowed = actual.surface === "editor" && (loading || actual.mode !== "preview" || actual.previewKind === "in-app");
    const sameProject = actual.projectId === context.projectId;
    const mode = actual.mode || (allowed ? "edit" : null);
    const identity = JSON.stringify([state.url, actual.projectId, actual.sessionId, mode, editor.previewContext?.componentUuid,
      editor.previewContext?.path, editor.editorView?.arenaId, actual.frameUuid]);
    if (identity !== context.identity || !allowed || loading) { epoch++; image = null; stale = false; }
    context = { ...actual, mode, allowed, loading, identity,
      projectName: !actual.sessionProjectId && editor.projectName || (sameProject ? context.projectName : null) || "Plasmic",
      pageName: mode === "preview" ? editor.previewContext?.path || "" : editor.componentName || "",
      previewContext: editor.previewContext || null,
      viewName: !loading ? (mode === "preview" ? editor.previewContext?.componentName : editor.canvasName || editor.componentName) || "" : "",
      projectSummary: !loading ? editor.projectSummary : null,
      saveStatus: !loading ? editor.saveStatus : null };
    context.orgId = pathname.match(/^\/orgs\/([^/]+)/)?.[1] || null;
    context.workspaceId = pathname.match(/^\/workspaces\/([^/]+)/)?.[1] || null;
    if (!state.url || new URL(state.url).origin !== config.studioOrigin || actual.surface === "login") account.clear("signed-out");
    else void account.refresh(context.workspaceId);
  }
  async function capture() {
    const win = getWindow();
    if (capturing || disposed || mode !== "island" || !expanded || updateOpen || !context.allowed || context.loading || !win || win.isDestroyed()) return;
    capturing = true;
    const version = epoch;
    try {
      const result = await mirror.capture(win, context, controller.activity.snapshot(context.projectId, context.sessionId).operation, framingOperations());
      if (disposed || version !== epoch || mode !== "island") return;
      if (result) { image = { ...result, identity: context.identity }; stale = false; }
      else stale = true;
      publish();
    } catch { if (version === epoch) { stale = true; publish(); } }
    finally { capturing = false; }
  }
  function updateHit() {
    if (!window || window.isDestroyed() || mode !== "island") return;
    const cursor = screen.getCursorScreenPoint(), [x, y] = window.getPosition();
    const next = !!drag || containsPoint({ x: cursor.x - x, y: cursor.y - y }, hit);
    if (next !== inside) {
      inside = next;
      if (!inside) {
        hoverUntil = performance.now() + 350;
        controller.activity.dismissExpansion();
      }
      window.setIgnoreMouseEvents(!inside, { forward: true });
      publish();
    }
    if (expanded && !updateOpen && !inside && performance.now() >= hoverUntil && !controller.activity.keepExpanded()) publish();
  }
  function placeWindow() {
    const validPosition = Array.isArray(saved.position) && saved.position.length === 2 && saved.position.every(Number.isFinite);
    const display = screen.getDisplayMatching(validPosition ? { x: saved.position[0], y: saved.position[1], width: 456, height: 180 }
      : getWindow()?.getBounds() || screen.getPrimaryDisplay().bounds);
    const area = display.workArea;
    const position = validPosition ? saved.position : [area.x + (area.width - 456) / 2, area.y + 4];
    window.setPosition(Math.round(Math.max(area.x, Math.min(area.x + area.width - 456, position[0]))),
      Math.round(Math.max(area.y, Math.min(area.y + area.height - 180, position[1]))));
  }
  async function ensureWindow() {
    if (window && !window.isDestroyed()) return;
    window = new BrowserWindow({ width: 456, height: 180, show: false, frame: false, transparent: true,
      backgroundColor: "#00000000", hasShadow: false, resizable: false, minimizable: false, maximizable: false,
      fullscreenable: false, focusable: false, skipTaskbar: true, title: i18n.t("Dynamic Island"),
      webPreferences: { preload: path.join(__dirname, "island-preload.cjs"), nodeIntegration: false,
        contextIsolation: true, sandbox: true, backgroundThrottling: false, devTools: !app.isPackaged } });
    window.setMenu(null);
    window.setAlwaysOnTop(true, "floating");
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.setIgnoreMouseEvents(true, { forward: true });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => event.preventDefault());
    window.webContents.on("will-attach-webview", (event) => event.preventDefault());
    window.on("closed", () => { window = undefined; if (!disposed && mode === "island") void setMode("window"); });
    placeWindow();
    await window.loadURL(page);
    publish();
  }
  function start() {
    if (refreshTimer) return;
    refreshTimer = setInterval(() => void refresh(), 500);
    captureTimer = setInterval(() => void capture(), 500);
    hitTimer = setInterval(updateHit, 40);
    for (const timer of [refreshTimer, captureTimer, hitTimer]) timer.unref();
    void refresh();
  }
  function stop() {
    for (const timer of [refreshTimer, captureTimer, hitTimer]) clearInterval(timer);
    refreshTimer = captureTimer = hitTimer = undefined;
    mirror.close(controller.activity.snapshot(context.projectId, context.sessionId).operation, framingOperations());
    epoch++; image = null; expanded = false; updateOpen = false; drag = undefined; inside = false; hoverUntil = 0;
  }
  function setMode(value) {
    if (!MODES.includes(value)) throw new Error("Invalid display mode");
    const next = transitions.then(() => changeMode(value));
    transitions = next.catch(() => {});
    return next;
  }
  async function fullscreen(win, value) {
    if (win.isFullScreen() === value) return;
    await new Promise((resolve) => {
      const event = value ? "enter-full-screen" : "leave-full-screen";
      const finish = () => { win.removeListener(event, finish); fullscreenWait = undefined; resolve(); };
      fullscreenWait = { win, finish };
      win.once(event, finish);
      win.setFullScreen(value);
    });
  }
  async function changeMode(value) {
    const win = getWindow();
    if (disposed || !win || win.isDestroyed()) return;
    // macOS leaves native fullscreen asynchronously, before a window may hide.
    if (value !== "fullscreen") await fullscreen(win, false);
    if (disposed || win.isDestroyed()) return;
    if (value === "island") {
      if (mode !== "island") mirror.close(controller.activity.snapshot(context.projectId, context.sessionId).operation, framingOperations());
      await ensureWindow();
      if (disposed || win.isDestroyed()) return;
      mode = value;
      if (win.isMinimized()) win.restore();
      win.webContents.setBackgroundThrottling(false);
      win.hide();
      if (process.platform === "darwin") {
        app.setActivationPolicy("accessory");
        app.dock.hide();
      }
      window.showInactive();
      start(); publish();
    } else {
      mode = value; stop(); window?.hide();
      publish();
      // Restoring a window does not restore the macOS foreground app identity.
      if (process.platform === "darwin") {
        app.setActivationPolicy("regular");
        await app.dock.show();
      }
      if (win.isMinimized()) win.restore();
      win.show(); win.focus();
      await fullscreen(win, value === "fullscreen");
    }
    if (disposed || win.isDestroyed()) return;
    persist(); changed(mode);
    return { mode };
  }
  function showMainWindow() {
    return setMode("window");
  }
  async function exitIsland() {
    await setMode("window");
    if (closeAction === "island") setCloseAction("ask");
  }
  function openUpdates() {
    if (!updates || mode !== "island") return;
    updateOpen = true;
    publish();
    window?.showInactive();
    if (["idle", "current"].includes(updates.state.phase)) void updates.command("check");
  }
  function menu(parent) {
    Menu.buildFromTemplate([
      { id: "island-show-main", label: i18n.t("Show main window"), click: () => void showMainWindow().catch(console.error) },
      { id: "island-updates", label: i18n.t("Check for Updates…"), enabled: !!updates, click: openUpdates },
      { type: "separator" },
      { id: "island-exit", label: i18n.t("Exit Dynamic Island mode"), click: () => void exitIsland().catch(console.error) },
      { id: "island-quit", label: i18n.t("Quit application"), click: () => app.quit() },
    ]).popup({ window: parent });
  }
  function setCloseAction(value) {
    if (!CLOSE_ACTIONS.includes(value)) throw new Error("Invalid closing mode");
    closeAction = value;
    persist(); changed(mode);
  }
  async function closingAction() {
    if (closeAction !== "ask") return closeAction;
    const win = getWindow();
    if (!win || win.isDestroyed()) return null;
    const result = await dialog.showMessageBox(win, {
      type: "question", title: i18n.t("Close main window"),
      message: i18n.t("How should Plasmic run after closing the main window?"),
      detail: i18n.t("Dynamic Island keeps your canvas and MCP running. If remembered, Plasmic will also start in Dynamic Island next time."),
      buttons: ["Switch to Dynamic Island", "Quit Plasmic", "Cancel"].map((key) => i18n.t(key)),
      defaultId: 0, cancelId: 2, noLink: true,
      checkboxLabel: i18n.t("Remember this choice"), checkboxChecked: true,
    });
    if (win.isDestroyed() || ![0, 1].includes(result.response)) return null;
    const action = result.response === 0 ? "island" : "quit";
    setCloseAction(result.checkboxChecked ? action : "ask");
    return action;
  }
  const handler = async (event, command, input) => {
    const fromIsland = window && event.sender === window.webContents && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === page;
    if (!fromIsland) throw new Error("Invalid presentation page");
    if (command === "menu") { menu(window); return { mode }; }
    if (command === "state") return snapshot();
    if (command === "show-main") return showMainWindow();
    if (command === "sign-in") return signIn();
    if (command === "update-open") { openUpdates(); return; }
    if (command === "update-check") {
      if (!updateOpen || updates?.state.phase !== "error") throw new Error("Update retry is not available");
      return updates.command("check");
    }
    if (command === "update-close") {
      if (updates?.state.phase !== "installing") { updateOpen = false; hoverUntil = performance.now() + 350; publish(); }
      return;
    }
    if (command === "update-install") {
      if (!updateOpen || updates?.state.phase !== "downloaded") throw new Error("Update confirmation is not open");
      return updates.command("install");
    }
    if (command === "hit") {
      if (!input || !["x", "y", "width", "height", "radius"].every((key) => Number.isFinite(input[key])) ||
        input.x < 0 || input.y < 0 || input.width < 0 || input.height < 0 || input.x + input.width > 456 || input.y + input.height > 180 || input.radius < 0) throw new Error("Invalid island region");
      hit = input; updateHit(); return;
    }
    if (command === "drag-start") { drag = { point: screen.getCursorScreenPoint(), position: window.getPosition() }; return; }
    if (command === "drag-move" && drag) {
      const point = screen.getCursorScreenPoint();
      window.setPosition(drag.position[0] + point.x - drag.point.x, drag.position[1] + point.y - drag.point.y); return;
    }
    if (command === "drag-end") { drag = undefined; placeWindowAfterDrag(); persist(); return; }
    throw new Error("Invalid island command");
  };
  function placeWindowAfterDrag() { saved.position = window.getPosition(); placeWindow(); }
  ipcMain.handle("desktop:presentation", handler);
  const unsubscribe = controller.activity.subscribe(() => {
    const latest = controller.activity.latest;
    if (latest && ["read", "write", "view"].includes(latest.kind)) lastCanvasOperation = latest;
    if (latest?.id !== lastResource && latest?.phase === "completed" && ["create_project", "create_workspace", "create_org"].includes(latest.method)) {
      lastResource = latest.id;
      account.invalidate(false);
    }
    publish();
  });
  const stopLocale = i18n.subscribe(publish), stopAppearance = appearance.subscribe(publish);
  return { get mode() { return mode; }, get closeAction() { return closeAction; }, setMode, setCloseAction, closingAction, menu, snapshot, openUpdates,
    attachUpdates(manager) {
      updates?.removeListener("status", publish);
      updates = manager;
      updates.on("status", publish);
      publish();
    },
    attach(win) {
      cookies = win.webContents.session.cookies;
      const values = new Map();
      const key = cookie => `${cookie.domain}:${cookie.path}:${cookie.name}`;
      void cookies.get({ url: config.studioOrigin }).then(items => {
        for (const cookie of items) if (cookie.httpOnly && !values.has(key(cookie))) values.set(key(cookie), cookie.value);
      }).catch(() => {});
      cookieChanged = (_event, cookie, cause, removed) => {
        const host = new URL(config.studioOrigin).hostname, domain = cookie.domain.replace(/^\./, "");
        if (!cookie.httpOnly || !(host === domain || host.endsWith(`.${domain}`)) || removed && cause === "overwrite") return;
        const id = key(cookie), next = removed ? null : cookie.value;
        if (values.get(id) === next) return;
        values.set(id, next);
        account.invalidate();
        publish(); void refresh();
      };
      cookies.on("changed", cookieChanged);
      const invalidate = (url) => {
        account.invalidate(false);
        updateContext({ url: typeof url === "string" ? url : win.webContents.getURL(), ready: false });
        publish(); void refresh();
      };
      win.webContents.on("did-start-navigation", (_event, url, inPlace, main) => {
        if (main) { if (!inPlace) navigationUrl = url; invalidate(url); }
      });
      win.webContents.on("did-stop-loading", () => { navigationUrl = undefined; void refresh(); });
      win.webContents.on("did-navigate-in-page", (_event, _url, main) => { if (main) invalidate(_url); });
      win.webContents.on("render-process-gone", () => { navigationUrl = undefined; invalidate(); });
      const nativeMode = (value) => {
        if (mode === "island") return;
        mode = value; persist(); changed(mode);
      };
      win.on("enter-full-screen", () => nativeMode("fullscreen"));
      win.on("leave-full-screen", () => nativeMode("window"));
      win.once("closed", () => { if (fullscreenWait?.win === win) fullscreenWait.finish(); stop(); window?.hide(); });
    },
    dispose() { disposed = true; account.dispose(); cookies?.removeListener("changed", cookieChanged); fullscreenWait?.finish(); stop(); unsubscribe(); stopLocale(); stopAppearance(); updates?.removeListener("status", publish); ipcMain.removeHandler("desktop:presentation"); window?.destroy(); },
  };
}
module.exports = { createIsland, containsPoint, MODES, CLOSE_ACTIONS };
