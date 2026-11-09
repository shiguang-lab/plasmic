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
  if (!rect || point.x < rect.x || point.y < rect.y || point.x > rect.x + rect.width || point.y > rect.y + rect.height) {return false;}
  const radius = Math.min(rect.radius || 0, rect.width / 2, rect.height / 2);
  const x = Math.max(rect.x + radius, Math.min(point.x, rect.x + rect.width - radius));
  const y = Math.max(rect.y + radius, Math.min(point.y, rect.y + rect.height - radius));
  return (point.x - x) ** 2 + (point.y - y) ** 2 <= radius ** 2;
}

function createIsland({ getWindow, getStudio, controller, identity, i18n, appearance, config, signIn, isQuitting, changed = () => {} }) {
  const page = pathToFileURL(path.join(__dirname, "island.html")).href;
  const preference = path.join(app.getPath("userData"), "presentation.json");
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(preference, "utf8")); } catch { /* First launch has no presentation preference. */ }
  let closeAction = CLOSE_ACTIONS.includes(saved.closeAction) ? saved.closeAction : "ask";
  let mode = MODES.includes(saved.mode) ? saved.mode : "window";
  let window, context = { allowed: false }, image = null, stale = false, epoch = 0;
  let disposed = false, expanded = false, reading, capturing, drag, hit, inside = false;
  let publishedState, publishedImage;
  let hoverUntil = 0;
  let updates, updateOpen = false;
  let transitions = Promise.resolve();
  let fullscreenWait, navigationUrl;
  let refreshTimer, captureTimer, hitTimer;
  let lastResource, lastCanvasOperation;
  const mirror = createIslandCapture();
  const framingOperations = () => [...controller.activity.operations.values(), ...(lastCanvasOperation ? [lastCanvasOperation] : [])];
  const account = new IslandAccount(() => identity.read(), (requestPath, signal) => controller.requestStudio(requestPath, undefined, AbortSignal.any([signal, AbortSignal.timeout(10_000)])), publish);
  const identityChanged = () => {
    account.invalidate();
    publish(); void refresh();
  };
  identity.on("changed", identityChanged);
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
    if (disposed || mode !== "island" || !window || window.isDestroyed()) {return;}
    const wasExpanded = expanded;
    const signedOut = !context.allowed && account.snapshot().status === "signed-out";
    expanded = mode === "island" && (updateOpen || !signedOut && (controller.activity.keepExpanded() || inside || performance.now() < hoverUntil));
    if (wasExpanded && !expanded) {
      mirror.close();
    }
    const value = snapshot();
    const source = value.image?.src;
    if (value.image) {
      const { src, ...details } = value.image;
      value.image = details;
    }
    const key = JSON.stringify(value);
    if (key === publishedState && source === publishedImage) {return;}
    if (value.image && source !== publishedImage) {value.image.src = source;}
    window.webContents.send("desktop:island-state", value);
    publishedState = key;
    publishedImage = source;
  }
  async function refresh() {
    if (reading || disposed || mode !== "island") {return;}
    if (navigationUrl) { updateContext({url:navigationUrl,ready:false}); publish(); return; }
    const task = {};
    reading = task;
    const version = epoch;
    try {
      const state = await controller.state();
      if (disposed || mode !== "island" || version !== epoch) {return;}
      updateContext(state);
      publish();
    } catch {
      if (version === epoch) {
        updateContext({ url: getStudio()?.webContents?.getURL?.(), ready: false });
        publish();
      }
    } finally { if (reading === task) {reading = undefined;} }
  }
  function updateContext(state, forceAccountRefresh = false) {
    const pathname = state.url ? new URL(state.url).pathname : "";
    const routeProject = pathname.match(/^\/projects\/([^/]+)/)?.[1] || null;
    const actual = currentContext({ ...state, projectId: state.projectId ?? routeProject }, config.studioOrigin), editor = state.editorContext || {};
    // Editor routes govern image eligibility; signed-out accounts stay compact.
    const loading = !actual.ready || !actual.mode || !!actual.sessionProjectId || !!actual.routeProjectId;
    const allowed = actual.surface === "editor" && (loading || actual.mode !== "preview" || ["in-app", "interactive"].includes(actual.previewKind));
    const sameProject = actual.projectId === context.projectId;
    const editorMode = actual.mode || (allowed ? "edit" : null);
    const identity = JSON.stringify([state.url, actual.projectId, actual.sessionId, editorMode, actual.previewKind, editor.previewContext?.componentUuid,
      editor.previewContext?.path, editor.editorView?.arenaId, actual.branchId]);
    if (identity !== context.identity || !allowed || loading) { epoch++; image = null; stale = false; }
    context = { ...actual, mode: editorMode, allowed, loading, identity,
      changeCounter: editor.changeCounter,
      projectName: !actual.sessionProjectId && editor.projectName || (sameProject ? context.projectName : null) || "Plasmic",
      pageName: editorMode === "preview" ? editor.previewContext?.path || "" : editor.componentName || "",
      previewContext: editor.previewContext || null,
      viewName: !loading ? (editorMode === "preview" ? editor.previewContext?.componentName : editor.canvasName || editor.componentName) || "" : "",
      projectSummary: !loading ? editor.projectSummary : null,
      saveStatus: !loading ? editor.saveStatus : null,
      desktopDraftStatus: !loading ? editor.desktopDraftStatus : null };
    context.orgId = pathname.match(/^\/orgs\/([^/]+)/)?.[1] || null;
    context.workspaceId = pathname.match(/^\/workspaces\/([^/]+)/)?.[1] || null;
    if (!state.url || new URL(state.url).origin !== config.studioOrigin || actual.surface === "login") {account.clear("signed-out");}
    else {void account.refresh(context.workspaceId, forceAccountRefresh);}
  }
  async function capture() {
    const win = getWindow();
    if (capturing || disposed || mode !== "island" || !expanded || updateOpen || !context.allowed || context.loading || !win || win.isDestroyed()) {return;}
    const task = {};
    capturing = task;
    const version = epoch;
    try {
      const result = await mirror.capture(getStudio(), context, controller.activity.snapshot(context.projectId, context.sessionId).operation, framingOperations());
      if (disposed || version !== epoch || mode !== "island" || !expanded) {return;}
      if (result) { image = { ...result, identity: context.identity }; stale = false; }
      else {stale = true;}
      publish();
    } catch (error) { if (error?.name !== "AbortError" && expanded && version === epoch) { stale = true; publish(); } }
    finally { if (capturing === task) {capturing = undefined;} }
  }
  function updateHit() {
    if (!window || window.isDestroyed() || mode !== "island") {return;}
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
    if (expanded && !updateOpen && !inside && performance.now() >= hoverUntil && !controller.activity.keepExpanded()) {publish();}
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
    if (window && !window.isDestroyed()) {return;}
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
    const created = window;
    window.on("closed", () => {
      if (window !== created) {return;}
      window = undefined;
      if (!disposed && !isQuitting() && mode === "island") {void setMode("window");}
    });
    placeWindow();
    await window.loadURL(page);
    publish();
  }
  function start() {
    if (refreshTimer) {return;}
    refreshTimer = setInterval(() => void refresh(), 500);
    captureTimer = setInterval(() => void capture(), 500);
    hitTimer = setInterval(updateHit, 40);
    for (const timer of [refreshTimer, captureTimer, hitTimer]) {timer.unref();}
    void refresh();
  }
  function stop() {
    for (const timer of [refreshTimer, captureTimer, hitTimer]) {clearInterval(timer);}
    refreshTimer = captureTimer = hitTimer = undefined;
    mirror.reset();
    epoch++; image = null; expanded = false; updateOpen = false; drag = undefined; inside = false; hoverUntil = 0;
    reading = capturing = undefined;
    context = { allowed: false };
    lastCanvasOperation = undefined;
    publishedState = publishedImage = undefined;
    account.invalidate();
    if (window && !window.isDestroyed()) {
      saved.position = window.getPosition();
      const previous = window;
      window = undefined;
      previous.destroy();
    }
  }
  function setMode(value) {
    if (!MODES.includes(value)) {throw new Error("Invalid display mode");}
    const next = transitions.then(() => changeMode(value));
    transitions = next.catch(() => {});
    return next;
  }
  async function fullscreen(win, value) {
    if (win.isFullScreen() === value) {return;}
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
    if (disposed || !win || win.isDestroyed()) {return;}
    // macOS leaves native fullscreen asynchronously, before a window may hide.
    if (value !== "fullscreen") {await fullscreen(win, false);}
    if (disposed || win.isDestroyed()) {return;}
    if (value === "island") {
      if (mode !== "island" || !window) {
        mode = value;
        const latest = controller.activity.latest;
        lastCanvasOperation = latest && ["read", "write", "view"].includes(latest.kind) ? latest : undefined;
        updateContext({url: navigationUrl || getStudio().webContents.getURL(), ready: false}, true);
      }
      await ensureWindow();
      if (disposed || win.isDestroyed()) {return;}
      mode = value;
      if (win.isMinimized()) {win.restore();}
      getStudio().webContents.setBackgroundThrottling(false);
      win.hide();
      if (process.platform === "darwin") {
        app.setActivationPolicy("accessory");
        app.dock.hide();
      }
      window.showInactive();
      start(); publish();
    } else {
      mode = value; stop();
      // Restoring a window does not restore the macOS foreground app identity.
      if (process.platform === "darwin") {
        app.setActivationPolicy("regular");
        await app.dock.show();
      }
      if (win.isMinimized()) {win.restore();}
      win.show(); win.focus();
      await fullscreen(win, value === "fullscreen");
    }
    if (disposed || win.isDestroyed()) {return;}
    persist(); changed(mode);
    return { mode };
  }
  function showMainWindow() {
    return setMode("window");
  }
  async function exitIsland() {
    await setMode("window");
    if (closeAction === "island") {setCloseAction("ask");}
  }
  function openUpdates() {
    if (!updates || mode !== "island") {return;}
    updateOpen = true;
    publish();
    window?.showInactive();
    if (["idle", "current"].includes(updates.state.phase)) {void updates.command("check");}
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
    if (!CLOSE_ACTIONS.includes(value)) {throw new Error("Invalid closing mode");}
    closeAction = value;
    persist(); changed(mode);
  }
  async function closingAction() {
    if (closeAction !== "ask") {return closeAction;}
    const win = getWindow();
    if (!win || win.isDestroyed()) {return null;}
    const result = await dialog.showMessageBox(win, {
      type: "question", title: i18n.t("Close main window"),
      message: i18n.t("How should Plasmic run after closing the main window?"),
      detail: i18n.t("Dynamic Island keeps your canvas and MCP running. Plasmic reopens in the last display mode."),
      buttons: ["Switch to Dynamic Island", "Quit Plasmic", "Cancel"].map((key) => i18n.t(key)),
      defaultId: 0, cancelId: 2, noLink: true,
      checkboxLabel: i18n.t("Remember this choice"), checkboxChecked: true,
    });
    if (win.isDestroyed() || ![0, 1].includes(result.response)) {return null;}
    const action = result.response === 0 ? "island" : "quit";
    setCloseAction(result.checkboxChecked ? action : "ask");
    return action;
  }
  const handler = async (event, command, input) => {
    const fromIsland = window && event.sender === window.webContents && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === page;
    if (!fromIsland) {throw new Error("Invalid presentation page");}
    if (command === "menu") { menu(window); return { mode }; }
    if (command === "state") {return snapshot();}
    if (command === "show-main") {return showMainWindow();}
    if (command === "show-drafts") {
      await showMainWindow();
      return controller.invoke("showDrafts", {}, 5000);
    }
    if (command === "sign-in") {return signIn();}
    if (command === "update-open") { openUpdates(); return; }
    if (command === "update-check") {
      if (!updateOpen || updates?.state.phase !== "error") {throw new Error("Update retry is not available");}
      return updates.command("check");
    }
    if (command === "update-close") {
      if (updates?.state.phase !== "installing") { updateOpen = false; hoverUntil = performance.now() + 350; publish(); }
      return;
    }
    if (command === "update-install") {
      if (!updateOpen || updates?.state.phase !== "downloaded") {throw new Error("Update confirmation is not open");}
      return updates.command("install");
    }
    if (command === "hit") {
      if (!input || !["x", "y", "width", "height", "radius"].every((key) => Number.isFinite(input[key])) ||
        input.x < 0 || input.y < 0 || input.width < 0 || input.height < 0 || input.x + input.width > 456 || input.y + input.height > 180 || input.radius < 0) {throw new Error("Invalid island region");}
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
    if (disposed || mode !== "island") {return;}
    const latest = controller.activity.latest;
    if (latest && ["read", "write", "view"].includes(latest.kind)) {lastCanvasOperation = latest;}
    if (latest?.id !== lastResource && latest?.phase === "completed" && ["create_project", "create_workspace", "create_org", "rename_project", "move_project", "clone_project"].includes(latest.method)) {
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
    attachContents(contents) {
      const invalidate = (url) => {
        if (disposed || contents !== getStudio()?.webContents || mode !== "island") {return;}
        // Navigation refreshes the summary, but does not change the account.
        // Keep its in-flight read; cookie changes still invalidate that read.
        updateContext({ url: typeof url === "string" ? url : contents.getURL(), ready: false }, true);
        publish(); void refresh();
      };
      contents.on("did-start-navigation", (_event, url, inPlace, main) => {
        if (main && contents === getStudio()?.webContents) { if (!inPlace) {navigationUrl = url;} invalidate(url); }
      });
      contents.on("did-stop-loading", () => { if (contents !== getStudio()?.webContents) return; navigationUrl = undefined; void refresh(); });
      contents.on("did-navigate-in-page", (_event, _url, main) => { if (main) {invalidate(_url);} });
      contents.on("render-process-gone", () => { if (contents !== getStudio()?.webContents) return; navigationUrl = undefined; invalidate(); });
    },
    attach(win) {
      const nativeMode = (value) => {
        if (mode === "island") {return;}
        mode = value; persist(); changed(mode);
      };
      win.on("enter-full-screen", () => nativeMode("fullscreen"));
      win.on("leave-full-screen", () => nativeMode("window"));
      win.once("closed", () => { if (fullscreenWait?.win === win) {fullscreenWait.finish();} stop(); });
    },
    dispose() { disposed = true; identity.removeListener("changed", identityChanged); fullscreenWait?.finish(); stop(); unsubscribe(); stopLocale(); stopAppearance(); updates?.removeListener("status", publish); ipcMain.removeHandler("desktop:presentation"); },
  };
}
module.exports = { createIsland, containsPoint, MODES, CLOSE_ACTIONS };
