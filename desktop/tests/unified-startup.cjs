const { app, session } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const assert = require("node:assert/strict");
const config = require("../desktop.config.json");
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), "plasmic-unified-startup-"),
);
app.setPath("userData", profile);
let opened;
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (
    request === "./open-browser.cjs" &&
    parent.filename.endsWith("/src/main.cjs")
  ) {
    return {
      openBrowser: async (url) => {
        opened = new URL(url);
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { startDesktop } = require("../src/main.cjs");
Module._load = originalLoad;
const timeout = setTimeout(() => {
  console.error("Native sign-in startup timed out");
  app.exit(1);
}, 30000);
app
  .whenReady()
  .then(async () => {
    const ses = session.fromPartition("persist:plasmic-desktop");
    // No production API calls or credentials are involved in this native UI test.
    ses.fetch = async () =>
      Response.json(
        {
          error: {
            name: "UnauthorizedError",
            message: "Unauthenticated fixture",
            statusCode: 401,
          },
        },
        { status: 401 },
      );
    const win = await startDesktop();
    assert.equal(win.webContents.getLastWebPreferences().sandbox, true);
    await win.webContents.executeJavaScript(
      `window.location.href = ${JSON.stringify("https://shiguanglab.com/login?return_to=" + encodeURIComponent(config.studioOrigin + "/projects/fixture"))}`,
    );
    for (let i = 0; i < 150; i++) {
      if (
        new URL(win.webContents.getURL()).pathname === "/desktop/unified-login"
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await win.webContents
      .executeJavaScript("window.desktopUnifiedLogin.command('status')")
      .then((status) => assert.equal(status.phase, "idle"));
    assert.equal(opened, undefined, "Startup must not open the system browser");
    assert.equal(
      await win.webContents.executeJavaScript(
        "document.getElementById('sign-in').hidden",
      ),
      false,
    );
    assert.equal(
      await win.webContents.executeJavaScript(
        "document.getElementById('status').hidden",
      ),
      true,
    );
    await win.webContents.executeJavaScript(
      "document.getElementById('sign-in').click()",
    );
    for (let i = 0; i < 100 && !opened; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert(opened, "Clicking Sign in with Shiguang must start authorization");
    assert.equal(opened.origin, "https://shiguanglab.com");
    assert.equal(opened.searchParams.get("client_id"), "plasmicapp");
    assert.equal(opened.searchParams.get("code_challenge_method"), "S256");
    const cancelled = await win.webContents.executeJavaScript(
      "window.desktopUnifiedLogin.command('cancel')",
    );
    assert.equal(cancelled.phase, "idle");
    assert.equal(
      new URL(win.webContents.getURL()).pathname,
      "/desktop/unified-login",
    );
    clearTimeout(timeout);
    console.log(
      "Native sign-in prompt, explicit browser authorization and cancellation passed",
    );
    app.exit(0);
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
