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
const { createAssetHandler } = require("./asset-handler.cjs");
const { openBrowser } = require("./open-browser.cjs");
const { GoogleAuthWindow, AUTH_PATH } = require("./google-auth-window.cjs");
const { DesktopController } = require("./controller.cjs");
const { startRpc } = require("./local-rpc.cjs");
const { serveMcp } = require("./mcp.cjs");
const { McpIntegrations } = require("./mcp-integrations.cjs");
const { createMcpSettings } = require("./mcp-settings.cjs");
let controller, stopRpc, openMcpSettings;

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
  if (["https:", "http:"].includes(new URL(url).protocol))
    void shell.openExternal(url);
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
  win.webContents.on("did-create-window", (child, details) => {
    protectWindow(child);
  });
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());
}

async function startDesktop() {
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
  if (!desktopSession) {
    desktopSession = session.fromPartition("persist:plasmic-desktop");
    const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    if (proxy)
      await desktopSession.setProxy({
        proxyRules: proxy,
        proxyBypassRules: process.env.NO_PROXY || "",
      });
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
    title: "Plasmic Desktop",
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      session: desktopSession,
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  googleAuth = new GoogleAuthWindow(
    mainWindow,
    config.studioOrigin,
    openBrowser,
    new DesktopGoogleLogin({ userData: app.getPath("userData"), session: desktopSession, studioOrigin: config.studioOrigin }),
  );
  protectWindow(mainWindow);
  if (!controller) {
    const integrations = new McpIntegrations({
      userData: app.getPath("userData"),
      command: process.execPath,
      args: app.isPackaged ? ["--mcp"] : [app.getAppPath(), "--mcp"],
    });
    integrations.restore();
    openMcpSettings = createMcpSettings(integrations, () => mainWindow);
    function trustedAuthSender(event) {
      return (
        mainWindow &&
        event.sender === mainWindow.webContents &&
        event.senderFrame === event.sender.mainFrame &&
        new URL(event.senderFrame.url).origin === config.studioOrigin
      );
    }
    ipcMain.on("desktop:google-start", (event) => {
      if (trustedAuthSender(event)) void googleAuth.begin();
    });
    ipcMain.handle("desktop:google-command", (event, command) => {
      if (
        !trustedAuthSender(event) ||
        new URL(event.senderFrame.url).pathname !== AUTH_PATH
      )
        throw new Error("Invalid login page");
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
    controller = new DesktopController(() => mainWindow, config);
    stopRpc = await startRpc(app.getPath("userData"), (method, input) =>
      controller.dispatch(method, input),
    );
    app.once("will-quit", () => {
      controller.close();
      void stopRpc();
    });
  }
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
      { role: "fileMenu" },
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" },
      {
        label: "MCP",
        submenu: [{ label: "MCP 设置…", click: () => openMcpSettings() }],
      },
    ]),
  );
  await mainWindow.loadURL(config.studioOrigin + "/");
  if (queuedOAuthUrl) {
    const url = queuedOAuthUrl;
    queuedOAuthUrl = undefined;
    await googleAuth.receiveCallback(url);
  }
  return mainWindow;
}

function ensureDesktop() {
  if (!startingDesktop) startingDesktop = startDesktop().finally(() => { startingDesktop = undefined; });
  return startingDesktop;
}

function bootstrap() {
  app.setName("Plasmic Desktop");
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
  } else if (!app.requestSingleInstanceLock()) app.quit();
  else {
    async function receiveOAuth(url) {
      if (!url?.startsWith(SCHEME + "://")) return;
      queuedOAuthUrl = url;
      if (startingDesktop || !app.isReady()) return;
      if (!mainWindow) {
        await ensureDesktop();
      } else {
        queuedOAuthUrl = undefined;
        await googleAuth.receiveCallback(url);
      }
    }
    app.on("open-url", (event, url) => { event.preventDefault(); void receiveOAuth(url); });
    queuedOAuthUrl = process.argv.find(arg => arg.startsWith(SCHEME + "://"));
    if (app.isPackaged) app.setAsDefaultProtocolClient(SCHEME);
    else if (process.platform === "win32") app.setAsDefaultProtocolClient(SCHEME, process.execPath, [app.getAppPath()]);
    app.on("second-instance", (_event, argv) => {
      void receiveOAuth(argv.find(arg => arg.startsWith(SCHEME + "://")));
      if (mainWindow) {
        mainWindow.restore();
        mainWindow.focus();
      }
    });
    app
      .whenReady()
      .then(ensureDesktop)
      .catch((error) => {
        dialog.showErrorBox("Plasmic Desktop could not start", error.message);
        app.quit();
      });
    app.on("activate", () => {
      if (!mainWindow)
        ensureDesktop().catch((error) =>
          dialog.showErrorBox("Startup failed", error.message),
        );
    });
    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") app.quit();
    });
  }
}
module.exports = { startDesktop, bootstrap };
