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
const { DesktopController } = require("./controller.cjs");
const { startRpc } = require("./local-rpc.cjs");
const { serveMcp } = require("./mcp.cjs");
const { McpIntegrations } = require("./mcp-integrations.cjs");
const { createMcpSettings } = require("./mcp-settings.cjs");
const { createUpdates, acknowledgeMacUpdate } = require("./updates.cjs");
const { createUpdateWindow } = require("./update-window.cjs");
const {
  DesktopWorkspace,
  fileMenu,
  updateFileMenuContext,
} = require("./workspace.cjs");
const { attachWindowRecovery } = require("./window-recovery.cjs");
let controller, stopRpc, openMcpSettings, updates, openUpdates, workspace;
let quitting = false;

let mainWindow;
let desktopSession;
let unifiedAuth;
let recoverSession;
let startingDesktop;
const {
  DesktopUnifiedLogin,
  AUTH_ORIGIN,
  APP_CALLBACK_URL,
} = require("./unified-login.cjs");
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
    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        webPreferences: {
          session: win.webContents.session,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
        },
      },
    };
  });
  win.webContents.on("did-create-window", (child) => {
    protectWindow(child);
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
        bridgePath: path.join(__dirname, "editor-bridge.js"),
        authPagePath: path.join(__dirname, "unified-login.html"),
        updateUiPath: path.join(__dirname, "update-ui.js"),
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
          const response = await forwardRemoteRequest(desktopSession, request);
          await recoverSession(response, request.url);
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
    backgroundColor: "#ffffff",
    ...(process.platform === "darwin"
      ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 16, y: 16 } }
      : {}),
    webPreferences: {
      session: desktopSession,
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.webContents.setUserAgent(
    `${mainWindow.webContents.getUserAgent()} PlasmicDesktop/${process.platform}`,
  );
  unifiedAuth = new UnifiedAuthWindow(
    mainWindow,
    config.studioOrigin,
    openBrowser,
    new DesktopUnifiedLogin({
      session: desktopSession,
      studioOrigin: config.studioOrigin,
    }),
  );
  recoverSession = createSessionRecovery({
    session: desktopSession,
    studioOrigin: config.studioOrigin,
    auth: unifiedAuth,
  });
  protectWindow(mainWindow);
  if (!controller) {
    const integrations = new McpIntegrations({
      userData: app.getPath("userData"),
      command: process.execPath,
      args: app.isPackaged ? ["--mcp"] : [app.getAppPath(), "--mcp"],
    });
    integrations.restore();
    openMcpSettings = createMcpSettings(integrations, () => mainWindow);
    const trustedAuthSender = (event) => {
      return (
        mainWindow &&
        event.sender === mainWindow.webContents &&
        event.senderFrame === event.sender.mainFrame &&
        new URL(event.senderFrame.url).origin === config.studioOrigin
      );
    };
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
    );
    stopRpc = await startRpc(app.getPath("userData"), (method, input) =>
      controller.dispatch(method, input),
    );
    app.once("will-quit", () => {
      controller.close();
      void stopRpc();
    });
  }
  workspace ??= new DesktopWorkspace(
    app.getPath("userData"),
    config.studioOrigin,
  );
  const win = mainWindow;
  attachWindowRecovery(win, {
    controller,
    dialog,
    homeUrl: config.studioOrigin + "/",
  });
  let menuState;
  let checkpoint;
  const capture = () =>
    (checkpoint ??= controller
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
  let closing = false;
  win.on("close", (event) => {
    if (closing || quitting || win.webContents.isCrashed()) {
      return;
    }
    event.preventDefault();
    void capture().finally(() => {
      closing = true;
      win.close();
    });
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
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
  if (!updates) {
    updates = await createUpdates({
      config,
      getWindow: () => mainWindow,
      session: desktopSession,
      showUpdateWindow: () => openUpdates(),
      beforeInstall: async () => {
        const state = await controller.state();
        if (state.projectId) {
          if (!state.ready) {
            throw new Error(
              "The current design is not ready. Wait for it to load before installing the update.",
            );
          }
          await controller.dispatch("execute", { name: "save", input: {} });
        }
      },
    });
    openUpdates = createUpdateWindow(updates, () => mainWindow);
  }
  function buildMenu() {
    const checkForUpdatesItem = {
      label: "Check for Updates…",
      click: () => openUpdates(),
    };
    const menu = Menu.buildFromTemplate([
      ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
      fileMenu({
        controller,
        workspace,
        getWindow: () => mainWindow,
        dialog,
        refresh: buildMenu,
        state: menuState,
      }),
      {
        label: "Edit",
        submenu: [
          { role: "undo", label: "Undo" },
          { role: "redo", label: "Redo" },
          { type: "separator" },
          { role: "cut", label: "Cut" },
          { role: "copy", label: "Copy" },
          { role: "paste", label: "Paste" },
          { role: "selectAll", label: "Select All" },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload", label: "Reload" },
          { role: "forceReload", label: "Force Reload" },
          { role: "toggleDevTools", label: "Toggle Developer Tools" },
          { type: "separator" },
          { role: "resetZoom", label: "Actual Size" },
          { role: "zoomIn", label: "Zoom In" },
          { role: "zoomOut", label: "Zoom Out" },
          { role: "togglefullscreen", label: "Toggle Full Screen" },
        ],
      },
      { label: "Window", role: "windowMenu" },
      ...(process.platform !== "darwin"
        ? [{ label: "Updates", submenu: [checkForUpdatesItem] }]
        : []),
      {
        label: "AI",
        submenu: [{ label: "MCP", click: () => openMcpSettings() }],
      },
    ]);
    if (process.platform === "darwin") {
      menu.items[0].submenu.insert(1, new MenuItem(checkForUpdatesItem));
    }
    menu.getMenuItemById("desktop-file").submenu.on("menu-will-show", () => {
      void capture();
    });
    Menu.setApplicationMenu(menu);
  }
  buildMenu();
  const startupUrl = workspace.recent[0]?.url || config.studioOrigin + "/";
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
  void workspace.restore(mainWindow, controller).catch(async (error) => {
    console.warn("Cannot restore desktop workspace:", error.message);
    if (
      !win.isDestroyed() &&
      !unifiedAuth.navigation &&
      !win.webContents.isLoadingMainFrame() &&
      win.webContents.getURL() === startupUrl
    ) {
      await win.loadURL(config.studioOrigin + "/");
    }
  });
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
  if (process.argv.includes("--mcp")) {
    // Dedicated stdio process: no BrowserWindow and no instance lock.
    // The active GUI process owns the editor and local command socket.
    serveMcp(process.env.PLASMIC_DESKTOP_PROFILE || app.getPath("userData"))
      .then((server) =>
        process.stdin.once("end", () => {
          void server.close();
          app.quit();
        }),
      )
      .catch((error) => {
        process.stderr.write(error.message + "\n");
        app.exit(1);
      });
  } else if (!app.requestSingleInstanceLock()) {
    app.quit();
  } else {
    const showDesktop = async () => {
      await app.whenReady();
      const win = mainWindow || (await ensureDesktop());
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    };
    const handleAppCallback = async (url) => {
      if (!url.startsWith(APP_CALLBACK_URL + "?")) return;
      await showDesktop();
      unifiedAuth?.login.acceptCallback(url);
    };
    app.on("second-instance", (_event, argv) => {
      const callback = argv.find((value) =>
        value.startsWith("plasmic-desktop:"),
      );
      if (callback) void handleAppCallback(callback);
      else void showDesktop();
    });
    app.on("open-url", (event, url) => {
      if (!url.startsWith("plasmic-desktop:")) return;
      event.preventDefault();
      void handleAppCallback(url);
    });
    app
      .whenReady()
      .then(() => {
        if (app.isPackaged) app.setAsDefaultProtocolClient("plasmic-desktop");
        return ensureDesktop().then((win) => {
          const callback = process.argv.find((value) =>
            value.startsWith("plasmic-desktop:"),
          );
          if (callback) void handleAppCallback(callback);
          return win;
        });
      })
      .catch((error) => {
        dialog.showErrorBox("Plasmic could not start", error.message);
        app.quit();
      });
    app.on("activate", () => {
      if (!mainWindow) {
        ensureDesktop().catch((error) =>
          dialog.showErrorBox("Startup failed", error.message),
        );
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
