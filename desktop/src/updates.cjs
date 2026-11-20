const { app, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { UpdateManager } = require("./update-manager.cjs");
const { MacUpdater, acknowledgeMacUpdate } = require("./mac-updater.cjs");
const { macUpdateArch } = require("./update-architecture.cjs");
const { createUpdateFeed } = require("./update-feed.cjs");

async function createUpdates({ config, getStudio, session, beforeInstall, showUpdateDialog }) {
  const platform = process.platform;
  const arch = platform === "darwin" ? macUpdateArch(app) : process.arch;
  const feedUrl = `${config.updateUrl}/${platform}/${arch}/`;
  const manifestName = { darwin: "latest-mac.yml", linux: arch === "arm64" ? "latest-linux-arm64.yml" : "latest-linux.yml", win32: "latest.yml" }[platform];
  const feed = createUpdateFeed({ session, feedUrl, studioOrigin: config.studioOrigin, partition: `${platform}/${arch}`, manifestName });
  const updater = platform === "darwin"
    ? new MacUpdater({ app, feedUrl, betaUrl: feed.betaUrl, latest: feed.latest, fetch: feed.fetchFile })
    : require("./native-updater.cjs").createNativeUpdater({ platform, feedUrl, feed });
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxy && updater.netSession) await updater.netSession.setProxy({ proxyRules: proxy, proxyBypassRules: process.env.NO_PROXY || "" });
  const manager = new UpdateManager({ updater, version: app.getVersion(), enabled: app.isPackaged && (process.platform !== "linux" || !!process.env.APPIMAGE), beforeInstall, canInstallBeta: feed.canInstallBeta });
  try {
    const error = await fs.readFile(path.join(app.getPath("userData"), "updates/install-failure.txt"), "utf8");
    manager.fail(new Error(error));
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  ipcMain.handle("desktop:update", (event, command) => {
    const window = getStudio();
    if (!window || (event.sender !== window.webContents && !(command === "status" && window.owns(event.sender))) || event.senderFrame !== event.sender.mainFrame || new URL(event.senderFrame.url).origin !== config.studioOrigin) throw new Error("Invalid update sender");
    if (command === "open") { showUpdateDialog(); return manager.state; }
    return manager.command(command);
  });
  manager.on("status", (status) => {
    const window = getStudio();
    if (window && !window.window.isDestroyed()) window.webContents.send("desktop:update-status", status);
  });
  manager.start();
  app.once("will-quit", () => manager.stop());
  return manager;
}
module.exports = { createUpdates, acknowledgeMacUpdate };
