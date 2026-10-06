const {
  app,
  BrowserWindow,
  dialog,
  Menu,
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
const { openBrowser } = require("./open-browser.cjs");
const { GoogleAuthWindow, AUTH_PATH } = require("./google-auth-window.cjs");
const { DesktopController } = require("./controller.cjs");
const { startRpc } = require("./local-rpc.cjs");
const { serveMcp } = require("./mcp.cjs");
const { McpIntegrations } = require("./mcp-integrations.cjs");
const { createMcpSettings } = require("./mcp-settings.cjs");
const { createUpdates, acknowledgeMacUpdate } = require("./updates.cjs");
const { DesktopWorkspace, fileMenu, updateFileMenuContext } = require("./workspace.cjs");
const { attachWindowRecovery } = require("./window-recovery.cjs");
let controller, stopRpc, openMcpSettings, updates, workspace;
let quitting = false;

let mainWindow;
let desktopSession;
let googleAuth;
let queuedOAuthUrl;
let startingDesktop;
const { DesktopGoogleLogin, SCHEME } = require("./google-login.cjs");
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
function isGoogleLogin(url) {
  const parsed = new URL(url);
  return (
    parsed.origin === config.studioOrigin &&
    parsed.pathname === "/api/v1/auth/google"
  );
}
function protectWindow(win) {
  for (const eventName of ["will-navigate", "will-redirect"]) {
    win.webContents.on(eventName, (event, url) => {
      if (!isInternal(url)) {
        event.preventDefault();
        openExternal(url);
      }
    });
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (win === mainWindow && isGoogleLogin(url)) {
      void googleAuth.begin();
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
  if (process.platform === "darwin") await acknowledgeMacUpdate(app, false);
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
        authPagePath: path.join(__dirname, "google-login.html"),
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
        remoteFetch: (request) => {
          return desktopSession.fetch(request, {
            bypassCustomProtocolHandlers: true,
            redirect: "manual",
            credentials: "include",
          });
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
  googleAuth = new GoogleAuthWindow(
    mainWindow,
    config.studioOrigin,
    openBrowser,
    new DesktopGoogleLogin({
      userData: app.getPath("userData"),
      session: desktopSession,
      studioOrigin: config.studioOrigin,
    }),
  );
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
    );
    const trustedAuthSender = (event) => {
      return (
        mainWindow &&
        event.sender === mainWindow.webContents &&
        event.senderFrame === event.sender.mainFrame &&
        new URL(event.senderFrame.url).origin === config.studioOrigin
      );
    };
    ipcMain.on("desktop:google-start", (event) => {
      if (trustedAuthSender(event)) {
        void googleAuth.begin();
      }
    });
    ipcMain.handle("desktop:google-command", (event, command) => {
      if (
        !trustedAuthSender(event) ||
        new URL(event.senderFrame.url).pathname !== AUTH_PATH
      ) {
        throw new Error("Invalid login page");
      }
      if (
        command === "copy-link" &&
        googleAuth.authorizationUrl &&
        googleAuth.status.phase === "waiting"
      ) {
        clipboard.writeText(googleAuth.authorizationUrl);
        return {
          ...googleAuth.status,
          copied: true,
          authorizationUrl: googleAuth.authorizationUrl,
        };
      }
      return googleAuth.command(command);
    });
    controller = new DesktopController(() => mainWindow, config, () => startingDesktop);
    stopRpc = await startRpc(app.getPath("userData"), (method, input) =>
      controller.dispatch(method, input),
    );
    app.once("will-quit", () => {
      controller.close();
      void stopRpc();
    });
  }
  workspace ??= new DesktopWorkspace(app.getPath("userData"), config.studioOrigin);
  const win = mainWindow;
  attachWindowRecovery(win, { controller, dialog, homeUrl: config.studioOrigin + "/" });
  let menuState;
  let checkpoint;
  const capture = () => checkpoint ??= controller.state().then((state) => {
    menuState = state;
    const menu = Menu.getApplicationMenu();
    if (menu) updateFileMenuContext(menu, state);
    return workspace.remember(state);
  }).catch((error) => {
    console.warn("Cannot record desktop workspace:", error.message);
  }).finally(() => { checkpoint = undefined; });
  const workspaceTimer = setInterval(() => {
    if (win.webContents.isLoadingMainFrame() || win.webContents.isCrashed()) return;
    void capture().then((changed) => { if (changed) buildMenu(); });
  }, 5000);
  let closing = false;
  win.on("close", (event) => {
    if (closing || quitting || win.webContents.isCrashed()) return;
    event.preventDefault();
    void capture().finally(() => { closing = true; win.close(); });
  });
  const beforeQuit = (event) => {
    if (quitting) return;
    event.preventDefault();
    void capture().finally(() => { quitting = true; app.quit(); });
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
      beforeInstall: async () => {
        const state = await controller.state();
        if (state.projectId) {
          if (!state.ready) throw new Error("当前设计尚未就绪，请等待设计加载完成再安装更新。");
          await controller.dispatch("execute", { name: "save", input: {} });
        }
      },
    });
  }
  function buildMenu() {
  const menu = Menu.buildFromTemplate([
      ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
      fileMenu({ controller, workspace, getWindow: () => mainWindow, dialog, refresh: buildMenu, state: menuState }),
      { label: "编辑", submenu: [
        { role: "undo", label: "撤销" }, { role: "redo", label: "重做" }, { type: "separator" },
        { role: "cut", label: "剪切" }, { role: "copy", label: "复制" }, { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ] },
      { label: "视图", submenu: [
        { role: "reload", label: "重新加载" }, { role: "forceReload", label: "强制重新加载" },
        { role: "toggleDevTools", label: "开发者工具" }, { type: "separator" },
        { role: "resetZoom", label: "实际大小" }, { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" }, { role: "togglefullscreen", label: "全屏" },
      ] },
      { label: "窗口", role: "windowMenu" },
      { label: "更新", submenu: [{ label: "检查更新…", click: async () => {
        const status = await updates.command("check");
        if (["available", "downloaded"].includes(status.phase)) {
          const ready = status.phase === "downloaded";
          const { response } = await dialog.showMessageBox(mainWindow, {
            title: "Plasmic 更新",
            message: ready ? `${status.version} 已下载，安装前将保存当前设计。` : `新版本 ${status.version} 可用。`,
            buttons: [ready ? "重启并安装" : "下载更新", "取消"],
            defaultId: 0,
            cancelId: 1,
          });
          if (response === 0) await updates.command(ready ? "install" : "download");
        }
        if (["current", "disabled", "error"].includes(status.phase)) {
          void dialog.showMessageBox(mainWindow, { title: "Plasmic 更新", message: status.error || (status.phase === "disabled" ? "请使用已安装的应用检查更新。" : `当前已是最新版本 ${status.currentVersion}`) });
        }
      } }] },
      {
        label: "AI",
        submenu: [{ label: "MCP", click: () => openMcpSettings() }],
      },
    ]);
  menu.getMenuItemById("desktop-file").submenu.on("menu-will-show", () => { void capture(); });
  Menu.setApplicationMenu(menu);
  }
  buildMenu();
  await mainWindow.loadURL(workspace.recent[0]?.url || config.studioOrigin + "/");
  void workspace.restore(mainWindow, controller).catch(async (error) => {
    console.warn("Cannot restore desktop workspace:", error.message);
    if (!win.isDestroyed()) await win.loadURL(config.studioOrigin + "/");
  });
  if (process.platform === "darwin") await acknowledgeMacUpdate(app);
  if (queuedOAuthUrl) {
    const url = queuedOAuthUrl;
    queuedOAuthUrl = undefined;
    await googleAuth.receiveCallback(url);
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
  const userData = process.env.PLASMIC_DESKTOP_PROFILE || path.join(app.getPath("appData"), "Plasmic Desktop");
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
    const receiveOAuth = async (url) => {
      if (!url?.startsWith(SCHEME + "://")) {
        return;
      }
      queuedOAuthUrl = url;
      if (startingDesktop || !app.isReady()) {
        return;
      }
      if (!mainWindow) {
        await ensureDesktop();
      } else {
        queuedOAuthUrl = undefined;
        await googleAuth.receiveCallback(url);
      }
    };
    app.on("open-url", (event, url) => {
      event.preventDefault();
      void receiveOAuth(url);
    });
    queuedOAuthUrl = process.argv.find((arg) => arg.startsWith(SCHEME + "://"));
    if (app.isPackaged) {
      app.setAsDefaultProtocolClient(SCHEME);
    } else if (process.platform === "win32") {
      app.setAsDefaultProtocolClient(SCHEME, process.execPath, [
        app.getAppPath(),
      ]);
    }
    app.on("second-instance", (_event, argv) => {
      void receiveOAuth(argv.find((arg) => arg.startsWith(SCHEME + "://")));
      if (mainWindow) {
        mainWindow.restore();
        mainWindow.focus();
      }
    });
    app
      .whenReady()
      .then(ensureDesktop)
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
