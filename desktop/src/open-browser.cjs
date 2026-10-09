const { app, shell } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");

async function openBrowser(url) {
  if (process.platform === "darwin") {
    const browser = await app.getApplicationInfoForProtocol(url);
    if (browser.path.endsWith("/Google Chrome.app")) {
      // Pass the URL through Chrome's startup arguments. macOS URL events can
      // otherwise be delivered to a background headless Chrome instance.
      await new Promise((resolve, reject) => {
        const child = spawn(
          path.join(browser.path, "Contents/MacOS/Google Chrome"),
          [url],
          { detached: true, stdio: "ignore" },
        );
        child.once("error", reject);
        child.once("spawn", () => {
          child.unref();
          resolve();
        });
      });
      return;
    }
  }
  await shell.openExternal(url, { activate: true });
}

module.exports = { openBrowser };
