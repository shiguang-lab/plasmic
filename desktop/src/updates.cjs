const { app, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { UpdateManager } = require("./update-manager.cjs");
const { MacUpdater, acknowledgeMacUpdate } = require("./mac-updater.cjs");

async function createUpdates({ config, getWindow, session, beforeInstall }) {
  const feedUrl = `${config.updateUrl}/${process.platform}/${process.arch}/`;
  if (new URL(feedUrl).protocol !== "https:") throw new Error("Updates require HTTPS");
  const updater = process.platform === "darwin"
    ? new MacUpdater({ app, feedUrl, fetch: (url, options) => session.fetch(url, { ...options, bypassCustomProtocolHandlers: true }) })
    : require("electron-updater").autoUpdater;
  if (process.platform !== "darwin") updater.setFeedURL({ provider: "generic", url: feedUrl, useMultipleRangeRequest: false });
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxy && updater.netSession) await updater.netSession.setProxy({ proxyRules: proxy, proxyBypassRules: process.env.NO_PROXY || "" });
  const manager = new UpdateManager({ updater, version: app.getVersion(), enabled: app.isPackaged && (process.platform !== "linux" || !!process.env.APPIMAGE), beforeInstall });
  try {
    const error = await fs.readFile(path.join(app.getPath("userData"), "updates/install-failure.txt"), "utf8");
    manager.fail(new Error(error));
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  ipcMain.handle("desktop:update", (event, command) => {
    const window = getWindow();
    if (!window || event.sender !== window.webContents || event.senderFrame !== event.sender.mainFrame || new URL(event.senderFrame.url).origin !== config.studioOrigin) throw new Error("Invalid update sender");
    return manager.command(command);
  });
  manager.on("status", (status) => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send("desktop:update-status", status);
  });
  manager.start();
  app.once("will-quit", () => manager.stop());
  return manager;
}
module.exports = { createUpdates, acknowledgeMacUpdate };
