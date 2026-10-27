const fs = require("node:fs/promises");
const path = require("node:path");
const semver = require("semver");
const { NsisUpdater, AppImageUpdater } = require("electron-updater");
const { CancellationError, CURRENT_APP_INSTALLER_FILE_NAME } = require("builder-util-runtime");
const { downloadArchive, seedArchive } = require("./update-download.cjs");

function artifact(updater, version, fileInfo) {
  const url = new URL(fileInfo.url);
  const base = new URL(updater.desktopFeedUrl);
  if (!semver.valid(version) || semver.prerelease(version) ||
      url.protocol !== "https:" || url.origin !== base.origin ||
      !url.pathname.startsWith(base.pathname) || url.username || url.password || url.search || url.hash ||
      !/^[a-zA-Z0-9._-]+$/.test(path.basename(url.pathname)) ||
      !path.basename(url.pathname).includes(`-${version}-`) ||
      !Number.isSafeInteger(fileInfo.info.size) || fileInfo.info.size <= 0 ||
      !/^[A-Za-z0-9+/]{86}==$/.test(fileInfo.info.sha512)) throw new Error("Invalid native update artifact");
  const extension = updater instanceof WindowsUpdater ? ".exe" : ".AppImage";
  if (!url.pathname.endsWith(extension)) throw new Error("Native update artifact type mismatch");
  const platform = updater instanceof WindowsUpdater ? "win32" : "linux";
  const cache = path.join(updater.app.userDataPath, "updates", platform, process.arch);
  return { info: { version, file: { ...fileInfo.info, url: url.href } }, cache, archive: path.join(cache, `Plasmic-${version}${extension}`) };
}

function transport(updater, headers) {
  return (url, options) => updater.netSession.fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
    bypassCustomProtocolHandlers: true,
  });
}

async function download(updater, fileInfo, options, destination) {
  const { info, cache, archive } = artifact(updater, options.updateInfoAndProvider.info.version, fileInfo);
  await fs.mkdir(cache, { recursive: true, mode: 0o700 });
  // This directory is outside electron-updater's pending directory, which it
  // clears on failure. Retain only the running base and the current target.
  for (const entry of await fs.readdir(cache, { withFileTypes: true })) {
    const match = /^Plasmic-(\d+\.\d+\.\d+)\.(?:exe|AppImage)(?:\.(?:json|blockmap|partial(?:\.json)?))?$/.exec(entry.name);
    if (entry.isFile() && match && ![updater.currentVersion.version, info.version].includes(match[1])) {
      await fs.rm(path.join(cache, entry.name));
    }
  }
  const controller = new AbortController();
  const token = options.cancellationToken;
  const cancel = () => controller.abort(new CancellationError());
  token.onCancel(cancel);
  try {
    await downloadArchive({
      fetch: transport(updater, options.requestHeaders), info, archive,
      currentVersion: updater.currentVersion.version, arch: process.arch,
      signal: controller.signal,
      onProgress: (progress) => updater.emit("download-progress", progress),
    });
    controller.signal.throwIfAborted();
    await fs.copyFile(archive, destination);
  } catch (error) {
    if (token.cancelled) throw new CancellationError();
    throw error;
  } finally {
    token.removeListener("cancel", cancel);
  }
}

// Extend only the download step. NSIS still checks the publisher signature;
// AppImage still sets executable permissions; both retain their native install.
class WindowsUpdater extends NsisUpdater {
  async differentialDownloadInstaller(fileInfo, options, destination) {
    await download(this, fileInfo, options, destination);
    return false;
  }
}

class LinuxUpdater extends AppImageUpdater {
  async downloadDifferential(fileInfo, _oldFile, destination, _provider, options) {
    await download(this, fileInfo, options, destination);
    return false;
  }
}

async function seedInstalled(updater, info) {
  if (info.version !== updater.currentVersion.version) return;
  const provider = await updater.clientPromise;
  const extension = updater instanceof WindowsUpdater ? ".exe" : ".AppImage";
  const fileInfo = provider.resolveFiles(info).find((file) => file.url.pathname.endsWith(extension));
  if (!fileInfo) return;
  const target = artifact(updater, info.version, fileInfo);
  const source = updater instanceof WindowsUpdater
    ? path.join((await updater.getOrCreateDownloadHelper()).cacheDir, CURRENT_APP_INSTALLER_FILE_NAME)
    : process.env.APPIMAGE;
  await seedArchive({
    fetch: transport(updater, updater.requestHeaders), ...target,
    arch: process.arch, source,
  });
}

function createNativeUpdater({ platform, feedUrl }) {
  if (!["win32", "linux"].includes(platform)) throw new Error("Unsupported native updater platform");
  const updater = platform === "win32" ? new WindowsUpdater() : new LinuxUpdater();
  updater.desktopFeedUrl = feedUrl.endsWith("/") ? feedUrl : feedUrl + "/";
  updater.setFeedURL({ provider: "generic", url: updater.desktopFeedUrl, useMultipleRangeRequest: false });
  updater.disableWebInstaller = true;
  updater.on("update-not-available", (info) => {
    void seedInstalled(updater, info).catch((error) => updater.logger.info(`Cannot seed differential update cache: ${error.message}`));
  });
  return updater;
}

module.exports = { createNativeUpdater };
