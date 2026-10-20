const { app, shell } = require("electron");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const openApplication = promisify(execFile);

async function openBrowser(url) {
  if (process.platform === "darwin") {
    const browser = await app.getApplicationInfoForProtocol(url);
    // Target the registered application explicitly and await LaunchServices'
    // handoff, rather than spawning a second Chrome process for every link.
    await openApplication("/usr/bin/open", ["-a", browser.path, url]);
    return;
  }
  await shell.openExternal(url, { activate: true });
}

module.exports = { openBrowser };
