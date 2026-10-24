const { uiError } = require("./ui-error.cjs");
const {
  app,
  BrowserWindow,
  dialog,
  Menu,
  MenuItem,
  session,
  shell,
  clipboard,
  ipcMain,
  nativeTheme,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const config = require("../desktop.config.json");
const appIcon = path.join(
  __dirname,
  "..",
  "assets",
  process.platform === "win32" ? "icon.ico" : "icon.png",
);
const { createAssetHandler } = require("./asset-handler.cjs");
const { forwardRemoteRequest } = require("./remote-fetch.cjs");
const { openBrowser } = require("./open-browser.cjs");
const { UnifiedAuthWindow, AUTH_PATH } = require("./unified-auth-window.cjs");
const { createSessionRecovery } = require("./session-recovery.cjs");
const { createDeviceCredentials } = require("./device-credentials.cjs");
const { DesktopController } = require("./controller.cjs");
const { startRpc } = require("./local-rpc.cjs");
const { McpIntegrations } = require("./mcp-integrations.cjs");
const { createMcpSettings } = require("./mcp-settings.cjs");
const { createDesktopAppearance } = require("./ui-appearance.cjs");
const { createIsland, MODES, CLOSE_ACTIONS } = require("./island.cjs");
const desktopAppearance = createDesktopAppearance(
  nativeTheme.shouldUseDarkColors ? "dark" : "light",
);
const { createUpdates, acknowledgeMacUpdate } = require("./updates.cjs");
const { createUpdateDialog } = require("./update-dialog.cjs");
const {
  DesktopWorkspace,
  fileMenu,
  updateFileMenuContext,
} = require("./workspace.cjs");
const { attachWindowRecovery } = require("./window-recovery.cjs");
let controller, stopRpc, openMcpSettings, updates, openUpdates, workspace, presentation;
let quitting = false;

let mainWindow;
let desktopSession;
let unifiedAuth;
let recoverSession;
let desktopLogin;
let startingDesktop;
let desktopI18n;
const { createDesktopI18n } = require("./i18n.cjs");
const { ReferenceBrowser } = require("./reference-browser.cjs");
const {
  DesktopUnifiedLogin,
  AUTH_ORIGIN,
  APP_CALLBACK_URL,
} = require("./unified-login.cjs");
function trustedAuthSender(event) {
  return (
    mainWindow &&
    event.sender === mainWindow.webContents &&
    event.senderFrame === event.sender.mainFrame &&
    new URL(event.senderFrame.url).origin === config.studioOrigin
  );
}
function openDesktopPreview(event, url) {
  if (!trustedAuthSender(event)) throw new Error("Invalid Studio page");
  const parsed = new URL(url);
  if (
    parsed.origin !== config.studioOrigin ||
    !/^\/projects\/[^/]+\/preview-full(?:\/|$)/.test(parsed.pathname)
  ) {
    throw new Error("Invalid preview URL");
  }
  return openBrowser(url);
}
const trustedOrigins = new Set([config.studioOrigin, config.canvasOrigin]);
function isInternal(url) {
  try {
    return trustedOrigins.has(new URL(url).origin);
  } catch {
    return false;
  }
}
function openExternal(url) {
  if (["https:", "http:"].includes(new URL(url).protocol)) {
    void shell.openExternal(url);
  }
}
function isUnifiedLogin(url) {
  const parsed = new URL(url);
  return parsed.origin === AUTH_ORIGIN && parsed.pathname === "/login";
}
function protectWindow(win) {
  const syncBackground = (appearance) => {
    if (!win.isDestroyed()) {
      win.setBackgroundColor(appearance === "dark" ? "#15161b" : "#eceef3");
    }
  };
  syncBackground(desktopAppearance.snapshot());
  win.once("closed", desktopAppearance.subscribe(syncBackground));
  for (const eventName of ["will-navigate", "will-redirect"]) {
    win.webContents.on(eventName, (event, url) => {
      if (win === mainWindow && isUnifiedLogin(url)) {
        event.preventDefault();
        void unifiedAuth.show(url);
      } else if (!isInternal(url)) {
        event.preventDefault();
        openExternal(url);
      }
    });
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (win === mainWindow && isUnifiedLogin(url)) {
      void unifiedAuth.show(url);
      return { action: "deny" };
    }
    const parsed = new URL(url);
    if (
      parsed.origin === config.studioOrigin &&
      /^\/projects\/[^/]+\/preview-full(?:\/|$)/.test(parsed.pathname)
    ) {
      void openBrowser(url);
      return { action: "deny" };
    }
    if (!isInternal(url)) {
      openExternal(url);
      return { action: "deny" };
    }
    void (async () => {
      await controller.saveBeforeNavigation(await controller.state([]));
      await win.loadURL(url);
    })().catch((error) => {
      console.error("Desktop navigation failed", error);
      dialog.showErrorBox(
        desktopI18n.t("Operation Failed"),
        desktopI18n.t("Please try again"),
      );
    });
    return { action: "deny" };
  });
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());
}

async function startDesktop() {
  if (process.platform === "darwin") {
    await acknowledgeMacUpdate(app, false);
  }
  if (process.platform === "darwin") {
    app.dock.setIcon(appIcon);
  }
  const root = path.join(__dirname, "..", "renderer");
  desktopI18n ??= createDesktopI18n(
    path.join(root, "ui-locales"),
    app.getPreferredSystemLanguages(),
  );
  const { t } = desktopI18n;
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "desktop-assets.json"), "utf8"),
  );
  if (
    manifest.studioOrigin !== config.studioOrigin ||
    manifest.canvasOrigin !== config.canvasOrigin ||
    manifest.webImage !== config.webImage ||
    !fs.existsSync(path.join(root, "index.html"))
  ) {
    throw new Error(
      "Bundled assets do not match desktop.config.json; run npm run assets.",
    );
  }
  app.setAboutPanelOptions({
    applicationName: "Plasmic",
    applicationVersion: app.getVersion(),
    version: `${manifest.build.kind} · ${manifest.build.revision?.slice(0, 10) || "unknown"}${manifest.build.dirty ? " + local changes" : ""}\nRenderer ${manifest.build.rendererHash.slice(0, 12)}\nBuilt ${manifest.build.builtAt}`,
  });
  if (!desktopSession) {
    desktopSession = session.fromPartition("persist:plasmic-desktop");
    desktopLogin = new DesktopUnifiedLogin({
      session: desktopSession,
      studioOrigin: config.studioOrigin,
      credentials: createDeviceCredentials({
        file: path.join(app.getPath("userData"), "device-session.json"),
      }),
    });
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (proxy) {
      await desktopSession.setProxy({
        proxyRules: proxy,
        proxyBypassRules: process.env.NO_PROXY || "",
      });
    }
    desktopSession.setPermissionRequestHandler(
      (contents, permission, callback, details) => {
        callback(
          isInternal(details.requestingUrl || contents.getURL()) &&
            [
              "clipboard-read",
              "clipboard-sanitized-write",
              "fullscreen",
            ].includes(permission),
        );
      },
    );
    desktopSession.protocol.handle(
      "https",
      createAssetHandler({
        root,
        ...config,
        localCanvasLibraries: manifest.localCanvasLibraries,
        bridgePath: path.join(__dirname, "editor-bridge.js"),
        authPagePath: path.join(__dirname, "unified-login.html"),
        updateUiPath: path.join(__dirname, "update-ui.js"),
        updateDialogPath: path.join(__dirname, "update-dialog.js"),
        rendererI18nPath: path.join(__dirname, "renderer-i18n.js"),
        bundledFontCss: fs
          .readdirSync(path.join(root, "static/desktop-fonts"))
          .filter((file) => file.endsWith(".css"))
          .map((file) =>
            fs.readFileSync(
              path.join(root, "static/desktop-fonts", file),
              "utf8",
            ),
          )
          .join("\n"),
        remoteFetch: async (request) => {
          const url = new URL(request.url);
          const api =
            url.origin === config.studioOrigin &&
            url.pathname.startsWith("/api/v1/");
          const logout =
            url.origin === config.studioOrigin &&
            url.pathname === "/api/auth/logout" &&
            request.method === "POST";
          if (api || logout) {
            try {
              await desktopLogin.restore();
            } catch (error) {
              console.warn("Cannot restore desktop session:", error.message);
            }
          }
          const retry = api ? request.clone() : undefined;
          const response = await forwardRemoteRequest(desktopSession, request);
          if (logout && response.ok) {
            await desktopLogin.signOut().catch((error) => {
              console.warn(
                "Cannot clean up revoked device tokens:",
                error.message,
              );
            });
          }
          if (await recoverSession(response, request.url)) {
            return forwardRemoteRequest(desktopSession, retry);
          }
          return response;
        },
      }),
    );
  }
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 720,
    title: "Plasmic",
    icon: appIcon,
    show: false,
    backgroundColor:
      desktopAppearance.snapshot() === "dark" ? "#15161b" : "#eceef3",
    ...(process.platform === "darwin"
      ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 24, y: 22 } }
      : process.platform === "win32"
        ? {
            titleBarStyle: "hidden",
            titleBarOverlay: {
              color: "#15161b",
              symbolColor: "#edeef5",
              height: 40,
            },
          }
        : {}),
    webPreferences: {
      devTools: !app.isPackaged,
      session: desktopSession,
      preload: path.join(__dirname, "preload.cjs"),
      additionalArguments: [
        `--shiguang-system-languages=${JSON.stringify(app.getPreferredSystemLanguages())}`,
      ],
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });
  mainWindow.webContents.setUserAgent(
    `${mainWindow.webContents.getUserAgent()} PlasmicDesktop/${process.platform}`,
  );
  const appearanceWindow = mainWindow;
  if (process.platform === "darwin") {
    const alignWindowButtons = () => {
      if (!appearanceWindow.isDestroyed() && !appearanceWindow.isFullScreen()) {
        appearanceWindow.setWindowButtonPosition({ x: 24, y: 22 });
      }
    };
    for (const event of [
      "show",
      "focus",
      "blur",
      "resize",
      "resized",
      "restore",
      "leave-full-screen",
    ]) {
      appearanceWindow.on(event, () => setImmediate(alignWindowButtons));
    }
  }
  const syncWindowAppearance = (appearance) => {
    if (appearanceWindow.isDestroyed()) {
      return;
    }
    const dark = appearance === "dark";
    if (process.platform === "win32") {
      appearanceWindow.setTitleBarOverlay({
        color: dark ? "#15161b" : "#eceef3",
        symbolColor: dark ? "#edeef5" : "#252936",
        height: 40,
      });
    }
  };
  syncWindowAppearance(desktopAppearance.snapshot());
  const stopAppearance = desktopAppearance.subscribe(syncWindowAppearance);
  mainWindow.once("closed", stopAppearance);
  unifiedAuth = new UnifiedAuthWindow(
    mainWindow,
    config.studioOrigin,
    openBrowser,
    desktopLogin,
  );
  recoverSession = createSessionRecovery({
    session: desktopSession,
    studioOrigin: config.studioOrigin,
    auth: unifiedAuth,
    restore: () => desktopLogin.restore({ force: true }),
    isActive: () => desktopLogin.isActive(),
  });
  const userActivity = () => {
    void desktopLogin.noteActivity().catch((error) => {
      console.warn("Cannot restore desktop session:", error.message);
    });
  };
  mainWindow.on("focus", userActivity);
  mainWindow.webContents.on("before-input-event", userActivity);
  mainWindow.webContents.on("before-mouse-event", (_event, mouse) => {
    if (["mouseDown", "mouseWheel"].includes(mouse.type)) {
      userActivity();
    }
  });
  protectWindow(mainWindow);
  if (!controller) {
    const integrations = new McpIntegrations({
      userData: app.getPath("userData"),
      command: process.execPath,
      args: app.isPackaged ? ["--mcp"] : [app.getAppPath(), "--mcp"],
    });
    integrations.restore();
    openMcpSettings = createMcpSettings(
      integrations,
      () => mainWindow,
      desktopI18n,
      desktopAppearance,
    );
    ipcMain.handle("desktop:ui-appearance", (event, value) => {
      if (!trustedAuthSender(event)) {
        throw new Error("Invalid Studio page");
      }
      desktopAppearance.set(value);
      return desktopAppearance.snapshot();
    });
    ipcMain.handle("desktop:startup-data", (event, projectId) => {
      if (!trustedAuthSender(event) || workspace.projectId(event.senderFrame.url) !== projectId) {
        throw new Error("Invalid Studio page");
      }
      return workspace.consumeStartupData(projectId);
    });
    ipcMain.handle("desktop:saved-editor-view", (event, projectId) => {
      if (
        !trustedAuthSender(event) ||
        workspace?.projectId(event.senderFrame.url) !== projectId
      ) {
        throw new Error("Invalid Studio project");
      }
      return workspace.savedEditorView(event.senderFrame.url);
    });
    ipcMain.handle("desktop:ui-locale", (event, value) => {
      if (!trustedAuthSender(event)) {
        throw new Error("Invalid Studio page");
      }
      if (value !== undefined) {
        desktopI18n.setLocale(value);
      }
      return desktopI18n.snapshot();
    });
    ipcMain.handle("desktop:auth-command", (event, command) => {
      if (
        !trustedAuthSender(event) ||
        new URL(event.senderFrame.url).pathname !== AUTH_PATH
      ) {
        throw new Error("Invalid login page");
      }
      if (
        command === "copy-link" &&
        unifiedAuth.authorizationUrl &&
        unifiedAuth.status.phase === "waiting"
      ) {
        clipboard.writeText(unifiedAuth.authorizationUrl);
        return {
          ...unifiedAuth.status,
          copied: true,
          authorizationUrl: unifiedAuth.authorizationUrl,
        };
      }
      return unifiedAuth.command(command);
    });
    controller = new DesktopController(
      () => mainWindow,
      config,
      () => startingDesktop,
      () => desktopLogin.noteActivity(),
    );
    presentation = createIsland({ getWindow: () => mainWindow, controller,
      i18n: desktopI18n, appearance: desktopAppearance, config,
      changed: (mode) => {
        const menu = Menu.getApplicationMenu();
        const activeMode = menu?.getMenuItemById(`presentation-${mode}`);
        const activeCloseAction = menu?.getMenuItemById(`close-action-${presentation.closeAction}`);
        if (activeMode) activeMode.checked = true;
        if (activeCloseAction) activeCloseAction.checked = true;
      },
    });
    controller.browser = new ReferenceBrowser({
      getParent: () => mainWindow,
      dispatch: (method, input) => controller.dispatch(method, input),
      getImportContext: (input) => controller.browserImportContext(input),
      importHtml: (input) => controller.importBrowserHtml(input),
      uploadImage: (data) => controller.uploadImage(data),
      locate: (result) => controller.locateBrowserImport(result),
      undo: (result) => controller.undoBrowserImport(result),
      i18n: desktopI18n,
      appearance: desktopAppearance,
    });
    ipcMain.handle("desktop:open-preview", openDesktopPreview);
    ipcMain.handle("desktop:open-reference-browser", (event) => {
      if (!trustedAuthSender(event)) throw new Error("Invalid Studio page");
      return controller.dispatch("browser", { action: "open" });
    });
    stopRpc = await startRpc(app.getPath("userData"), (method, input) =>
      controller.dispatch(method, input),
    );
    app.once("will-quit", () => {
      presentation.dispose();
      controller.close();
      void stopRpc();
    });
  }
  workspace ??= new DesktopWorkspace(
    app.getPath("userData"),
    config.studioOrigin,
  );
  const win = mainWindow;
  presentation.attach(win);
  win.webContents.on("did-navigate", (_event, url) =>
    workspace.rememberUrl(url),
  );
  win.webContents.on("did-navigate-in-page", (_event, url, isMainFrame) => {
    if (isMainFrame) {
      workspace.rememberUrl(url);
    }
  });
  attachWindowRecovery(win, {
    controller,
    dialog,
    homeUrl: config.studioOrigin + "/",
    t,
  });
  let menuState;
  let checkpoint;
  const capture = () => {
    workspace.rememberUrl(win.webContents.getURL());
    return (checkpoint ??= controller
      .state()
      .then((state) => {
        menuState = state;
        const menu = Menu.getApplicationMenu();
        if (menu) {
          updateFileMenuContext(menu, state);
        }
        return workspace.remember(state);
      })
      .catch((error) => {
        console.warn("Cannot record desktop workspace:", error.message);
      })
      .finally(() => {
        checkpoint = undefined;
      }));
  };
  const workspaceTimer = setInterval(() => {
    if (win.webContents.isLoadingMainFrame() || win.webContents.isCrashed()) {
      return;
    }
    void capture().then((changed) => {
      if (changed) {
        buildMenu();
      }
    });
  }, 5000);
  let closeRequest;
  win.on("close", (event) => {
    if (quitting || win.webContents.isCrashed()) {
      return;
    }
    event.preventDefault();
    if (closeRequest) return;
    closeRequest = (async () => {
      const action = presentation.mode === "island" ? "island" : await presentation.closingAction();
      if (!action || quitting || win.isDestroyed()) return;
      await capture();
      if (quitting || win.isDestroyed()) return;
      if (action === "island") await presentation.setMode("island");
      else { quitting = true; app.quit(); }
    })().catch((error) => {
      console.error("Cannot close main window:", error);
      dialog.showErrorBox(t("Operation Failed"), t("Please try again"));
    }).finally(() => { closeRequest = undefined; });
  });
  const beforeQuit = (event) => {
    if (quitting) {
      return;
    }
    event.preventDefault();
    void capture().finally(() => {
      quitting = true;
      app.quit();
    });
  };
  app.on("before-quit", beforeQuit);
  win.once("closed", () => {
    clearInterval(workspaceTimer);
    app.removeListener("before-quit", beforeQuit);
  });
  mainWindow.once("ready-to-show", () => { if (presentation.mode !== "island") win.show(); });
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
  if (!updates) {
    updates = await createUpdates({
      config,
      getWindow: () => mainWindow,
      session: desktopSession,
      showUpdateDialog: () => openUpdates(),
      beforeInstall: async () => {
        const state = await controller.state();
        if (state.projectId) {
          if (!state.ready) {
            throw uiError(
              "The current design is not ready. Wait for it to load before installing the update.",
            );
          }
          await controller.dispatch("execute", { name: "save", input: {} });
        }
      },
    });
  }
  openUpdates = createUpdateDialog(updates, win);
  function buildMenu() {
    const checkForUpdatesItem = {
      label: t("Check for Updates…"),
      click: () => openUpdates(),
    };
    const menu = Menu.buildFromTemplate([
      ...(process.platform === "darwin"
        ? [
            {
              label: "Plasmic",
              submenu: [
                { role: "about", label: t("About Plasmic") },
                { type: "separator" },
                { role: "services", label: t("Services") },
                { type: "separator" },
                { role: "hide", label: t("Hide Plasmic") },
                { role: "hideOthers", label: t("Hide Others") },
                { role: "unhide", label: t("Show All") },
                { type: "separator" },
                { role: "quit", label: t("Quit Plasmic") },
              ],
            },
          ]
        : []),
      fileMenu({
        controller,
        workspace,
        session: desktopSession,
        getWindow: () => mainWindow,
        dialog,
        refresh: buildMenu,
        state: menuState,
        t,
      }),
      {
        label: t("Edit"),
        submenu: [
          { role: "undo", label: t("Undo") },
          { role: "redo", label: t("Redo") },
          { type: "separator" },
          { role: "cut", label: t("Cut") },
          { role: "copy", label: t("Copy") },
          { role: "paste", label: t("Paste") },
          { role: "selectAll", label: t("Select All") },
        ],
      },
      {
        label: t("View"),
        submenu: [
          { label: t("Display mode"), submenu: MODES.map((value, index) => ({
            id: `presentation-${value}`, type: "radio", checked: presentation.mode === value,
            label: t(["Standard window", "Full screen", "Dynamic Island"][index]),
            ...(value === "island" ? { accelerator: "CmdOrCtrl+Shift+I" } : {}),
            click: () => void presentation.setMode(value).catch(console.error),
          })) },
          { label: t("When closing the main window"), submenu: CLOSE_ACTIONS.map((value, index) => ({
            id: `close-action-${value}`, type: "radio", checked: presentation.closeAction === value,
            label: t(["Ask every time", "Switch to Dynamic Island", "Quit Plasmic"][index]),
            click: () => presentation.setCloseAction(value),
          })) },
          { type: "separator" },
          {
            label: t("Import from the web"),
            accelerator: "CmdOrCtrl+Shift+U",
            click: () => {
              void controller.dispatch("browser", { action: "open" });
            },
          },
          { type: "separator" },
          { role: "reload", label: t("Reload") },
          { role: "forceReload", label: t("Force Reload") },
          ...(!app.isPackaged
            ? [{ role: "toggleDevTools", label: t("Toggle Developer Tools") }]
            : []),
          { type: "separator" },
          { label: t("Actual Size"), accelerator: "CmdOrCtrl+0", click: () => mainWindow?.webContents.setZoomLevel(0) },
          { label: t("Zoom In"), accelerator: "CmdOrCtrl+Plus", click: () => mainWindow?.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + .5) },
          { label: t("Zoom Out"), accelerator: "CmdOrCtrl+-", click: () => mainWindow?.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - .5) },
          { label: t("Toggle Full Screen"), accelerator: process.platform === "darwin" ? "Ctrl+Command+F" : "F11",
            click: () => void presentation.setMode(presentation.mode === "fullscreen" ? "window" : "fullscreen").catch(console.error) },
        ],
      },
      {
        label: t("Window"),
        submenu: [
          { role: "minimize", label: t("Minimize") },
          { role: "zoom", label: t("Zoom") },
          ...(process.platform === "darwin"
            ? [
                { type: "separator" },
                { role: "front", label: t("Bring All to Front") },
              ]
            : []),
        ],
      },
      ...(process.platform !== "darwin"
        ? [{ label: t("Updates"), submenu: [checkForUpdatesItem] }]
        : []),
      {
        label: t("AI"),
        submenu: [{ label: t("MCP"), click: () => openMcpSettings() }],
      },
    ]);
    if (process.platform === "darwin") {
      menu.items[0].submenu.insert(1, new MenuItem(checkForUpdatesItem));
    }
    menu.getMenuItemById("desktop-file").submenu.on("menu-will-show", () => {
      void capture();
      void desktopLogin
        .noteActivity()
        .then(() => workspace.refreshRecent(desktopSession))
        .then((changed) => {
          if (changed && !win.isDestroyed()) {
            buildMenu();
          }
        })
        .catch((error) => {
          console.warn("Cannot refresh desktop workspace:", error.message);
        });
    });
    Menu.setApplicationMenu(menu);
  }
  await desktopLogin.noteActivity().catch((error) => {
    console.warn("Cannot restore desktop session:", error.message);
  });
  const startupUrl = await workspace.startupUrl(desktopSession);
  buildMenu();
  const stopLocale = desktopI18n.subscribe(() => {
    buildMenu();
    if (!win.isDestroyed()) {
      win.webContents.send("desktop:ui-locale", desktopI18n.snapshot());
    }
  });
  win.once("closed", stopLocale);
  try {
    await mainWindow.loadURL(startupUrl);
  } catch (error) {
    // Session recovery can replace the first page before its load finishes.
    // Wait for that login navigation rather than treating it as a fatal startup.
    if (
      error.errno !== -3 ||
      (!unifiedAuth.navigation &&
        new URL(mainWindow.webContents.getURL()).pathname !== AUTH_PATH)
    ) {
      throw error;
    }
    await unifiedAuth.navigation;
  }
  await presentation.setMode(presentation.mode);
  if (process.platform === "darwin") {
    await acknowledgeMacUpdate(app);
  }
  return mainWindow;
}

function ensureDesktop() {
  if (!startingDesktop) {
    startingDesktop = startDesktop().finally(() => {
      startingDesktop = undefined;
    });
  }
  return startingDesktop;
}

function bootstrap() {
  const userData =
    process.env.PLASMIC_DESKTOP_PROFILE ||
    path.join(app.getPath("appData"), "Plasmic Desktop");
  fs.mkdirSync(userData, { recursive: true });
  app.setPath("userData", userData);
  app.setPath("sessionData", userData);
  app.setName("Plasmic");
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  } else {
    const showDesktop = async (forceMain = false) => {
      await app.whenReady();
      const win = mainWindow || (await ensureDesktop());
      if (!forceMain && presentation.mode === "island" && win.isVisible()) win.focus();
      else await presentation.setMode(forceMain ? "window" : presentation.mode);
      return win;
    };
    const handleAppCallback = async (url) => {
      if (!url.startsWith(APP_CALLBACK_URL + "?")) {
        return;
      }
      await showDesktop(true);
      unifiedAuth?.login.acceptCallback(url);
    };
    app.on("second-instance", (_event, argv) => {
      const callback = argv.find((value) =>
        value.startsWith("plasmic-desktop:"),
      );
      if (callback) {
        void handleAppCallback(callback);
      } else {
        void showDesktop();
      }
    });
    app.on("open-url", (event, url) => {
      if (!url.startsWith("plasmic-desktop:")) {
        return;
      }
      event.preventDefault();
      void handleAppCallback(url);
    });
    app
      .whenReady()
      .then(async () => {
        // Only the GUI instance holding the lock becomes a regular Dock app.
        app.setActivationPolicy?.("regular");
        await app.dock?.show();
        if (app.isPackaged) {
          app.setAsDefaultProtocolClient("plasmic-desktop");
        }
        return ensureDesktop().then((win) => {
          const callback = process.argv.find((value) =>
            value.startsWith("plasmic-desktop:"),
          );
          if (callback) {
            void handleAppCallback(callback);
          }
          return win;
        });
      })
      .catch((error) => {
        console.error("Desktop startup failed", error);
        dialog.showErrorBox(desktopI18n.t("Error"), desktopI18n.t("Could not start Plasmic."));
        app.quit();
      });
    app.on("activate", () => {
      if (mainWindow && presentation) {
        if (!startingDesktop) {
          if (presentation.mode === "island" && mainWindow.isVisible()) mainWindow.focus();
          else void presentation.setMode(presentation.mode).catch(console.error);
        }
      } else if (!mainWindow) {
        ensureDesktop().catch((error) => {
          console.error("Desktop startup failed", error);
          dialog.showErrorBox(desktopI18n.t("Error"), desktopI18n.t("Could not start Plasmic."));
        });
      }
    });
    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });
  }
}
module.exports = { startDesktop, bootstrap };
